import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useCart } from "../features/cart/useCart";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type PaymentStatus = {
  orderId: string;
  amount: number;
  currency: string;
  status: "paid" | "pending";
  paidAt: string | null;
};

function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const { clearCart } = useCart();

  const [payment, setPayment] = useState<PaymentStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function verifyPayment() {
      try {
        // The webhook may take a few seconds to update
        // the database after Stripe redirects the customer.
        for (let attempt = 0; attempt < 10; attempt++) {
          if (cancelled) return;

          const response = await fetch(
            `${API_URL}/api/stripe/checkout/status?session_id=${encodeURIComponent(sessionId!)}`,
            {
              signal: controller.signal,
              cache: "no-store",
            },
          );

          if (!response.ok) {
            throw new Error("Kunde inte verifiera betalningen.");
          }

          const result = (await response.json()) as PaymentStatus;

          if (cancelled) return;

          if (result.status === "paid") {
            setPayment(result);
            setLoading(false);

            // Clear the cart only after the backend
            // confirms that the order is paid.
            clearCart();
            return;
          }

          if (attempt < 9) {
            await new Promise<void>((resolve) => {
              timeoutId = setTimeout(resolve, 2000);
            });
          }
        }

        if (!cancelled) {
          setError(
            "Betalningen är ännu inte bekräftad. " +
              "Kontrollera igen om en liten stund.",
          );
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Ett fel uppstod vid verifieringen.",
        );
        setLoading(false);
      }
    }

    void verifyPayment();

    return () => {
      cancelled = true;
      controller.abort();

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [sessionId, clearCart]);

  function formatPrice(amount: number) {
    return `${amount.toLocaleString("sv-SE")} kr`;
  }

  if (sessionId && loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Verifierar din betalning...
          </h1>

          <p className="mt-3 text-slate-600">
            Vänta medan vi kontrollerar betalningsstatus hos Stripe.
          </p>
        </div>
      </main>
    );
  }

  if (!sessionId || error || !payment) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
            !
          </div>

          <h1 className="mt-6 text-3xl font-bold text-slate-950">
            Betalningen kunde inte bekräftas
          </h1>

          <p className="mt-4 text-slate-600">
            {!sessionId ? "Stripe-session saknas i adressen." : error}
          </p>

          <p className="mt-3 text-sm text-slate-600">
            Betala inte igen innan du har kontrollerat betalningsstatus.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-8 rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Kontrollera igen
          </button>

          <div className="mt-4">
            <Link
              to="/products"
              className="text-sm font-semibold text-slate-700 underline"
            >
              Tillbaka till butiken
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-700">
          ✓
        </div>

        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
          Stripe Checkout
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Tack för din beställning!
        </h1>

        <p className="mt-4 text-slate-600">
          Din betalning har verifierats och beställningen är registrerad som
          betald.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6">
          <p className="text-sm text-slate-500">Ordernummer</p>

          <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">
            {payment.orderId}
          </p>

          <p className="mt-6 text-sm text-slate-500">Betalt belopp</p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatPrice(payment.amount)}
          </p>

          <p className="mt-5 font-semibold text-emerald-700">
            Betalningsstatus: Betald
          </p>

          {payment.paidAt && (
            <p className="mt-2 text-sm text-slate-500">
              Betaldatum: {new Date(payment.paidAt).toLocaleString("sv-SE")}
            </p>
          )}
        </div>

        <p className="mt-6 text-sm text-slate-600">
          Betalningen genomfördes i Stripes testläge. Inga riktiga pengar har
          dragits.
        </p>

        <Link
          to="/products"
          className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
        >
          Fortsätt handla
        </Link>
      </div>
    </main>
  );
}

export default CheckoutSuccessPage;
