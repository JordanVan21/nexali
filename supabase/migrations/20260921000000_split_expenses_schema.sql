-- Split Expenses backend, Part 1: schema.
--
-- Normalized, RPC-only tables (same architecture as the Friends backend --
-- see 20260919000000_friends_schema.sql's own header for the rationale).
-- No table here gets a direct INSERT/UPDATE/DELETE grant for
-- `authenticated`; every real mutation goes through the hardened
-- SECURITY DEFINER RPCs in 20260921000200_split_expenses_rpcs.sql.
--
-- Money is stored as integer CENTS (bigint) everywhere in this feature's
-- own tables -- never numeric/float -- converted to the existing
-- transactions.amount numeric(10,2) convention only at the single point a
-- real transaction row is created (see the RPCs migration).
--
-- FILE STRUCTURE: every table is created first (columns/constraints/
-- indexes/RLS-enable/grants only), THEN a small set of SECURITY DEFINER
-- helper functions, THEN every SELECT policy, all at the very end. Two
-- ordering hazards forced this structure and are worth calling out
-- explicitly so a future edit doesn't reintroduce them:
--   1. split_expenses' own policy needs to reference split_participants
--      (and vice versa) -- CREATE POLICY validates referenced objects
--      immediately, so both tables must exist before EITHER policy is
--      created.
--   2. A naive policy on split_expenses that subqueries split_participants
--      directly, paired with a policy on split_participants that
--      subqueries split_expenses directly, produces
--      "infinite recursion detected in policy" the moment either is
--      evaluated for a non-RLS-exempt role -- confirmed by hitting this
--      live while validating this migration. The fix (and why every
--      policy below calls a helper function instead of embedding a raw
--      cross-table EXISTS subquery) is Supabase's own documented pattern
--      for this exact class of bug: isolate the cross-table check inside
--      a SECURITY DEFINER function, which evaluates without re-entering
--      RLS on the table(s) it reads.

-- ============================================================================
-- split_expenses: the parent submitted-split record.
--
-- STATUS MODEL (deliberately smaller than the task's suggested
-- submitted/partially_accepted/accepted/needs_attention four-state model):
-- no current frontend surface distinguishes "nobody has responded yet" from
-- "some participants have accepted, some are still pending" -- both are
-- simply "not fully resolved yet", and the precise per-participant state is
-- always separately available via split_participants.response_status. A
-- fourth "partially_accepted" status would carry no information a client
-- can't already get from the participant rows, so it was not added.
--   'submitted'       -- creator submitted; at least one participant still
--                         pending, nobody has declined (covers both
--                         "nobody responded yet" and "some accepted, some
--                         pending" -- see above).
--   'accepted'        -- every participant (including a creator-only split,
--                         which needs no approval at all) has accepted.
--   'needs_attention' -- at least one participant declined. The creator
--                         must see this before assuming the agreed split is
--                         fully in effect (see the RPCs migration's decline
--                         function for why nothing is silently
--                         re-allocated).
-- ============================================================================
CREATE TABLE "public"."split_expenses" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "created_by" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "currency" "text" NOT NULL,
    "status" "text" NOT NULL DEFAULT 'submitted',
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    "submitted_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    -- Client-generated per-submission-attempt key. A retry of the SAME
    -- logical submission (double-click, network retry) reuses this same
    -- key -- submit_split_expense() looks it up FIRST and returns the
    -- already-created split's summary instead of inserting a duplicate.
    "idempotency_key" "uuid" NOT NULL,
    CONSTRAINT "split_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_expenses_status_check" CHECK ("status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'needs_attention'::"text"])),
    CONSTRAINT "split_expenses_currency_valid" CHECK ("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text", 'AUD'::"text", 'JPY'::"text"])),
    -- The real, DB-level idempotency backstop -- a second concurrent
    -- request with the same key (a genuine race, not just a sequential
    -- retry) fails atomically here rather than racing past an
    -- application-level pre-check.
    CONSTRAINT "split_expenses_creator_idempotency_key" UNIQUE ("created_by", "idempotency_key")
);
ALTER TABLE "public"."split_expenses" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_expenses" IS 'Parent submitted-split record. RPC-only surface -- see 20260921000200_split_expenses_rpcs.sql.';

CREATE INDEX "split_expenses_created_by_idx" ON "public"."split_expenses" ("created_by", "created_at" DESC);

ALTER TABLE "public"."split_expenses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_expenses" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_expenses" TO "service_role";

-- ============================================================================
-- split_participants: every Nexali user in the split, including the
-- creator (stored as an ordinary participant row, response_status
-- 'accepted' immediately -- the creator never approves their own
-- submission).
-- ============================================================================
CREATE TABLE "public"."split_participants" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "split_id" "uuid" NOT NULL REFERENCES "public"."split_expenses"("id") ON DELETE CASCADE,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Submission-order position (0-based, as sent by the client) -- the
    -- SAME stable ordering the frontend preview used, reused server-side
    -- for deterministic settlement-transfer ordering (see the RPCs
    -- migration) so the two algorithms produce identical results.
    "position" integer NOT NULL,
    "response_status" "text" NOT NULL DEFAULT 'pending',
    "responded_at" timestamp with time zone,
    "allocated_total_cents" bigint NOT NULL DEFAULT 0,
    "paid_total_cents" bigint NOT NULL DEFAULT 0,
    CONSTRAINT "split_participants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_participants_response_status_check" CHECK ("response_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])),
    CONSTRAINT "split_participants_unique_pair" UNIQUE ("split_id", "user_id"),
    CONSTRAINT "split_participants_allocated_nonneg" CHECK ("allocated_total_cents" >= 0),
    CONSTRAINT "split_participants_paid_nonneg" CHECK ("paid_total_cents" >= 0)
);
ALTER TABLE "public"."split_participants" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_participants" IS 'Every participant in a split (including the creator). (split_id, user_id) is the real identity used everywhere -- "payer belongs to this split"/"allocation belongs to this split" are validated inside the RPCs (see submit_split_expense''s doc comment), not enforced via a composite FK from split_receipts/split_item_allocations.';

CREATE INDEX "split_participants_user_idx" ON "public"."split_participants" ("user_id", "response_status");

ALTER TABLE "public"."split_participants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_participants" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_participants" TO "service_role";

-- ============================================================================
-- split_receipts: one row per receipt in the split, independently
-- persisted (deliberately not embedded as jsonb -- item allocations need
-- real per-row FKs).
-- ============================================================================
CREATE TABLE "public"."split_receipts" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "split_id" "uuid" NOT NULL REFERENCES "public"."split_expenses"("id") ON DELETE CASCADE,
    "merchant" "text",
    "receipt_date" "date" NOT NULL,
    -- Deliberately NOT ON DELETE CASCADE/SET NULL -- a category referenced
    -- by a submitted split should not silently vanish; categories are
    -- effectively immutable/undeleted in the current product (no delete UI
    -- exists), so RESTRICT (the implicit default) is the safe, simplest
    -- choice today.
    "category_id" integer NOT NULL REFERENCES "public"."categories"("id"),
    -- The amount actually being split -- SUM of this receipt's item line
    -- totals (tax/tip/fee/discount are NOT split in v1, exactly matching
    -- the existing frontend's receiptItemsSubtotalCents() design -- see
    -- docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the full
    -- rationale and limitation this documents).
    "receipt_total_cents" bigint NOT NULL,
    -- Plain FK to auth.users (ON DELETE CASCADE), deliberately NOT a
    -- composite FK against split_participants(split_id, user_id): an
    -- earlier draft of this migration used that composite FK for a
    -- DB-level "payer must be a participant of this split" guarantee, but
    -- it defaults to NO ACTION on delete, which would BLOCK account
    -- deletion (or any cleanup) for a user who was ever a receipt's payer
    -- -- deleting their split_participants row would fail with a foreign
    -- key violation while this receipt still referenced it. "Payer
    -- belongs to this split" is instead validated explicitly inside
    -- submit_split_expense() before any row is written (see the RPCs
    -- migration) -- the same RPC-only-validation choice already made for
    -- split_item_allocations.user_id below, for the same reason. If the
    -- payer's account is later deleted, this receipt (and its items/
    -- allocations) cascades away with it -- a documented v1 limitation,
    -- see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry.
    "payer_user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "split_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_receipts_total_positive" CHECK ("receipt_total_cents" > 0)
);
ALTER TABLE "public"."split_receipts" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_receipts" IS 'One row per receipt in a split. receipt_total_cents is the item-line-totals subtotal being split -- tax/tip/fee/discount are not currently split (v1 limitation, matches the frontend).';

CREATE INDEX "split_receipts_split_idx" ON "public"."split_receipts" ("split_id", "position");
CREATE INDEX "split_receipts_payer_idx" ON "public"."split_receipts" ("payer_user_id");

ALTER TABLE "public"."split_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_receipts" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_receipts" TO "service_role";

-- ============================================================================
-- split_receipt_items: normalized item lines for one receipt.
-- assignment_type is preserved for display/audit only -- real financial
-- responsibility always comes from split_item_allocations (see that
-- table's own header).
-- ============================================================================
CREATE TABLE "public"."split_receipt_items" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "receipt_id" "uuid" NOT NULL REFERENCES "public"."split_receipts"("id") ON DELETE CASCADE,
    "position" integer NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric NOT NULL DEFAULT 1,
    "line_total_cents" bigint NOT NULL,
    "assignment_type" "text" NOT NULL,
    CONSTRAINT "split_receipt_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_receipt_items_total_positive" CHECK ("line_total_cents" > 0),
    CONSTRAINT "split_receipt_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "split_receipt_items_assignment_type_check" CHECK ("assignment_type" = ANY (ARRAY['mine'::"text", 'someone_else'::"text", 'shared'::"text"]))
);
ALTER TABLE "public"."split_receipt_items" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_receipt_items" IS 'Normalized item lines for one receipt. assignment_type is descriptive only -- see split_item_allocations for the authoritative per-participant share.';

CREATE INDEX "split_receipt_items_receipt_idx" ON "public"."split_receipt_items" ("receipt_id", "position");

ALTER TABLE "public"."split_receipt_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_receipt_items" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_receipt_items" TO "service_role";

-- ============================================================================
-- split_item_allocations: the AUTHORITATIVE per-participant share of one
-- item, server-recomputed at submission time (never trusted from the
-- client -- see the RPCs migration). "No participant outside the split may
-- receive an allocation" is enforced by submit_split_expense() itself
-- (every id it allocates to comes from the same validated participant
-- set), not by an additional DB constraint here -- a direct composite FK
-- to split_participants would need to also thread receipt_id/split_id
-- through this table purely for that guarantee, which the RPC's own
-- validation already provides more simply.
-- ============================================================================
CREATE TABLE "public"."split_item_allocations" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "item_id" "uuid" NOT NULL REFERENCES "public"."split_receipt_items"("id") ON DELETE CASCADE,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "share_cents" bigint NOT NULL,
    CONSTRAINT "split_item_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_item_allocations_share_positive" CHECK ("share_cents" > 0),
    CONSTRAINT "split_item_allocations_unique_pair" UNIQUE ("item_id", "user_id")
);
ALTER TABLE "public"."split_item_allocations" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_item_allocations" IS 'Authoritative per-participant share of one receipt item, in integer cents, server-computed. SUM(share_cents) per item_id always equals that item''s line_total_cents.';

CREATE INDEX "split_item_allocations_item_idx" ON "public"."split_item_allocations" ("item_id");
CREATE INDEX "split_item_allocations_user_idx" ON "public"."split_item_allocations" ("user_id");

ALTER TABLE "public"."split_item_allocations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_item_allocations" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_item_allocations" TO "service_role";

-- ============================================================================
-- split_settlements: the authoritative, server-computed net settlement --
-- the smallest practical deterministic set of transfers across EVERY
-- receipt in the split (see submit_split_expense()'s settlement
-- computation in the RPCs migration). Nexali only ever documents who owes
-- whom -- no external payment processing exists or is implemented here.
-- ============================================================================
CREATE TABLE "public"."split_settlements" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "split_id" "uuid" NOT NULL REFERENCES "public"."split_expenses"("id") ON DELETE CASCADE,
    "from_user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "to_user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "amount_cents" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    -- Reserved for a future "mark paid back" affordance -- no such workflow
    -- exists in the approved frontend yet, so nothing currently sets this;
    -- see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry.
    "settled_at" timestamp with time zone,
    CONSTRAINT "split_settlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_settlements_amount_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "split_settlements_no_self_transfer" CHECK ("from_user_id" <> "to_user_id"),
    -- The settlement algorithm produces at most one net transfer per
    -- ordered (from, to) pair for a given split (see the RPCs migration).
    CONSTRAINT "split_settlements_unique_pair" UNIQUE ("split_id", "from_user_id", "to_user_id")
);
ALTER TABLE "public"."split_settlements" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_settlements" IS 'Authoritative net settlement transfers for a split -- documentation of who owes whom, never real payment processing.';

CREATE INDEX "split_settlements_split_idx" ON "public"."split_settlements" ("split_id");
CREATE INDEX "split_settlements_from_idx" ON "public"."split_settlements" ("from_user_id");
CREATE INDEX "split_settlements_to_idx" ON "public"."split_settlements" ("to_user_id");

ALTER TABLE "public"."split_settlements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_settlements" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_settlements" TO "service_role";

-- ============================================================================
-- split_generated_transactions: explicit provenance linking a real
-- transactions row to the split/receipt/participant it was generated
-- from -- idempotency + traceability, never inferred from note text alone.
-- ============================================================================
CREATE TABLE "public"."split_generated_transactions" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "split_id" "uuid" NOT NULL REFERENCES "public"."split_expenses"("id") ON DELETE CASCADE,
    "receipt_id" "uuid" NOT NULL REFERENCES "public"."split_receipts"("id") ON DELETE CASCADE,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- V1 decision (documented in docs/BACKEND_AUDIT_REPORT.md): generated
    -- transactions behave exactly like any other transaction -- editable
    -- and deletable via the existing Transactions page, with no new
    -- "locked" UI (which is not currently approved). ON DELETE CASCADE
    -- here means deleting the underlying transaction only removes this
    -- provenance row -- it does NOT retroactively alter the split's own
    -- historical participant/settlement records, which remain the
    -- permanent record of what was agreed.
    "transaction_id" integer NOT NULL REFERENCES "public"."transactions"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "split_generated_transactions_pkey" PRIMARY KEY ("id"),
    -- The real idempotency/duplicate-prevention backstop for transaction
    -- creation: at most one generated transaction per (receipt, user).
    CONSTRAINT "split_generated_transactions_unique_receipt_user" UNIQUE ("receipt_id", "user_id")
);
ALTER TABLE "public"."split_generated_transactions" OWNER TO "postgres";
COMMENT ON TABLE "public"."split_generated_transactions" IS 'Provenance linking one real transactions row to the split/receipt/participant it was generated from. UNIQUE(receipt_id, user_id) is the DB-level guarantee against duplicate transaction creation.';

CREATE INDEX "split_generated_transactions_split_idx" ON "public"."split_generated_transactions" ("split_id");
CREATE INDEX "split_generated_transactions_user_idx" ON "public"."split_generated_transactions" ("user_id");

ALTER TABLE "public"."split_generated_transactions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."split_generated_transactions" FROM PUBLIC;
GRANT ALL ON TABLE "public"."split_generated_transactions" TO "service_role";

-- ============================================================================
-- RLS helper functions (SECURITY DEFINER) -- see this file's header for
-- why these exist: they break the split_expenses <-> split_participants
-- mutual-policy-reference cycle, and are reused by every deeper table's
-- policy so none of them embed a raw cross-table EXISTS subquery either.
-- All are STABLE (safe to call multiple times per statement) and derive
-- the caller from auth.uid() only, never a parameter.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."_can_view_split"("p_split_id" "uuid")
RETURNS boolean
LANGUAGE "sql" SECURITY DEFINER STABLE
SET "search_path" TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."split_expenses" se WHERE se."id" = "p_split_id" AND se."created_by" = "auth"."uid"())
      OR EXISTS (SELECT 1 FROM "public"."split_participants" sp WHERE sp."split_id" = "p_split_id" AND sp."user_id" = "auth"."uid"());
$$;
ALTER FUNCTION "public"."_can_view_split"("p_split_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."_can_view_split"("p_split_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."_can_view_split"("p_split_id" "uuid") TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."_can_view_split_receipt"("p_receipt_id" "uuid")
RETURNS boolean
LANGUAGE "sql" SECURITY DEFINER STABLE
SET "search_path" TO 'public', 'pg_temp'
AS $$
  SELECT "public"."_can_view_split"(sr."split_id") FROM "public"."split_receipts" sr WHERE sr."id" = "p_receipt_id";
$$;
ALTER FUNCTION "public"."_can_view_split_receipt"("p_receipt_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."_can_view_split_receipt"("p_receipt_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."_can_view_split_receipt"("p_receipt_id" "uuid") TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."_can_view_split_item"("p_item_id" "uuid")
RETURNS boolean
LANGUAGE "sql" SECURITY DEFINER STABLE
SET "search_path" TO 'public', 'pg_temp'
AS $$
  SELECT "public"."_can_view_split"(sr."split_id")
  FROM "public"."split_receipt_items" sri
  JOIN "public"."split_receipts" sr ON sr."id" = sri."receipt_id"
  WHERE sri."id" = "p_item_id";
$$;
ALTER FUNCTION "public"."_can_view_split_item"("p_item_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."_can_view_split_item"("p_item_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."_can_view_split_item"("p_item_id" "uuid") TO "authenticated";

-- ============================================================================
-- Policies -- defensive-in-depth only (see the Friends backend's own
-- header for the established rationale): inert today since `authenticated`
-- has no direct table-level grant on any Split Expenses table at all,
-- every real read/write goes through the RPC-only surface.
-- ============================================================================
CREATE POLICY "Users can view splits they created or participate in" ON "public"."split_expenses"
    FOR SELECT USING ("public"."_can_view_split"("id"));

CREATE POLICY "Users can view participant rows in splits they can view" ON "public"."split_participants"
    FOR SELECT USING ("public"."_can_view_split"("split_id"));

CREATE POLICY "Users can view receipts in splits they can view" ON "public"."split_receipts"
    FOR SELECT USING ("public"."_can_view_split"("split_id"));

CREATE POLICY "Users can view items on receipts in splits they can view" ON "public"."split_receipt_items"
    FOR SELECT USING ("public"."_can_view_split_receipt"("receipt_id"));

CREATE POLICY "Users can view allocations in splits they can view" ON "public"."split_item_allocations"
    FOR SELECT USING ("public"."_can_view_split_item"("item_id"));

CREATE POLICY "Users can view settlements they are involved in" ON "public"."split_settlements"
    FOR SELECT USING (
        ("auth"."uid"() = "from_user_id") OR ("auth"."uid"() = "to_user_id") OR "public"."_can_view_split"("split_id")
    );

CREATE POLICY "Users can view provenance for their own generated transactions" ON "public"."split_generated_transactions"
    FOR SELECT USING ("auth"."uid"() = "user_id");
