import { createContext } from "react";

import type { Session, User } from "@supabase/supabase-js";

export type UserRole = "customer" | "admin";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;

  isLoading: boolean;

  isAnonymous: boolean;
  isLoggedIn: boolean;

  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
