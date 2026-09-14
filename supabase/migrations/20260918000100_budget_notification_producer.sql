-- Backend Part 7: idempotent budget approaching/exceeded notification
-- producer. Classified (Part K of the task spec) as the one notification
-- type feasible to implement correctly in v1, since Nexali already has
-- real transactions/budgets/occurred_at/profiles.timezone and the exact
-- threshold math (src/lib/budgetMath.ts). Monthly-summary and
-- account/security producers remain deferred -- see
-- docs/BACKEND_AUDIT_REPORT.md Backend Part 7 for why.
--
-- Threshold semantics (locked in against the REAL, already-shipped
-- src/lib/budgetMath.ts constants, not invented separately):
--   BUDGET_WARNING_THRESHOLD  = 0.75  -> "approaching" fires on crossing INTO >= 75%
--   BUDGET_CRITICAL_THRESHOLD = 0.95  -> not used by a producer (no separate
--                                        "critical" notification type exists
--                                        in the frontend's NotificationType
--                                        union -- only financial/security/
--                                        system/assistant do)
--   isOverBudget (spent > amount)     -> "exceeded" fires on crossing INTO > 100%
-- "Approaching" and "exceeded" are independent events (both preference-
-- gated separately, both dedupe-keyed separately) -- a budget that jumps
-- straight from 50% to 120% spent in one transaction legitimately produces
-- BOTH notifications at once, since it crossed both lines.
--
-- Idempotency: UNIQUE (user_id, dedupe_key) on notifications (see
-- 20260918000000) + INSERT ... ON CONFLICT DO NOTHING. dedupe_key embeds
-- the budget id AND the year-month period
-- (budget:<budget_id>:<year>-<month>:approaching|exceeded), so: (a)
-- repeated transaction edits within the same period never produce
-- duplicate notifications, and (b) a new period (e.g. October after a
-- September "exceeded") always gets a fresh chance to notify, since it is
-- a different dedupe_key entirely. v1 policy is intentionally strict:
-- once a given (budget, period, type) notification exists, it is never
-- produced again even if the user deletes the triggering transaction and
-- re-exceeds later in the same period -- no event-state machinery is
-- built to support a second notification, matching the task spec's
-- explicitly-acceptable v1 policy.
--
-- Trigger points: transactions AFTER INSERT OR UPDATE, and budgets AFTER
-- INSERT OR UPDATE. Deliberately NOT AFTER DELETE on transactions:
-- deleting/lowering spend can only ever DECREASE a budget's ratio, and
-- notifications are only ever produced on crossing INTO a threshold from
-- below -- removing a transaction can never newly cross a threshold, so
-- there is nothing for a delete trigger to detect. (It also cannot
-- "un-notify" under the v1 dedupe policy, by design -- see above.)

-- ============================================================================
-- evaluate_budget_notifications: recomputes one budget's real spend for
-- its own category/period and inserts approaching/exceeded notifications
-- on crossing. SECURITY DEFINER (owned by postgres, same trusted-producer
-- pattern as handle_new_user()) so it can INSERT into notifications despite
-- authenticated users having no INSERT grant there. Only ever invoked from
-- the trigger functions below (which run as their own owner, not the
-- end-user's role) -- EXECUTE is revoked from anon/authenticated so a
-- browser can never call this directly with an arbitrary p_user_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."evaluate_budget_notifications"("p_user_id" "uuid", "p_category_id" integer, "p_year" integer, "p_month" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_budget record;
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_spent numeric;
  v_ratio numeric;
  v_prefs record;
  v_period_label text;
BEGIN
  IF p_category_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT b.id, b.amount, c.name AS category_name INTO v_budget
  FROM public.budgets b
  JOIN public.categories c ON c.id = b.category_id
  WHERE b.user_id = p_user_id AND b.category_id = p_category_id AND b.year = p_year AND b.month = p_month
  LIMIT 1;

  IF NOT FOUND OR v_budget.amount <= 0 THEN
    RETURN;
  END IF;

  SELECT budget_approaching, budget_exceeded INTO v_prefs
  FROM public.notification_preferences WHERE user_id = p_user_id;

  -- No preferences row on record -> fail safe, do not notify (should not
  -- happen post-backfill/handle_new_user(), but never invent a default here).
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_prefs.budget_approaching AND NOT v_prefs.budget_exceeded THEN
    RETURN;
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = p_user_id;
  v_tz := COALESCE(v_tz, 'UTC');
  v_start := make_timestamp(p_year, p_month, 1, 0, 0, 0) AT TIME ZONE v_tz;
  v_end := v_start + interval '1 month';

  SELECT COALESCE(SUM(t.amount), 0) INTO v_spent
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id AND c.type = 'expense' AND t.category_id = p_category_id
    AND t.occurred_at >= v_start AND t.occurred_at < v_end;

  v_ratio := v_spent / v_budget.amount;
  v_period_label := trim(to_char(v_start AT TIME ZONE v_tz, 'FMMonth YYYY'));

  IF v_prefs.budget_approaching AND v_ratio >= 0.75 THEN
    INSERT INTO public.notifications (user_id, type, title, description, action_href, action_label, dedupe_key)
    VALUES (
      p_user_id, 'financial', 'Budget approaching limit',
      format('You''ve used %s%% of your %s budget for %s.', round(v_ratio * 100)::int, v_budget.category_name, v_period_label),
      '/budgets', 'View budget',
      format('budget:%s:%s-%s:approaching', v_budget.id, p_year, lpad(p_month::text, 2, '0'))
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;

  IF v_prefs.budget_exceeded AND v_ratio > 1 THEN
    INSERT INTO public.notifications (user_id, type, title, description, action_href, action_label, dedupe_key)
    VALUES (
      p_user_id, 'financial', 'Budget exceeded',
      format('You''ve exceeded your %s budget for %s (%s%% used).', v_budget.category_name, v_period_label, round(v_ratio * 100)::int),
      '/budgets', 'View budget',
      format('budget:%s:%s-%s:exceeded', v_budget.id, p_year, lpad(p_month::text, 2, '0'))
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;
END;
$$;

ALTER FUNCTION "public"."evaluate_budget_notifications"("p_user_id" "uuid", "p_category_id" integer, "p_year" integer, "p_month" integer) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."evaluate_budget_notifications"("p_user_id" "uuid", "p_category_id" integer, "p_year" integer, "p_month" integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."evaluate_budget_notifications"("p_user_id" "uuid", "p_category_id" integer, "p_year" integer, "p_month" integer) TO "service_role";

-- ============================================================================
-- Trigger glue: transactions (an insert, or an edit that could change
-- amount/category/date) and budgets (a new budget, or a lowered amount,
-- against a category that already has spend this period) both re-evaluate
-- the ONE (category, period) they now describe.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."tg_transactions_notify_budgets"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_tz text;
  v_local timestamp;
  v_is_expense boolean;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (c.type = 'expense') INTO v_is_expense FROM public.categories c WHERE c.id = NEW.category_id;
  IF v_is_expense IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = NEW.user_id;
  v_tz := COALESCE(v_tz, 'UTC');
  v_local := NEW.occurred_at AT TIME ZONE v_tz;

  PERFORM public.evaluate_budget_notifications(NEW.user_id, NEW.category_id, extract(year FROM v_local)::int, extract(month FROM v_local)::int);

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_transactions_notify_budgets"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."tg_transactions_notify_budgets"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."tg_transactions_notify_budgets"() TO "service_role";

CREATE TRIGGER "transactions_notify_budgets"
    AFTER INSERT OR UPDATE ON "public"."transactions"
    FOR EACH ROW EXECUTE FUNCTION "public"."tg_transactions_notify_budgets"();

CREATE OR REPLACE FUNCTION "public"."tg_budgets_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.evaluate_budget_notifications(NEW.user_id, NEW.category_id, NEW.year, NEW.month);

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_budgets_notify"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."tg_budgets_notify"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."tg_budgets_notify"() TO "service_role";

CREATE TRIGGER "budgets_notify_on_change"
    AFTER INSERT OR UPDATE ON "public"."budgets"
    FOR EACH ROW EXECUTE FUNCTION "public"."tg_budgets_notify"();
