-- Split Expenses backend, Part 3: RPCs.
--
-- Every function below follows the exact hardened pattern already
-- established in this codebase (Friends backend, update_user_settings,
-- the Backend Part 4/5 aggregate functions): identity is derived ONLY
-- from auth.uid() (never a client-supplied user id parameter),
-- auth.uid() IS NULL is rejected, SET search_path pins the search path,
-- every table reference is schema-qualified, REVOKE ALL FROM PUBLIC +
-- GRANT EXECUTE TO authenticated only (no anon grant). The two internal
-- helpers (_split_expense_summary, _compute_split_settlements) are never
-- granted to authenticated at all -- callable only from within another
-- SECURITY DEFINER function owned by the same role, never directly by a
-- client.
--
-- CRITICAL cross-user financial-write boundary (the whole reason this
-- migration exists in the shape it does): submit_split_expense() may only
-- ever create a TRANSACTION for auth.uid() (the submitting creator) --
-- every other participant's transactions are created ONLY when THEY
-- themselves call accept_split_expense(), which derives its own identity
-- from auth.uid() and can never be invoked "on behalf of" another user.
-- No function in this file accepts a p_user_id/participant id parameter
-- for whose account to act on.

CREATE TYPE "public"."split_balance_t" AS ("user_id" "uuid", "remaining" bigint);

-- ============================================================================
-- _compute_split_settlements(p_split_id): the authoritative, deterministic
-- debtor/creditor matching algorithm -- walks participants in their
-- submitted `position` order (the SAME stable order the frontend preview
-- uses), builds debtor/creditor lists, then repeatedly transfers
-- min(debtor remaining, creditor remaining) until both sides are
-- exhausted. Produces at most (participants with nonzero balance - 1)
-- transfers, matching lib/splitExpenses.ts's computeSettlements() exactly
-- (see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the
-- side-by-side comparison and the tests asserting frontend/backend
-- parity). Never called directly by a client -- always invoked from
-- within submit_split_expense(), which has already validated p_split_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."_compute_split_settlements"("p_split_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_debtors public.split_balance_t[] := '{}';
  v_creditors public.split_balance_t[] := '{}';
  v_bal record;
  v_di int := 1;
  v_ci int := 1;
  v_transfer bigint;
BEGIN
  FOR v_bal IN
    SELECT sp.user_id, (sp.paid_total_cents - sp.allocated_total_cents) AS net_cents
    FROM public.split_participants sp
    WHERE sp.split_id = p_split_id
    ORDER BY sp.position
  LOOP
    IF v_bal.net_cents < 0 THEN
      v_debtors := v_debtors || ROW(v_bal.user_id, -v_bal.net_cents)::public.split_balance_t;
    ELSIF v_bal.net_cents > 0 THEN
      v_creditors := v_creditors || ROW(v_bal.user_id, v_bal.net_cents)::public.split_balance_t;
    END IF;
  END LOOP;

  WHILE v_di <= COALESCE(array_length(v_debtors, 1), 0) AND v_ci <= COALESCE(array_length(v_creditors, 1), 0) LOOP
    v_transfer := LEAST(v_debtors[v_di].remaining, v_creditors[v_ci].remaining);
    IF v_transfer > 0 THEN
      INSERT INTO public.split_settlements (split_id, from_user_id, to_user_id, amount_cents)
      VALUES (p_split_id, v_debtors[v_di].user_id, v_creditors[v_ci].user_id, v_transfer);
      v_debtors[v_di].remaining := v_debtors[v_di].remaining - v_transfer;
      v_creditors[v_ci].remaining := v_creditors[v_ci].remaining - v_transfer;
    END IF;
    IF v_debtors[v_di].remaining = 0 THEN v_di := v_di + 1; END IF;
    IF v_creditors[v_ci].remaining = 0 THEN v_ci := v_ci + 1; END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION "public"."_compute_split_settlements"("p_split_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."_compute_split_settlements"("p_split_id" "uuid") FROM PUBLIC;

-- ============================================================================
-- _split_expense_summary(p_split_id): builds the authoritative response
-- summary (used by submit's idempotent-replay path and by
-- accept/decline's return value) -- split id/status/currency, creator's
-- own generated-transaction count, every participant's status/allocated/
-- paid/net totals, and every settlement transfer. Never exposes anything
-- beyond what the caller already validated access to.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."_split_expense_summary"("p_split_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'splitId', se.id,
    'status', se.status,
    'currency', se.currency,
    'creatorTransactionCount', (
      SELECT count(*) FROM public.split_generated_transactions sgt
      WHERE sgt.split_id = se.id AND sgt.user_id = se.created_by
    ),
    'participants', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'userId', sp.user_id,
        'position', sp.position,
        'responseStatus', sp.response_status,
        'allocatedTotalCents', sp.allocated_total_cents,
        'paidTotalCents', sp.paid_total_cents,
        'netCents', sp.paid_total_cents - sp.allocated_total_cents
      ) ORDER BY sp.position), '[]'::jsonb)
      FROM public.split_participants sp WHERE sp.split_id = se.id
    ),
    'settlements', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'fromUserId', ss.from_user_id,
        'toUserId', ss.to_user_id,
        'amountCents', ss.amount_cents
      )), '[]'::jsonb)
      FROM public.split_settlements ss WHERE ss.split_id = se.id
    )
  ) INTO v_result
  FROM public.split_expenses se
  WHERE se.id = p_split_id;

  RETURN v_result;
END;
$$;
ALTER FUNCTION "public"."_split_expense_summary"("p_split_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."_split_expense_summary"("p_split_id" "uuid") FROM PUBLIC;

-- ============================================================================
-- submit_split_expense(p_payload): the one authoritative submission RPC.
-- Accepts one structured jsonb payload (see docs/BACKEND_AUDIT_REPORT.md's
-- Split Expenses entry for the full documented shape) -- never dozens of
-- loose parameters, and never client-computed totals/settlements. Every
-- amount/allocation/settlement value in this function's OWN output is
-- recomputed server-side from the raw items/assignments the client sent;
-- the client's own preview numbers are informational only.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."submit_split_expense"("p_payload" "jsonb")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_idempotency_key uuid;
  v_currency text;
  v_creator_currency text;
  v_existing_id uuid;
  v_split_id uuid;
  v_participants jsonb;
  v_participant jsonb;
  v_participant_ids uuid[] := '{}';
  v_participant_id uuid;
  v_creator_included boolean := false;
  v_other_count int := 0;
  v_status text;
  v_receipts jsonb;
  v_receipt jsonb;
  v_receipt_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_item_id uuid;
  v_category record;
  v_receipt_items_sum bigint;
  v_receipt_total bigint;
  v_participant_ids_in_item uuid[];
  v_n int;
  v_assignment_type text;
  v_payer uuid;
  v_receipt_date date;
  v_position int;
  v_creator_name text;
  v_creator_tx_count int := 0;
  v_gen_row record;
  v_tx_id integer;
  v_occurred_at timestamptz;
  v_target_tz text;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'submit_split_expense requires an authenticated user';
  END IF;

  -- ============ Idempotency: replay check FIRST, before any validation
  -- or write, so a retried request never partially re-validates against
  -- possibly-changed state (a friend removed between attempts, etc.) --
  -- it simply returns the original result. ============
  BEGIN
    v_idempotency_key := (p_payload->>'idempotencyKey')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid idempotencyKey is required';
  END;
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A valid idempotencyKey is required';
  END IF;

  SELECT id INTO v_existing_id FROM public.split_expenses WHERE created_by = v_uid AND idempotency_key = v_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN public._split_expense_summary(v_existing_id);
  END IF;

  -- ============ Currency: creator's own configured currency is
  -- authoritative; the payload's currency must match it (catches a stale
  -- frontend), and every OTHER participant's configured currency must
  -- match too -- no FX conversion exists. ============
  v_currency := p_payload->>'currency';
  SELECT currency INTO v_creator_currency FROM public.profiles WHERE id = v_uid;
  IF v_currency IS NULL OR v_currency <> v_creator_currency THEN
    RAISE EXCEPTION 'Split Expenses currently requires all participants to use the same currency.';
  END IF;

  -- ============ Participants ============
  v_participants := p_payload->'participants';
  IF v_participants IS NULL OR jsonb_typeof(v_participants) <> 'array' OR jsonb_array_length(v_participants) = 0 THEN
    RAISE EXCEPTION 'At least one participant is required';
  END IF;

  FOR v_participant IN SELECT * FROM jsonb_array_elements(v_participants)
  LOOP
    BEGIN
      v_participant_id := (v_participant->>'userId')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Every participant requires a valid userId';
    END;
    IF v_participant_id IS NULL THEN
      RAISE EXCEPTION 'Every participant requires a valid userId';
    END IF;
    IF v_participant_id = ANY(v_participant_ids) THEN
      RAISE EXCEPTION 'Duplicate participant in submission';
    END IF;
    v_participant_ids := v_participant_ids || v_participant_id;

    IF v_participant_id = v_uid THEN
      v_creator_included := true;
    ELSE
      -- Re-validated against the REAL, current friendship state --
      -- never the frontend's (possibly stale) Friends list.
      IF NOT EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.user_one_id = LEAST(v_uid, v_participant_id) AND f.user_two_id = GREATEST(v_uid, v_participant_id)
      ) THEN
        RAISE EXCEPTION 'One or more participants are not your accepted Nexali friends';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_participant_id AND p.currency = v_creator_currency) THEN
        RAISE EXCEPTION 'Split Expenses currently requires all participants to use the same currency.';
      END IF;
      v_other_count := v_other_count + 1;
    END IF;
  END LOOP;

  IF NOT v_creator_included THEN
    RAISE EXCEPTION 'The split creator must be included as a participant exactly once';
  END IF;

  -- ============ Receipts (top-level presence check before writing anything) ============
  v_receipts := p_payload->'receipts';
  IF v_receipts IS NULL OR jsonb_typeof(v_receipts) <> 'array' OR jsonb_array_length(v_receipts) = 0 THEN
    RAISE EXCEPTION 'At least one receipt is required';
  END IF;

  -- ============ Insert split_expenses + split_participants ============
  -- Creator-only split (no other participants): no approval workflow is
  -- necessary -- immediately 'accepted'. Otherwise 'submitted' (some
  -- participants pending).
  v_status := CASE WHEN v_other_count = 0 THEN 'accepted' ELSE 'submitted' END;

  INSERT INTO public.split_expenses (created_by, currency, status, idempotency_key, submitted_at)
  VALUES (v_uid, v_currency, v_status, v_idempotency_key, v_now)
  RETURNING id INTO v_split_id;

  FOR v_participant IN SELECT * FROM jsonb_array_elements(v_participants)
  LOOP
    v_participant_id := (v_participant->>'userId')::uuid;
    v_position := COALESCE((v_participant->>'position')::int, 0);
    INSERT INTO public.split_participants (split_id, user_id, position, response_status, responded_at)
    VALUES (
      v_split_id, v_participant_id, v_position,
      -- The creator does not approve their own submission.
      CASE WHEN v_participant_id = v_uid THEN 'accepted' ELSE 'pending' END,
      CASE WHEN v_participant_id = v_uid THEN v_now ELSE NULL END
    );
  END LOOP;

  -- ============ Receipts + items + allocations ============
  FOR v_receipt IN SELECT * FROM jsonb_array_elements(v_receipts)
  LOOP
    BEGIN
      v_payer := (v_receipt->>'payerUserId')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Each receipt requires a valid payer';
    END;
    IF v_payer IS NULL OR NOT (v_payer = ANY(v_participant_ids)) THEN
      RAISE EXCEPTION 'Each receipt''s payer must be a participant in this split';
    END IF;

    BEGIN
      v_receipt_date := (v_receipt->>'receiptDate')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Each receipt requires a valid receipt date';
    END;
    IF v_receipt_date IS NULL THEN
      RAISE EXCEPTION 'Each receipt requires a valid receipt date';
    END IF;

    SELECT id, type, user_id INTO v_category FROM public.categories WHERE id = NULLIF(v_receipt->>'categoryId', '')::int;
    IF v_category.id IS NULL THEN
      RAISE EXCEPTION 'Selected category does not exist';
    END IF;
    IF v_category.type <> 'expense' THEN
      RAISE EXCEPTION 'Split Expenses categories must be expense categories';
    END IF;
    IF v_category.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Split Expenses requires a category available to every participant -- choose a global category';
    END IF;

    v_receipt_total := NULLIF(v_receipt->>'totalCents', '')::bigint;
    IF v_receipt_total IS NULL OR v_receipt_total <= 0 THEN
      RAISE EXCEPTION 'Each receipt requires a positive total';
    END IF;

    v_items := v_receipt->'items';
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
      RAISE EXCEPTION 'Each receipt requires at least one item';
    END IF;

    INSERT INTO public.split_receipts (split_id, merchant, receipt_date, category_id, receipt_total_cents, payer_user_id, position)
    VALUES (v_split_id, v_receipt->>'merchant', v_receipt_date, v_category.id, v_receipt_total, v_payer, COALESCE((v_receipt->>'position')::int, 0))
    RETURNING id INTO v_receipt_id;

    v_receipt_items_sum := 0;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      v_assignment_type := v_item->>'assignmentType';
      IF v_assignment_type NOT IN ('mine', 'someone_else', 'shared') THEN
        RAISE EXCEPTION 'Invalid item assignment type';
      END IF;

      SELECT array_agg(value::uuid) INTO v_participant_ids_in_item
      FROM jsonb_array_elements_text(COALESCE(v_item->'participantIds', '[]'::jsonb));
      v_n := COALESCE(array_length(v_participant_ids_in_item, 1), 0);

      IF v_assignment_type = 'mine' THEN
        IF v_n <> 1 OR v_participant_ids_in_item[1] <> v_uid THEN
          RAISE EXCEPTION 'A "mine" item must be assigned to exactly the split creator';
        END IF;
      ELSIF v_assignment_type = 'someone_else' THEN
        IF v_n <> 1 THEN
          RAISE EXCEPTION 'A "someone_else" item must be assigned to exactly one participant';
        END IF;
      ELSIF v_assignment_type = 'shared' THEN
        IF v_n < 2 THEN
          RAISE EXCEPTION 'A "shared" item must be assigned to at least two participants';
        END IF;
        IF v_n <> (SELECT count(DISTINCT x) FROM unnest(v_participant_ids_in_item) x) THEN
          RAISE EXCEPTION 'A "shared" item cannot list the same participant twice';
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM unnest(v_participant_ids_in_item) x WHERE NOT (x = ANY(v_participant_ids))) THEN
        RAISE EXCEPTION 'An item cannot be assigned to someone outside this split';
      END IF;

      DECLARE
        v_line_total bigint;
      BEGIN
        v_line_total := NULLIF(v_item->>'lineTotalCents', '')::bigint;
        IF v_line_total IS NULL OR v_line_total <= 0 THEN
          RAISE EXCEPTION 'Each item requires a positive line total';
        END IF;

        INSERT INTO public.split_receipt_items (receipt_id, position, description, quantity, line_total_cents, assignment_type)
        VALUES (
          v_receipt_id, COALESCE((v_item->>'position')::int, 0), COALESCE(v_item->>'description', 'Item'),
          COALESCE((v_item->>'quantity')::numeric, 1), v_line_total, v_assignment_type
        )
        RETURNING id INTO v_item_id;

        v_receipt_items_sum := v_receipt_items_sum + v_line_total;

        -- Server-authoritative deterministic equal-cents distribution:
        -- base = floor(total/n), and the first `remainder` participants
        -- IN THE EXACT ARRAY ORDER THE CLIENT SENT for this item each get
        -- one extra cent -- the SAME algorithm as the frontend's
        -- splitCentsEqually(). n=1 (mine/someone_else) degenerates to
        -- "the one participant gets the full amount", so this one
        -- INSERT...SELECT covers all three assignment types uniformly.
        INSERT INTO public.split_item_allocations (item_id, user_id, share_cents)
        SELECT
          v_item_id,
          elem.value::uuid,
          (v_line_total / v_n) + (CASE WHEN elem.ord <= (v_line_total % v_n) THEN 1 ELSE 0 END)
        FROM jsonb_array_elements_text(v_item->'participantIds') WITH ORDINALITY AS elem(value, ord);
      END;
    END LOOP;

    IF v_receipt_items_sum <> v_receipt_total THEN
      RAISE EXCEPTION 'Receipt items do not add up to the receipt total';
    END IF;
  END LOOP;

  -- ============ Participant totals: allocated (economic responsibility)
  -- and paid (sum of receipts where they were the payer). ============
  UPDATE public.split_participants sp
  SET allocated_total_cents = COALESCE((
    SELECT sum(sia.share_cents)
    FROM public.split_item_allocations sia
    JOIN public.split_receipt_items sri ON sri.id = sia.item_id
    JOIN public.split_receipts sr ON sr.id = sri.receipt_id
    WHERE sr.split_id = v_split_id AND sia.user_id = sp.user_id
  ), 0)
  WHERE sp.split_id = v_split_id;

  UPDATE public.split_participants sp
  SET paid_total_cents = COALESCE((
    SELECT sum(sr.receipt_total_cents)
    FROM public.split_receipts sr
    WHERE sr.split_id = v_split_id AND sr.payer_user_id = sp.user_id
  ), 0)
  WHERE sp.split_id = v_split_id;

  -- Safety-net reconciliation check -- guaranteed true by construction
  -- (one payer per receipt pays exactly that receipt's total; every
  -- item's shares sum to exactly its own line total), verified rather
  -- than assumed.
  IF (SELECT sum(paid_total_cents) FROM public.split_participants WHERE split_id = v_split_id)
     <> (SELECT sum(allocated_total_cents) FROM public.split_participants WHERE split_id = v_split_id) THEN
    RAISE EXCEPTION 'Split totals do not reconcile';
  END IF;

  -- ============ Settlement computation (net across ALL receipts) ============
  PERFORM public._compute_split_settlements(v_split_id);

  -- ============ Creator's own transactions -- created immediately, in
  -- this SAME atomic submission. One transaction per receipt where the
  -- creator's allocated share > 0 (never one per item -- see the RPCs
  -- migration header). If any of this fails, the whole submission rolls
  -- back, including the split/participants/receipts/items/allocations/
  -- settlements already inserted above -- no partial submission. ============
  SELECT COALESCE(timezone, 'UTC') INTO v_target_tz FROM public.profiles WHERE id = v_uid;

  FOR v_gen_row IN
    SELECT sr.id AS receipt_id, sr.merchant, sr.receipt_date, sr.category_id, sum(sia.share_cents) AS share_cents
    FROM public.split_receipts sr
    JOIN public.split_receipt_items sri ON sri.receipt_id = sr.id
    JOIN public.split_item_allocations sia ON sia.item_id = sri.id AND sia.user_id = v_uid
    WHERE sr.split_id = v_split_id
    GROUP BY sr.id, sr.merchant, sr.receipt_date, sr.category_id
  LOOP
    IF (v_gen_row.share_cents::numeric / 100) > 99999999.99 THEN
      RAISE EXCEPTION 'Transaction amount exceeds the allowed range';
    END IF;

    -- Receipt calendar date, anchored to noon in the TARGET user's
    -- (here, the creator's own) configured timezone -- never the
    -- submitter's browser timezone -- matching Backend Part 4's
    -- established occurred_at semantics (transactionDate.ts's
    -- occurredAtFromZonedDateInput, replicated server-side here).
    v_occurred_at := (v_gen_row.receipt_date + time '12:00') AT TIME ZONE v_target_tz;

    INSERT INTO public.transactions (user_id, category_id, amount, merchant, occurred_at, note)
    VALUES (v_uid, v_gen_row.category_id, (v_gen_row.share_cents::numeric / 100), v_gen_row.merchant, v_occurred_at, 'Split expense')
    RETURNING id INTO v_tx_id;

    INSERT INTO public.split_generated_transactions (split_id, receipt_id, user_id, transaction_id)
    VALUES (v_split_id, v_gen_row.receipt_id, v_uid, v_tx_id);

    v_creator_tx_count := v_creator_tx_count + 1;
  END LOOP;

  -- ============ Notify every OTHER participant. One actionable
  -- notification per participant (never per receipt), dedupe-keyed so a
  -- retried submission (caught by the idempotency check above in the
  -- normal case) can never double-notify even in a genuine race. Shows
  -- only the recipient's OWN allocated share -- never the group's total
  -- spend or another participant's amount. ============
  SELECT full_name INTO v_creator_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.notifications (user_id, type, title, description, dedupe_key, split_expense_id)
  SELECT
    sp.user_id,
    'split_expense',
    'Split Expense',
    COALESCE(v_creator_name, 'A friend') || ' added you to a split expense. Your share is '
      || to_char(sp.allocated_total_cents / 100.0, 'FM999999990.00') || ' ' || v_currency || '.',
    'split:' || v_split_id::text || ':participant:' || sp.user_id::text,
    v_split_id
  FROM public.split_participants sp
  WHERE sp.split_id = v_split_id AND sp.user_id <> v_uid;

  RETURN public._split_expense_summary(v_split_id);
END;
$$;
ALTER FUNCTION "public"."submit_split_expense"("p_payload" "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."submit_split_expense"("p_payload" "jsonb") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."submit_split_expense"("p_payload" "jsonb") TO "authenticated";

-- ============================================================================
-- accept_split_expense(p_split_id): the ONLY trusted path that can ever
-- create a generated transaction for a non-creator participant -- and
-- only for the CALLER themselves (auth.uid()). Row-locks the caller's own
-- participant row (FOR UPDATE) so a double-click/concurrent accept in two
-- tabs serializes instead of racing; idempotent on an already-accepted
-- participant (safe no-op, never a duplicate transaction).
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."accept_split_expense"("p_split_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_participant record;
  v_row record;
  v_tx_id integer;
  v_occurred_at timestamptz;
  v_target_tz text;
  v_all_accepted boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'accept_split_expense requires an authenticated user';
  END IF;

  -- The WHERE clause itself is the cross-user authorization boundary:
  -- auth.uid() = user_id is required to find any row at all -- there is
  -- no way for the creator (or anyone else) to accept on this caller's
  -- behalf.
  SELECT * INTO v_participant FROM public.split_participants WHERE split_id = p_split_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant in this split expense';
  END IF;

  IF v_participant.response_status = 'accepted' THEN
    RETURN public._split_expense_summary(p_split_id);
  END IF;
  IF v_participant.response_status = 'declined' THEN
    RAISE EXCEPTION 'This split expense was already declined';
  END IF;

  UPDATE public.split_participants SET response_status = 'accepted', responded_at = now() WHERE id = v_participant.id;

  SELECT COALESCE(timezone, 'UTC') INTO v_target_tz FROM public.profiles WHERE id = v_uid;

  FOR v_row IN
    SELECT sr.id AS receipt_id, sr.merchant, sr.receipt_date, sr.category_id, sum(sia.share_cents) AS share_cents
    FROM public.split_receipts sr
    JOIN public.split_receipt_items sri ON sri.receipt_id = sr.id
    JOIN public.split_item_allocations sia ON sia.item_id = sri.id AND sia.user_id = v_uid
    WHERE sr.split_id = p_split_id
    GROUP BY sr.id, sr.merchant, sr.receipt_date, sr.category_id
  LOOP
    IF (v_row.share_cents::numeric / 100) > 99999999.99 THEN
      RAISE EXCEPTION 'Transaction amount exceeds the allowed range';
    END IF;

    v_occurred_at := (v_row.receipt_date + time '12:00') AT TIME ZONE v_target_tz;

    INSERT INTO public.transactions (user_id, category_id, amount, merchant, occurred_at, note)
    VALUES (v_uid, v_row.category_id, (v_row.share_cents::numeric / 100), v_row.merchant, v_occurred_at, 'Split expense')
    RETURNING id INTO v_tx_id;

    -- ON CONFLICT DO NOTHING: the real, DB-level duplicate-transaction
    -- backstop (UNIQUE(receipt_id, user_id)) -- belt-and-suspenders on
    -- top of the already-accepted early-return above.
    INSERT INTO public.split_generated_transactions (split_id, receipt_id, user_id, transaction_id)
    VALUES (p_split_id, v_row.receipt_id, v_uid, v_tx_id)
    ON CONFLICT (receipt_id, user_id) DO NOTHING;
  END LOOP;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now()), dismissed_at = COALESCE(dismissed_at, now())
  WHERE split_expense_id = v_participant.split_id AND user_id = v_uid;

  -- Finalize once every non-creator participant has accepted -- unless
  -- someone else already declined (status stays 'needs_attention' --
  -- never silently overwritten back to 'accepted').
  SELECT NOT EXISTS (
    SELECT 1 FROM public.split_participants sp
    JOIN public.split_expenses se ON se.id = sp.split_id
    WHERE sp.split_id = p_split_id AND sp.user_id <> se.created_by AND sp.response_status <> 'accepted'
  ) INTO v_all_accepted;

  IF v_all_accepted THEN
    UPDATE public.split_expenses SET status = 'accepted' WHERE id = p_split_id AND status <> 'needs_attention';
  END IF;

  RETURN public._split_expense_summary(p_split_id);
END;
$$;
ALTER FUNCTION "public"."accept_split_expense"("p_split_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."accept_split_expense"("p_split_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."accept_split_expense"("p_split_id" "uuid") TO "authenticated";

-- ============================================================================
-- decline_split_expense(p_split_id): mirrors accept_split_expense()'s
-- authorization shape exactly, minus any transaction creation. Declining
-- an already-ACCEPTED participation is rejected (real transactions
-- already exist by then; reversing them is out of scope for v1) rather
-- than silently no-op'd or silently reversed. Never automatically
-- re-allocates the declining participant's share to anyone else -- the
-- creator must see the split as needing attention and decide what to do
-- (a future edit/resubmit flow), never a silent recalculation.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."decline_split_expense"("p_split_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_participant record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'decline_split_expense requires an authenticated user';
  END IF;

  SELECT * INTO v_participant FROM public.split_participants WHERE split_id = p_split_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant in this split expense';
  END IF;

  IF v_participant.response_status = 'declined' THEN
    RETURN public._split_expense_summary(p_split_id);
  END IF;
  IF v_participant.response_status = 'accepted' THEN
    RAISE EXCEPTION 'This split expense was already accepted -- it cannot be declined afterward';
  END IF;

  UPDATE public.split_participants SET response_status = 'declined', responded_at = now() WHERE id = v_participant.id;
  UPDATE public.split_expenses SET status = 'needs_attention' WHERE id = p_split_id;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now()), dismissed_at = COALESCE(dismissed_at, now())
  WHERE split_expense_id = v_participant.split_id AND user_id = v_uid;

  RETURN public._split_expense_summary(p_split_id);
END;
$$;
ALTER FUNCTION "public"."decline_split_expense"("p_split_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."decline_split_expense"("p_split_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."decline_split_expense"("p_split_id" "uuid") TO "authenticated";
