import { useMutation } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";

export function useDeleteUser() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const res = await supabase.functions.invoke("delete-user", {
        body: { userId: session.user.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message ?? "Deletion failed");
    },
  });
}