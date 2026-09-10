import { useContext } from "react";
import { UserIdContext } from "./userContext";

export function useUserInfo() {
  const ctx = useContext(UserIdContext);
  if (!ctx?.userId) throw new Error("useUserInfo must be used under <AuthGate>.");
  return ctx;
}

/** Use when you're certain you're under the auth gate */
export function useUserId(): string {
  const ctx = useContext(UserIdContext);
  if (!ctx?.userId) {
    throw new Error("useUserId must be used under <AuthGate> (signed-in area).");
  }
  return ctx.userId;
}

export function useMaybeUserId(): string | undefined {
  return useContext(UserIdContext)?.userId;
}
