-- Backend Part 7 fix: Settings' Save Changes action previously persisted
-- `profiles` (timezone/currency/date_format/number_format) and
-- `notification_preferences` (the four notification switches) via two
-- independent mutations (Promise.all(updateProfile.mutateAsync(...),
-- updatePreferences.mutateAsync(...))). If one request succeeded and the
-- other failed, Settings reported "Save failed" and preserved the user's
-- local edits, but part of the change had already been permanently
-- persisted -- a real partial-save bug, not just a UX nit.
--
-- Fix: one authenticated RPC, update_user_settings(), wrapping both
-- updates in the single implicit transaction a PL/pgSQL function call
-- already gets -- if either UPDATE fails (or the profile row is somehow
-- missing), the function raises and PostgreSQL rolls back EVERY change
-- from that call, including the other table's otherwise-successful write.
-- No explicit BEGIN/COMMIT is needed: a single top-level RPC call is
-- already one statement, hence one transaction.
--
-- This is a NEW migration, not an edit to 20260918000000/20260918000050/
-- 20260918000100 -- none of Backend Part 7's migrations have been deployed
-- yet, but this is a distinct concern (atomic Settings persistence) from
-- "define the notifications/preferences schema", "cascade-delete cleanup",
-- or "budget threshold producer", so it stays a separate, logically
-- coherent file rather than being folded into any of them.

CREATE OR REPLACE FUNCTION "public"."update_user_settings"(
    "p_timezone" "text",
    "p_currency" "text",
    "p_date_format" "text",
    "p_number_format" "text",
    "p_budget_approaching" boolean,
    "p_budget_exceeded" boolean,
    "p_monthly_summary" boolean,
    "p_account_security" boolean
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- No p_user_id parameter exists at all -- the authenticated caller's own
  -- identity is the only identity this function can ever act as. Fail
  -- safely (not silently) when there is no authenticated caller.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'update_user_settings requires an authenticated user';
  END IF;

  -- Explicit pre-validation of every enum-like value, mirroring the exact
  -- CHECK constraints already on these columns (profiles_currency_valid /
  -- profiles_date_format_valid / profiles_number_format_valid /
  -- profiles_timezone_valid) -- a clear, descriptive exception here rather
  -- than relying solely on the UPDATE hitting the constraint (both layers
  -- protect the data; this one gives a better error message).
  IF p_timezone IS NULL OR NOT public.is_valid_tz(p_timezone) THEN
    RAISE EXCEPTION 'update_user_settings: invalid timezone %', p_timezone;
  END IF;
  IF p_currency IS NULL OR p_currency <> ALL (ARRAY['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']) THEN
    RAISE EXCEPTION 'update_user_settings: invalid currency %', p_currency;
  END IF;
  IF p_date_format IS NULL OR p_date_format <> ALL (ARRAY['mdy', 'dmy', 'ymd']) THEN
    RAISE EXCEPTION 'update_user_settings: invalid date_format %', p_date_format;
  END IF;
  IF p_number_format IS NULL OR p_number_format <> ALL (ARRAY['standard', 'european', 'space']) THEN
    RAISE EXCEPTION 'update_user_settings: invalid number_format %', p_number_format;
  END IF;
  IF p_budget_approaching IS NULL OR p_budget_exceeded IS NULL OR p_monthly_summary IS NULL OR p_account_security IS NULL THEN
    RAISE EXCEPTION 'update_user_settings: notification preference values must not be null';
  END IF;

  -- SECURITY INVOKER: this UPDATE runs under the calling user's own
  -- privileges, so the existing "Users can update their own profile" RLS
  -- policy (auth.uid() = id) is what actually restricts the row -- the
  -- explicit WHERE id = v_uid below is belt-and-suspenders on top of that,
  -- matching the rest of this codebase's established pattern. Deliberately
  -- does NOT touch phone/location/financial_bio/full_name/avatar_url/
  -- budget_reset_cycle/reset_day -- those remain Profile page's own,
  -- separate, unchanged save path.
  UPDATE public.profiles
  SET "timezone" = p_timezone,
      "currency" = p_currency,
      "date_format" = p_date_format,
      "number_format" = p_number_format
  WHERE "id" = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_user_settings: no profile row found for the authenticated user';
  END IF;

  -- The Part 7 schema migration's handle_new_user() extension + backfill
  -- already guarantee a notification_preferences row exists for every real
  -- user, so normal operation is the UPDATE branch below. ON CONFLICT DO
  -- UPDATE is a safe, owner-scoped defensive fallback for the case where a
  -- row is somehow still missing -- it can only ever create/update THIS
  -- caller's own row (user_id is always v_uid, never client-supplied), and
  -- is covered by the same owner-scoped INSERT/UPDATE RLS policies as any
  -- other authenticated write to this table.
  INSERT INTO public.notification_preferences (
    "user_id", "budget_approaching", "budget_exceeded", "monthly_summary", "account_security"
  )
  VALUES (v_uid, p_budget_approaching, p_budget_exceeded, p_monthly_summary, p_account_security)
  ON CONFLICT ("user_id") DO UPDATE
  SET "budget_approaching" = EXCLUDED."budget_approaching",
      "budget_exceeded" = EXCLUDED."budget_exceeded",
      "monthly_summary" = EXCLUDED."monthly_summary",
      "account_security" = EXCLUDED."account_security";
END;
$$;

ALTER FUNCTION "public"."update_user_settings"("p_timezone" "text", "p_currency" "text", "p_date_format" "text", "p_number_format" "text", "p_budget_approaching" boolean, "p_budget_exceeded" boolean, "p_monthly_summary" boolean, "p_account_security" boolean) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."update_user_settings"("p_timezone" "text", "p_currency" "text", "p_date_format" "text", "p_number_format" "text", "p_budget_approaching" boolean, "p_budget_exceeded" boolean, "p_monthly_summary" boolean, "p_account_security" boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."update_user_settings"("p_timezone" "text", "p_currency" "text", "p_date_format" "text", "p_number_format" "text", "p_budget_approaching" boolean, "p_budget_exceeded" boolean, "p_monthly_summary" boolean, "p_account_security" boolean) TO "authenticated";
