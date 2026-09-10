import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";

/**
 * Signs the user out, clears all cached query data, and redirects to the
 * landing page. Mirrors the sign-out step already proven in the account
 * deletion flow (Profile.tsx), applied on its own for a plain sign-out.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  return async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate("/", { replace: true });
  };
}
