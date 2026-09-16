-- Backend Part 8 (Friends) follow-up: delete_user_everything() runs BEFORE
-- the delete-user Edge Function's auth.admin.deleteUser() call (confirmed
-- by reading supabase/functions/delete-user/index.ts) and explicitly
-- deletes every app table row for p_user_id rather than depending on
-- delete-order-sensitive FK cascade timing -- the same established
-- discipline already extended for notifications/notification_preferences
-- in 20260918000050_delete_user_notifications_cleanup.sql.
--
-- friend_requests/friendships both already carry ON DELETE CASCADE FKs to
-- auth.users (see 20260919000000_friends_schema.sql), so they would be
-- cleaned up automatically once the auth user row itself is deleted --
-- this migration adds them to the explicit list purely to match that same
-- discipline, not because cascade alone would leave anything orphaned.
--
-- Only friend_requests/friendships are added here. notifications rows
-- referencing a deleted OTHER user's friend request already resolve
-- correctly via friend_request_id's own ON DELETE SET NULL (see
-- 20260919000100_friends_notification_integration.sql) -- deleting a
-- user's OWN notifications is already handled by the existing
-- `delete from notifications where user_id = p_user_id` line below.
CREATE OR REPLACE FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'delete_user_everything can only be called by the service role';
  end if;

  delete from friend_requests             where sender_id = p_user_id or recipient_id = p_user_id;
  delete from friendships                 where user_one_id = p_user_id or user_two_id = p_user_id;
  delete from notifications                where user_id = p_user_id;
  delete from notification_preferences    where user_id = p_user_id;
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
