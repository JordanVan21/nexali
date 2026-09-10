import type { Database } from "../types/database.types";
import { supabase } from "../supabaseClient";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileSelect = Pick<
  ProfileRow,
  "full_name" | "avatar_url" | "budget_reset_cycle" | "reset_day" | "timezone"
>;

export async function getProfile(userId: string): Promise<ProfileSelect | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, budget_reset_cycle, reset_day, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}