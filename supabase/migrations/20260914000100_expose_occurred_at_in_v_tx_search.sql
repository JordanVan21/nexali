-- Backend Part 3 -- expose the new occurred_at column through the
-- transactions search view. created_at stays exposed too (still useful
-- audit metadata), it just stops being read as the financial date by the
-- application (see src/lib/transactions.ts).
--
-- security_invoker='on' is preserved exactly as before, so RLS on the
-- underlying transactions/categories tables continues to be enforced for
-- every caller through this view -- this migration does not change that
-- behavior in any way, only the selected columns.
--
-- occurred_at is appended at the END of the column list (after
-- category_type, not next to created_at) because PostgreSQL's
-- CREATE OR REPLACE VIEW only allows new columns to be added after all
-- existing ones -- it cannot reorder or insert a column among the
-- original set without dropping and recreating the view (which would
-- briefly drop its grants/dependents). Column order has no effect on any
-- current caller, since every query selects columns by name.
CREATE OR REPLACE VIEW "public"."v_tx_search" WITH ("security_invoker"='on') AS
 SELECT "t"."id",
    "t"."user_id",
    "t"."amount",
    "t"."category_id",
    "t"."merchant",
    "t"."note",
    "t"."created_at",
    "c"."name" AS "category_name",
    "c"."type" AS "category_type",
    "t"."occurred_at"
   FROM ("public"."transactions" "t"
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "t"."category_id")));
