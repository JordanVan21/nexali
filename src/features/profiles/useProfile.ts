import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "../../lib/profile";
import { qk } from "../querykeys";
import { supabase } from "../../supabaseClient";

export function useProfile(userId?: string) {
    return useQuery({
        queryKey: userId ? qk.profile(userId) : ["profile", "disabled"] as const,
        queryFn: () => getProfile(userId!),
        enabled: !!userId,
        staleTime: 60000,
    })
}

export type UpdateProfileVars = {
    full_name: string;
    budget_reset_cycle: string;
    reset_day: number;
};

export function useUpdateProfile(userId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (vars: UpdateProfileVars) => {
            const { error } = await supabase
                  .from("profiles")
                  .update(vars)
                  .eq("id", userId);
            if (error) throw error;
        },
        onSuccess: async () => {
      if (userId) await qc.invalidateQueries({ queryKey: qk.profile(userId) });
    },});
}