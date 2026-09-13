export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

/**
 * Purely advisory, client-side-only signal (never sent anywhere, never
 * gates submission) -- Nexali's real minimum stays 6 characters regardless
 * of what this reports. Matches the real Lovable scoring exactly: length,
 * casing, digit, and symbol each contribute one point.
 */
export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) return { score: 0, label: "Empty" };
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  return { score: score as PasswordStrength["score"], label: labels[score] ?? "Weak" };
}
