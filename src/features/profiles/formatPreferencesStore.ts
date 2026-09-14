import { createContext } from "react";
import type { NumberFormatPref } from "../../lib/format";
import type { DateFormatPref } from "../../lib/dateFormat";

export type FormatPreferences = {
  currency: string;
  numberFormat: NumberFormatPref;
  dateFormat: DateFormatPref;
  timeZone: string;
};

export const DEFAULT_PREFERENCES: FormatPreferences = {
  currency: "USD",
  numberFormat: "standard",
  dateFormat: "mdy",
  timeZone: "UTC",
};

export const FormatPreferencesContext = createContext<FormatPreferences | null>(null);
