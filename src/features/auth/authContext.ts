import { createContext } from "react";

import type { Session, User } from "@supabase/supabase-js";

export type UserRole = "customer" | "admin";

export type GithubAdmin = {
  id: string;
  githubId: number;
  login: string;
  role: "admin";
};

export type AuthContextValue = {
  user: User | null;
  session: Session | null;

  /**
   * Supabase role for customer authentication,
   * or "admin" when authenticated through GitHub.
   */
  role: UserRole | null;

  /**
   * GitHub admin identity.
   * This is present only for an authenticated GitHub administrator.
   */
  githubAdmin: GithubAdmin | null;

  isLoading: boolean;

  isAnonymous: boolean;
  isLoggedIn: boolean;

  signOut: () => Promise<void>;
};

export const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);
