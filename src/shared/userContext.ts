import { createContext } from "react";

export type UserCtx = { userId: string; email?: string } | null;

export const UserIdContext = createContext<UserCtx>(null);
