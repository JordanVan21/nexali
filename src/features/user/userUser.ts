import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../../lib/user";
import { qk } from "../querykeys";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  return useQuery<User | null, Error>({
    queryKey: qk.user,
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
}