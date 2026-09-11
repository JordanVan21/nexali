import { supabase } from "../supabaseClient";

export async function signInWithEmailPass(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signUp(fullName: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        // Sends the confirmation link back into this app (never a hardcoded
        // localhost target) so the implicit-flow client can pick up the
        // session automatically on /verify-email.
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });
    if (error) throw error;
    return data;
}

/**
 * Starts Supabase's password-reset email flow. The redirect is built from
 * this app's own origin so it works in local dev and production alike; the
 * target Supabase Dashboard project must have that origin allow-listed
 * under Auth > URL Configuration for the email link to be accepted.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/**
 * Updates the password for the currently active (recovery) session. Callers
 * must confirm a valid recovery session exists before rendering the form
 * that leads here.
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Re-sends the signup confirmation email through Supabase's own resend API. */
export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
}
