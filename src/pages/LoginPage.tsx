import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "../features/auth/useAuth";
import { supabase } from "../lib/supabase";

type LocationState = {
  from?: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "https://shopy-shop-q2q6.vercel.app"
).replace(/\/$/, "");

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, role, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as LocationState | null;

  function handleGoogleLogin() {
    // Customer authentication is handled by the Express backend.
    // The backend redirects to Google and establishes the session.
    window.location.assign(`${API_BASE_URL}/api/auth/google`);
  }

  function handleGithubLogin() {
    setError(null);
    setIsGithubLoading(true);

    // GitHub admin authentication is handled entirely by the Express backend.
    // The backend starts the OAuth flow, validates GitHub, checks the admin
    // allowlist, creates the admin session and redirects back to the frontend.
    window.location.assign(`${API_BASE_URL}/api/auth/github`);
  }

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
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Priamos 3D Lab
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Logga in
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Logga in för att se dina beställningar och hantera ditt konto.
          </p>

          {/* Customer login */}
          <section aria-labelledby="customer-login-heading" className="mt-8">
            <h2
              id="customer-login-heading"
              className="text-base font-semibold text-slate-900"
            >
              Kundinloggning
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Använd ditt Google-konto för att komma åt Mina sidor.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.8 7.18l7.73 6C44.38 38.03 46.98 31.88 46.98 24.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.86 23.86 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Fortsätt med Google
            </button>
          </section>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Administration
            </span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* GitHub administrator login */}
          <section
            aria-labelledby="github-admin-login-heading"
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
          >
            <h2
              id="github-admin-login-heading"
              className="text-base font-semibold text-slate-900"
            >
              GitHub-administratör
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Använd ditt godkända GitHub-konto för säker
              administratörsinloggning.
            </p>

            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={isGithubLoading}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isGithubLoading ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      className="stroke-current opacity-25"
                      strokeWidth="3"
                    />
                    <path
                      d="M21 12a9 9 0 0 1-9 9"
                      className="stroke-current"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Ansluter till GitHub...
                </>
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.455-1.157-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.635-1.338-2.22-.252-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.58 9.58 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.376.202 2.393.1 2.646.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48A10.002 10.002 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
                  </svg>
                  Fortsätt med GitHub
                </>
              )}
            </button>
          </section>

          {/* Existing administrator login */}
          <section aria-labelledby="admin-login-heading" className="mt-6">
            <h2
              id="admin-login-heading"
              className="text-base font-semibold text-slate-900"
            >
              Administratör med e-post
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Logga in med e-post och lösenord för att hantera produkter och
              ordrar.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
                disabled={isSubmitting || isGithubLoading}
                className="min-h-12 w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? "Loggar in..." : "Logga in som administratör"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
