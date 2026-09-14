-- Backend Part 7 follow-up: delete_user_everything() (20260913000000) runs
-- BEFORE the delete-user Edge Function's auth.admin.deleteUser() call, and
-- explicitly deletes every app table row for p_user_id rather than relying
-- solely on each table's ON DELETE CASCADE FK to auth.users (which only
-- fires once the auth user row itself is deleted, later in the same
-- request). notifications/notification_preferences both carry that same
-- CASCADE FK (see 20260918000000_notifications_schema.sql), so they would
-- eventually be cleaned up regardless -- but they are added here explicitly
-- to match the function's own established discipline of not depending on
-- delete-order-sensitive cascade timing, consistent with every other table
-- it already lists.
CREATE OR REPLACE FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'delete_user_everything can only be called by the service role';
  end if;

  delete from notifications              where user_id = p_user_id;
  delete from notification_preferences   where user_id = p_user_id;
  delete from transactions where user_id = p_user_id;
  delete from budgets      where user_id = p_user_id;
  delete from categories   where user_id = p_user_id;
  delete from profiles     where id      = p_user_id;
end;
$$;

ALTER FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") TO "service_role";
