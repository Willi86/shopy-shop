import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

import { AuthContext, type GithubAdmin, type UserRole } from "./authContext";

type AuthProviderProps = {
  children: ReactNode;
};

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
  : "";

function isAnonymousUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true;
}

async function getGithubAdmin(): Promise<GithubAdmin | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/github/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { id?: unknown }).id !== "string" ||
      typeof (data as { githubId?: unknown }).githubId !== "number" ||
      typeof (data as { login?: unknown }).login !== "string" ||
      (data as { role?: unknown }).role !== "admin"
    ) {
      console.error("Invalid GitHub admin response.");
      return null;
    }

    return {
      id: (data as { id: string }).id,
      githubId: (data as { githubId: number }).githubId,
      login: (data as { login: string }).login,
      role: "admin",
    };
  } catch (error) {
    console.error("Could not load GitHub admin session:", error);
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const [session, setSession] = useState<Session | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);

  const [githubAdmin, setGithubAdmin] = useState<GithubAdmin | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const loadRole = useCallback(
    async (userId: string): Promise<UserRole | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Could not load user role:", error.message);

        return null;
      }

      if (!data) {
        return null;
      }

      return data.role as UserRole;
    },
    [],
  );

  const applySession = useCallback(
    async (nextSession: Session | null): Promise<void> => {
      const nextUser = nextSession?.user ?? null;

      setSession(nextSession);
      setUser(nextUser);

      /*
       * A Supabase session means the user is authenticated
       * through the existing customer/admin Supabase system.
       *
       * GitHub authentication is handled separately below.
       */
      if (!nextUser || isAnonymousUser(nextUser)) {
        setRole(null);
        return;
      }

      const userRole = await loadRole(nextUser.id);

      setRole(userRole);
    },
    [loadRole],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      try {
        /*
         * Keep the existing Supabase authentication.
         * This preserves Google/customer login.
         */
        const {
          data: { session: supabaseSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Could not initialize Supabase auth:", error.message);
        }

        if (cancelled) {
          return;
        }

        await applySession(supabaseSession);

        if (cancelled) {
          return;
        }

        /*
         * Check the separate backend GitHub admin session.
         *
         * The GitHub token itself is NEVER returned here.
         * The backend only returns the safe admin identity
         * from /api/auth/github/me.
         */
        const admin = await getGithubAdmin();

        if (cancelled) {
          return;
        }

        setGithubAdmin(admin);

        /*
         * GitHub admins are admins even though they do not
         * have a Supabase session.
         */
        if (admin) {
          setRole("admin");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setIsLoading(true);

      setTimeout(() => {
        void applySession(newSession).finally(() => {
          /*
           * Do not remove githubAdmin here.
           *
           * Supabase auth changes are independent from
           * the GitHub admin session.
           */
          setIsLoading(false);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  async function signOut(): Promise<void> {
    let logoutError: Error | null = null;

    /*
     * Sign out from Supabase if a Supabase session exists.
     */
    if (session) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        logoutError = new Error(`Kunde inte logga ut: ${error.message}`);
      }
    }

    /*
     * Sign out from the backend GitHub session.
     *
     * This clears the httpOnly github_admin_session cookie.
     */
    if (githubAdmin) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/github/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok && !logoutError) {
          logoutError = new Error(
            "Kunde inte logga ut från GitHub-adminsessionen.",
          );
        }
      } catch (error) {
        if (!logoutError) {
          logoutError =
            error instanceof Error
              ? error
              : new Error("Kunde inte logga ut från GitHub-adminsessionen.");
        }
      }
    }

    setGithubAdmin(null);
    setRole(null);
    setUser(null);
    setSession(null);

    if (logoutError) {
      throw logoutError;
    }
  }

  const isAnonymous = isAnonymousUser(user);

  /*
   * Either authentication mechanism counts as
   * a logged-in user.
   */
  const isLoggedIn = (Boolean(user) && !isAnonymous) || githubAdmin !== null;

  /*
   * GitHub admin has priority because GitHub admins
   * do not have a Supabase user/session.
   */
  const effectiveRole: UserRole | null = githubAdmin !== null ? "admin" : role;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,

        role: effectiveRole,

        githubAdmin,

        isLoading,

        isAnonymous,
        isLoggedIn,

        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
