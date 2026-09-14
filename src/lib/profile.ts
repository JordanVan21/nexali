import type { Database } from "../types/database.types";
import { supabase } from "../supabaseClient";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileSelect = Pick<
  ProfileRow,
  | "full_name"
  | "avatar_url"
  | "budget_reset_cycle"
  | "reset_day"
  | "timezone"
  | "phone"
  | "location"
  | "financial_bio"
  | "currency"
  | "date_format"
  | "number_format"
>;

/**
 * SCHEMA DEPENDENCY: `phone`, `location`, `financial_bio`, `currency`,
 * `date_format`, and `number_format` require
 * `supabase/migrations/20260917000000_profile_settings_preferences.sql`
 * (Backend Part 6) to be deployed. As of this writing that migration is
 * implemented and reviewed but has NOT been pushed to the live database
 * (confirmed via `npx supabase migration list` showing an empty `remote`
 * timestamp for it) -- selecting these columns against an undeployed
 * remote will make this query fail for every caller sharing
 * qk.profile(userId), until the migration is applied. This is intentional
 * drift while the migration awaits explicit deployment approval (see
 * docs/BACKEND_AUDIT_REPORT.md Backend Part 6), not a bug in this file --
 * do NOT trim this SELECT list to "fix" a pending-deployment error; deploy
 * the migration instead. Any page/component that treats profile data as
 * required-to-render must account for this query genuinely failing until
 * then (see Dashboard.tsx's profile-error regression fix, which does not
 * gate rendering on profile.isError -- profile is optional presentation
 * data there).
 */
const PROFILE_COLUMNS =
  "full_name, avatar_url, budget_reset_cycle, reset_day, timezone, phone, location, financial_bio, currency, date_format, number_format";

export async function getProfile(userId: string): Promise<ProfileSelect | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
