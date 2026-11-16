import { useEffect, useState } from "react";
import { Link } from "react-router";

type Customer = {
  id: string;
  email: string;
  name: string;
};

type AccountStatus = "loading" | "authenticated" | "unauthenticated" | "error";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

function MyAccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [status, setStatus] = useState<AccountStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomer() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load customer account");
        }

        const data: Customer = await response.json();

        setCustomer(data);
        setStatus("authenticated");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Customer account error:", error);
        setStatus("error");
      }
    }

    void loadCustomer();

    return () => controller.abort();
  }, []);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <p className="text-slate-600">Laddar ditt konto...</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">
          Mina sidor
        </h1>

        <p className="mt-4 text-slate-600">
          Du behöver logga in för att se ditt konto.
        </p>

        <Link
          to="/login"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
        >
          Logga in
        </Link>
      </main>
    );
  }

  if (status === "error" || !customer) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">
          Mina sidor
        </h1>

        <p className="mt-4 text-red-600">
          Det gick inte att ladda ditt konto. Försök igen senare.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Mitt konto
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Välkommen, {customer.name}!
        </h1>

        <p className="mt-3 text-slate-600">
          Här kan du se dina kontouppgifter och dina beställningar.
        </p>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Kontouppgifter
          </h2>

          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm text-slate-500">Namn</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {customer.name}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">E-postadress</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {customer.email}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}

export default MyAccountPage;