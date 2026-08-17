import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "../features/auth/useAuth";
import { supabase } from "../lib/supabase";

type LocationState = {
  from?: string;
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, role, isLoading } = useAuth();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as LocationState | null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.user) {
        throw new Error("Inloggningen kunde inte slutföras.");
      }

      navigate(locationState?.from ?? "/admin", {
        replace: true,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kunde inte logga in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoading && user && role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Priamos 3D Lab
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Administratör
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Logga in för att hantera produkter och ordrar.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                E-post
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Lösenord
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Loggar in..." : "Logga in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
