import { supabase } from "../supabaseClient";
import type { User } from "@supabase/supabase-js";

export const getCurrentUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Auth error:", error.message);
    return null;
  }

  return data.user;
};