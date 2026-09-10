import type { ReactNode } from "react";
import { UserIdContext, type UserCtx } from "./userContext";

export function UserIdProvider({
  value,
  children,
}: {
  value: UserCtx;
  children: ReactNode;
}) {
  return <UserIdContext.Provider value={value}>{children}</UserIdContext.Provider>;
}
