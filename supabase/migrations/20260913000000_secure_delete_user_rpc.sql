-- Backend Part 2 — P0 fix.
--
-- delete_user_everything(p_user_id uuid) is SECURITY DEFINER (runs as the
-- function owner, bypassing RLS entirely) and trusts p_user_id with no
-- internal ownership check. The baseline migration
-- (20260910235021_remote_schema.sql) granted EXECUTE to "anon" and
-- "authenticated" in addition to "service_role":
--
--   REVOKE ALL ON FUNCTION public.delete_user_everything(uuid) FROM PUBLIC;
--   GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO anon;
--   GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO authenticated;
--   GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO service_role;
--
-- Because the function is SECURITY DEFINER, any anon/authenticated caller
-- (i.e. anyone holding only the public anon key) could call
-- supabase.rpc('delete_user_everything', { p_user_id: '<any-uuid>' })
-- directly and permanently delete another user's transactions, budgets,
-- categories, and profile row, with RLS never getting a chance to stop it.
--
-- The only legitimate caller is the "delete-user" Edge Function, which
-- already verifies the requester's JWT and rejects a mismatched id (403)
-- before invoking this RPC through its service-role admin client. That
-- check lives entirely in application code the RPC itself never sees, so
-- the RPC's own privileges must independently enforce the same boundary.
--
-- Fix: restrict EXECUTE to service_role only, and add an in-function guard
-- that only accepts calls made with the service_role JWT. auth.uid() is
-- deliberately NOT used here -- it resolves to NULL for a service-role
-- caller (there is no end-user JWT in that context), so an
-- "auth.uid() = p_user_id" check would incorrectly reject the Edge
-- Function's own legitimate calls. auth.role() reads the "role" claim
-- carried by the service-role key's own JWT, which is well-defined for
-- this caller, so it is used instead as real defense-in-depth on top of
-- the GRANT restriction below.

CREATE OR REPLACE FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'delete_user_everything can only be called by the service role';
  end if;

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
