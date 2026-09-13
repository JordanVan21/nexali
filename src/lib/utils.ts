import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect, useState } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Real initials derived from the user's own data: first letter of up to the
 * first two words of their real full name (e.g. "Jordan Van" -> "JV"), or
 * the first letter of their real sign-in email when no name is set yet.
 * Never a placeholder value -- empty string if neither is available.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const initials = trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    if (initials) return initials;
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail[0].toUpperCase();
  return "";
}