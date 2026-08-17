import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

import { useAuth } from "../features/auth/useAuth";

type ProtectedAdminRouteProps = {
  children: ReactNode;
};

function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, role, isLoading } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />

          <div className="mt-4 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (role !== "admin") {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">
            Åtkomst nekad
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Du har inte behörighet
          </h1>

          <p className="mt-3 text-slate-600">
            Den här sidan är endast tillgänglig för administratörer.
          </p>

          <Link
            to="/"
            className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            Till startsidan
          </Link>
        </div>
      </main>
    );
  }

  return children;
}

export default ProtectedAdminRoute;
