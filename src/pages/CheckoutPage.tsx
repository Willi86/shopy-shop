import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { useCart } from "../features/cart/useCart";
import { createOrder } from "../services/orderService";

function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const orderId = await createOrder({
        customerName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        customerEmail: email.trim(),
        customerAddress: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        totalPrice,
        items,
      });

      setSuccessOrderId(orderId);
      clearCart();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Kunde inte skapa ordern.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successOrderId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Beställning mottagen
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Tack för din beställning
          </h1>

          <p className="mt-3 text-slate-600">
            Din order har skapats och sparats i systemet.
          </p>

          <div className="mx-auto mt-7 max-w-md rounded-2xl border border-emerald-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Order-ID</p>

            <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">
              {successOrderId}
            </p>
          </div>

          <Link
            to="/products"
            className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Fortsätt handla
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Din varukorg är tom
          </h1>

          <p className="mt-3 text-slate-600">
            Lägg till produkter innan du går vidare till kassan.
          </p>

          <Link
            to="/products"
            className="mt-7 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Se produkter
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Checkout
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Slutför din beställning
        </h1>

        <p className="mt-3 max-w-2xl text-slate-600">
          Detta är en simulerad betalning för skoluppgiften. Ingen riktig
          betalning genomförs.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 lg:grid-cols-[1fr_380px]"
      >
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Kunduppgifter</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Förnamn
              </label>

              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Förnamn"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Efternamn
              </label>

              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Efternamn"
              />
            </div>

            <div className="sm:col-span-2">
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
                placeholder="namn@example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Adress
              </label>

              <input
                id="address"
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                autoComplete="street-address"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Gatuadress"
              />
            </div>

            <div>
              <label
                htmlFor="postalCode"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Postnummer
              </label>

              <input
                id="postalCode"
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                required
                autoComplete="postal-code"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="123 45"
              />
            </div>

            <div>
              <label
                htmlFor="city"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Stad
              </label>

              <input
                id="city"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                autoComplete="address-level2"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Stad"
              />
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <h2 className="text-xl font-bold text-slate-950">
            Ordersammanfattning
          </h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.product.name}
                  </p>

                  <p className="text-sm text-slate-500">{item.quantity} st</p>
                </div>

                <p className="shrink-0 font-semibold text-slate-950">
                  {(item.product.price * item.quantity).toLocaleString("sv-SE")}{" "}
                  kr
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-6">
            <span className="font-medium text-slate-600">Totalt</span>

            <span className="text-2xl font-bold text-slate-950">
              {totalPrice.toLocaleString("sv-SE")} kr
            </span>
          </div>

          {submitError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "Skapar order..." : "Skapa order"}
          </button>
        </aside>
      </form>
    </main>
  );
}

export default CheckoutPage;
