import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { AuthContext, type UserRole } from "./authContext";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  async function loadRole(userId: string): Promise<UserRole | null> {
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
  }

  useEffect(() => {
    async function initializeAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userRole = await loadRole(session.user.id);

          setRole(userRole);
        } else {
          setRole(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (!newSession?.user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      setTimeout(() => {
        void loadRole(newSession.user.id).then((userRole) => {
          setRole(userRole);
          setIsLoading(false);
        });
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Kunde inte logga ut: ${error.message}`);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
