import type { NumberFormatPref } from "./format";
import type { DateFormatPref } from "./dateFormat";

/**
 * Shared source of truth for every Profile/Settings preference's supported
 * option list -- imported by both Settings.tsx (the real editor) and
 * Profile.tsx (a read-only summary of the same values, see Backend Part 6)
 * so the two pages can never drift into showing different labels for the
 * same stored code. Every `value` here matches the database's own CHECK
 * constraint exactly (supabase/migrations/20260917000000_profile_settings_preferences.sql).
 */

export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "USD", label: "USD ($) · US Dollar" },
  { value: "EUR", label: "EUR (€) · Euro" },
  { value: "GBP", label: "GBP (£) · British Pound" },
  { value: "CAD", label: "CAD ($) · Canadian Dollar" },
  { value: "AUD", label: "AUD ($) · Australian Dollar" },
  { value: "JPY", label: "JPY (¥) · Japanese Yen" },
];

export const DATE_FORMAT_OPTIONS: { value: DateFormatPref; label: string; preview: string }[] = [
  { value: "mdy", label: "MM/DD/YYYY", preview: "10/24/2025" },
  { value: "dmy", label: "DD/MM/YYYY", preview: "24/10/2025" },
  { value: "ymd", label: "YYYY-MM-DD", preview: "2025-10-24" },
];

export const NUMBER_FORMAT_OPTIONS: { value: NumberFormatPref; label: string }[] = [
  { value: "standard", label: "1,234.56 (Standard comma separator)" },
  { value: "european", label: "1.234,56 (Period thousand separator)" },
  { value: "space", label: "1 234.56 (Thin space separator)" },
];

export function currencyLabel(code: string): string {
  return CURRENCY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function dateFormatLabel(value: string): string {
  return DATE_FORMAT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function numberFormatLabel(value: string): string {
  return NUMBER_FORMAT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
