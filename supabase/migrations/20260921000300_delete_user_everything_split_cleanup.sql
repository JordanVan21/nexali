-- Split Expenses backend follow-up: extend delete_user_everything() to
-- explicitly clean up Split Expenses rows, matching the same
-- delete-order-independent discipline already established for Friends
-- (20260919000300) and Notifications (20260918000050) -- every relevant
-- Split Expenses FK already carries ON DELETE CASCADE to auth.users (see
-- 20260921000000_split_expenses_schema.sql), so these rows would be
-- cleaned up automatically once the delete-user Edge Function's
-- auth.admin.deleteUser() call runs -- but delete_user_everything() runs
-- BEFORE that call and explicitly deletes every other app table row for
-- p_user_id rather than depending on cascade timing, so these are added
-- here purely to match that same discipline.
--
-- Order: split_generated_transactions/split_settlements/
-- split_item_allocations first (a user's involvement as a mere
-- participant/allocatee/settlement party in someone ELSE's split), then
-- split_receipts (as payer) and split_participants (as participant),
-- then split_expenses (splits THEY created -- cascades away their own
-- receipts/items/allocations/settlements/provenance rows that weren't
-- already explicitly removed above). This mirrors
-- split_receipts.payer_user_id's documented v1 limitation: if this user
-- was ever a receipt's payer, that receipt (and its items/allocations)
-- is removed here even if other participants had already accepted and
-- have real, UNTOUCHED transactions for other receipts in the same
-- split.
CREATE OR REPLACE FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'delete_user_everything can only be called by the service role';
  end if;

  delete from split_generated_transactions where user_id = p_user_id;
  delete from split_settlements            where from_user_id = p_user_id or to_user_id = p_user_id;
  delete from split_item_allocations       where user_id = p_user_id;
  delete from split_receipts               where payer_user_id = p_user_id;
  delete from split_participants           where user_id = p_user_id;
  delete from split_expenses               where created_by = p_user_id;
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
