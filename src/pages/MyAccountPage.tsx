import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

type Customer = {
  id: string;
  email: string;
  name: string;
};

type AccountStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type CustomerOrder = {
  id: string;
  createdAt: string;
  totalPrice: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string | null;
};

type OrderHistoryResponse = {
  orders: CustomerOrder[];
};

type OrdersStatus = "loading" | "success" | "error";

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
  : "";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "medium",
});

function formatOrderDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Okänt datum"
    : dateFormatter.format(date);
}

function formatOrderPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: currency || "SEK",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "SEK"}`;
  }
}

function getPaymentLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Betald";
    case "pending":
      return "Väntar på betalning";
    case "failed":
      return "Betalning misslyckades";
    case "refunded":
      return "Återbetald";
    default:
      return status || "Okänd";
  }
}

function getOrderStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Mottagen";
    case "processing":
      return "Behandlas";
    case "completed":
      return "Slutförd";
    case "cancelled":
      return "Avbruten";
    default:
      return status || "Okänd";
  }
}

function getFulfillmentLabel(status: string | null): string {
  switch (status) {
    case "pending":
      return "Väntar på hantering";
    case "processing":
      return "Förbereds";
    case "shipped":
      return "Skickad";
    case "delivered":
      return "Levererad";
    default:
      return status || "Ej påbörjad";
  }
}

function MyAccountPage() {
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);

  const [status, setStatus] = useState<AccountStatus>("loading");

  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const [ordersStatus, setOrdersStatus] = useState<OrdersStatus>("loading");

  const [reloadKey, setReloadKey] = useState(0);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [logoutError, setLogoutError] = useState<string | null>(null);

  const customerId = customer?.id;

  const retryOrders = useCallback(() => {
    setOrdersStatus("loading");
    setReloadKey((current) => current + 1);
  }, []);

  // Load the authenticated Google customer.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomer() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          setCustomer(null);
          setStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load customer account");
        }

        const data: Customer = await response.json();

        if (controller.signal.aborted) {
          return;
        }

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

    return () => {
      controller.abort();
    };
  }, []);

  // Load the current customer's orders.
  useEffect(() => {
    if (status !== "authenticated" || !customerId) {
      return;
    }

    const controller = new AbortController();

    async function loadOrders() {
      setOrdersStatus("loading");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/customers/me/orders`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          setCustomer(null);
          setOrders([]);
          setStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load customer orders");
        }

        const data: OrderHistoryResponse = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        if (!Array.isArray(data.orders)) {
          throw new Error("Invalid order history response");
        }

        setOrders(data.orders);
        setOrdersStatus("success");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Customer orders error:", error);
        setOrdersStatus("error");
      }
    }

    void loadOrders();

    return () => {
      controller.abort();
    };
  }, [status, customerId, reloadKey]);

  // Log out of the Google customer session.
  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Could not end the customer session");
      }

      // Clear customer information from React state.
      setCustomer(null);
      setOrders([]);
      setOrdersStatus("loading");
      setStatus("unauthenticated");

      // Navigate only after the backend confirms logout.
      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Customer logout error:", error);

      setLogoutError("Det gick inte att logga ut. Försök igen.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <div role="status" className="animate-pulse space-y-5">
          <div className="h-9 w-48 rounded-lg bg-slate-200" />

          <div className="h-5 w-72 max-w-full rounded-lg bg-slate-100" />

          <div className="h-44 rounded-2xl bg-slate-100" />

          <span className="sr-only">Laddar ditt konto...</span>
        </div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Mina sidor</h1>

        <p className="mt-4 text-slate-600">
          Du behöver logga in för att se ditt konto och dina beställningar.
        </p>

        <Link
          to="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Logga in
        </Link>
      </main>
    );
  }

  if (status === "error" || !customer) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Mina sidor</h1>

        <p role="alert" className="mt-4 text-red-600">
          Det gick inte att ladda ditt konto. Försök igen senare.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-11 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
        >
          Försök igen
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Mitt konto
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Välkommen, {customer.name}!
            </h1>

            <p className="mt-3 text-slate-600">
              Här hittar du dina kontouppgifter och beställningar.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>

            {isLoggingOut ? "Loggar ut..." : "Logga ut"}
          </button>
        </div>

        {logoutError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {logoutError}
          </div>
        )}
      </header>

      <div className="space-y-6">
        <section
          aria-labelledby="account-details-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2
            id="account-details-heading"
            className="text-xl font-semibold text-slate-900"
          >
            Kontouppgifter
          </h2>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Namn</dt>

              <dd className="mt-1 font-medium text-slate-900">
                {customer.name}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">E-postadress</dt>

              <dd className="mt-1 break-all font-medium text-slate-900">
                {customer.email}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="orders-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="orders-heading"
                className="text-xl font-semibold text-slate-900"
              >
                Mina beställningar
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Dina senaste beställningar.
              </p>
            </div>

            {ordersStatus === "success" && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {orders.length} beställningar
              </span>
            )}
          </div>

          {ordersStatus === "loading" && (
            <div role="status" className="mt-6 space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl bg-slate-100"
                />
              ))}

              <span className="sr-only">Laddar dina beställningar...</span>
            </div>
          )}

          {ordersStatus === "error" && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
            >
              <p className="font-medium text-red-800">
                Det gick inte att ladda dina beställningar.
              </p>

              <button
                type="button"
                onClick={retryOrders}
                className="mt-3 min-h-11 rounded-lg bg-white px-4 py-2 font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-100"
              >
                Försök igen
              </button>
            </div>
          )}

          {ordersStatus === "success" && orders.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <h3 className="text-lg font-semibold text-slate-900">
                Inga beställningar ännu
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                När du handlar medan du är inloggad visas dina beställningar
                här.
              </p>

              <Link
                to="/products"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
              >
                Utforska produkter
              </Link>
            </div>
          )}

          {ordersStatus === "success" && orders.length > 0 && (
            <ul className="mt-6 space-y-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-xl border border-slate-200 p-5 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Order
                      </p>

                      <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
                        {order.id}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>

                    <p className="text-lg font-bold tabular-nums text-slate-900">
                      {formatOrderPrice(order.totalPrice, order.currency)}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Orderstatus</p>

                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {getOrderStatusLabel(order.orderStatus)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Betalning</p>

                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          order.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {getPaymentLabel(order.paymentStatus)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Leverans</p>

                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {getFulfillmentLabel(order.fulfillmentStatus)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default MyAccountPage;
