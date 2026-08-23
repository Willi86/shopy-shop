import { useEffect, useState, useCallback, type ReactNode } from "react";

import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

import { AuthContext, type UserRole } from "./authContext";

type AuthProviderProps = {
  children: ReactNode;
};

function isAnonymousUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const [session, setSession] = useState<Session | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const loadRole = useCallback(async (userId: string): Promise<UserRole | null> => {
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
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;

    setSession(nextSession);
    setUser(nextUser);

    if (!nextUser || isAnonymousUser(nextUser)) {
      setRole(null);
      return;
    }

    const userRole = await loadRole(nextUser.id);

    setRole(userRole);
  }, [loadRole]);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Could not initialize auth:", error.message);
        }

        if (cancelled) {
          return;
        }

        await applySession(session);
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
          setIsLoading(false);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Kunde inte logga ut: ${error.message}`);
    }
  }

  const isAnonymous = isAnonymousUser(user);

  const isLoggedIn = Boolean(user) && !isAnonymous;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,

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
