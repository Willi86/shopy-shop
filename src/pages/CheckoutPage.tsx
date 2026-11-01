import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { useCart } from "../features/cart/useCart";
import { createOrder, type ShippingMethod } from "../services/orderService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

type StripeCheckoutResponse = {
  sessionId: string;
  url: string;
};

type ServicePoint = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
};

type ShippingOptions = {
  provider: string;
  postalCode: string;
  methods: {
    id: ShippingMethod;
    name: string;
    price: number;
  }[];
  freeShippingThreshold: number;
  servicePoints: ServicePoint[];
  estimatedDelivery: string;
  isMock: boolean;
};

function formatPrice(amount: number): string {
  return `${amount.toLocaleString("sv-SE", {
    maximumFractionDigits: 2,
  })} kr`;
}

function normalizePostalCode(value: string): string {
  return value.replace(/\s/g, "");
}

function isValidPostalCode(value: string): boolean {
  return /^\d{5}$/.test(normalizePostalCode(value));
}

async function createStripeCheckout(
  orderId: string,
): Promise<StripeCheckoutResponse> {
  const response = await fetch(`${API_URL}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Servern skickade ett oväntat svar. Kontrollera API-servern.",
    );
  }

  const result: {
    sessionId?: string;
    url?: string;
    error?: string;
  } = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? "Kunde inte starta Stripe-betalningen.");
  }

  if (typeof result.sessionId !== "string" || typeof result.url !== "string") {
    throw new Error("Stripe Checkout-svaret saknar sessionsinformation.");
  }

  const checkoutUrl = new URL(result.url);

  if (
    checkoutUrl.protocol !== "https:" ||
    checkoutUrl.hostname !== "checkout.stripe.com"
  ) {
    throw new Error("Servern returnerade en ogiltig Stripe Checkout-adress.");
  }

  return {
    sessionId: result.sessionId,
    url: result.url,
  };
}

function CheckoutPage() {
  const { items, totalPrice } = useCart();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("pickup");

  const [pickupPointId, setPickupPointId] = useState("");

  const [shippingOptions, setShippingOptions] =
    useState<ShippingOptions | null>(null);

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalizedPostalCode = normalizePostalCode(postalCode);
  const postalCodeValid = isValidPostalCode(postalCode);

  const shippingReady =
    postalCodeValid && shippingOptions?.postalCode === normalizedPostalCode;

  const freeShippingThreshold = shippingOptions?.freeShippingThreshold ?? 500;

  const selectedMethod = shippingOptions?.methods.find(
    (method) => method.id === shippingMethod,
  );

  const hasFreeShipping = totalPrice >= freeShippingThreshold;

  const shippingPrice = hasFreeShipping
    ? 0
    : (selectedMethod?.price ?? (shippingMethod === "pickup" ? 59 : 99));

  const grandTotal = totalPrice + shippingPrice;

  const remainingForFreeShipping = Math.max(
    0,
    freeShippingThreshold - totalPrice,
  );

  useEffect(() => {
    if (!postalCodeValid) {
      return;
    }

    const controller = new AbortController();

    async function loadShippingOptions() {
      setShippingLoading(true);
      setShippingError(null);

      try {
        const response = await fetch(
          `${API_URL}/api/shipping/options?postalCode=${encodeURIComponent(
            normalizedPostalCode,
          )}`,
          { signal: controller.signal },
        );

        const result: ShippingOptions & {
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ?? "Kunde inte hämta leveransalternativ.",
          );
        }

        if (!controller.signal.aborted) {
          setShippingOptions(result);
          setPickupPointId("");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setShippingOptions(null);
        setShippingError(
          error instanceof Error
            ? error.message
            : "Kunde inte hämta leveransalternativ.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setShippingLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(loadShippingOptions, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedPostalCode, postalCodeValid]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0 || isSubmitting) {
      return;
    }

    setSubmitError(null);

    if (!shippingReady || shippingLoading) {
      setSubmitError(
        "Ange ett giltigt svenskt postnummer och vänta på leveransalternativen.",
      );
      return;
    }

    if (shippingMethod === "pickup" && !pickupPointId) {
      setSubmitError("Välj ett utlämningsställe.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Always create a new order using the current form,
      // cart and shipping selection. Never reuse a stale order.
      const currentOrderId = await createOrder({
        customerName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        customerEmail: email.trim(),
        customerAddress: address.trim(),
        postalCode: normalizedPostalCode,
        city: city.trim(),
        shippingMethod,
        pickupPointId: shippingMethod === "pickup" ? pickupPointId : undefined,
        items,
      });

      const checkout = await createStripeCheckout(currentOrderId);

      // Stripe handles payment and the signed webhook
      // confirms the final payment status.
      window.location.assign(checkout.url);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Kunde inte starta betalningen.",
      );
      setIsSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">
            Din varukorg är tom
          </h1>

          <p className="mt-3 text-slate-600">
            Lägg till produkter innan du går vidare till kassan.
          </p>

          <Link
            to="/products"
            className="mt-7 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800"
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

        <h1 className="mt-2 text-4xl font-bold text-slate-950">
          Slutför din beställning
        </h1>

        <p className="mt-3 max-w-2xl text-slate-600">
          Du skickas vidare till Stripe för säker kortbetalning. Butiken
          använder Stripe i testläge, så inga riktiga pengar dras.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 lg:grid-cols-[1fr_380px]"
      >
        <div className="space-y-8">
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
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
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
                  placeholder="Stad"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Leverans</h2>

                <p className="mt-2 text-sm text-slate-600">
                  Välj hur du vill få din beställning.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                PostNord · Demo
              </span>
            </div>

            {!postalCodeValid ? (
              <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Ange ett svenskt postnummer ovan för att visa
                leveransalternativ.
              </p>
            ) : shippingLoading || !shippingReady ? (
              <p
                role="status"
                className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
              >
                {shippingError ?? "Hämtar leveransalternativ..."}
              </p>
            ) : (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {shippingOptions.methods.map((method) => {
                    const selected = shippingMethod === method.id;
                    const price = hasFreeShipping ? 0 : method.price;

                    return (
                      <label
                        key={method.id}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                          selected
                            ? "border-slate-950 bg-slate-50"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="shippingMethod"
                            value={method.id}
                            checked={selected}
                            onChange={() => setShippingMethod(method.id)}
                            className="mt-1 accent-slate-950"
                          />

                          <div className="flex-1">
                            <p className="font-semibold text-slate-950">
                              {method.name}
                            </p>

                            <p className="mt-2 text-lg font-bold text-slate-950">
                              {price === 0 ? "Gratis" : formatPrice(price)}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {shippingMethod === "pickup" && (
                  <div className="mt-6">
                    <label
                      htmlFor="pickupPoint"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Välj utlämningsställe
                    </label>

                    <select
                      id="pickupPoint"
                      value={pickupPointId}
                      onChange={(event) => setPickupPointId(event.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-950"
                    >
                      <option value="">Välj ett ombud</option>

                      {shippingOptions.servicePoints.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name} — {point.address}, {point.city}
                        </option>
                      ))}
                    </select>

                    <p className="mt-2 text-xs text-amber-700">
                      Testombud. Platserna är simulerade och inte hämtade från
                      PostNord.
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Beräknad leverans
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {shippingOptions.estimatedDelivery}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Illustrativt datum, inte en bekräftad leveranstid från
                    PostNord.
                  </p>
                </div>
              </>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              {hasFreeShipping ? (
                <p className="text-sm font-semibold text-emerald-700">
                  Du har fri frakt!
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Handla för ytterligare{" "}
                    <strong>{formatPrice(remainingForFreeShipping)}</strong> för
                    fri frakt.
                  </p>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (totalPrice / freeShippingThreshold) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

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
                  {formatPrice(item.product.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Varor</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>Frakt</span>
              <span>
                {hasFreeShipping ? "Gratis" : formatPrice(shippingPrice)}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
            <span className="font-semibold text-slate-700">Totalt</span>

            <span className="text-2xl font-bold text-slate-950">
              {formatPrice(grandTotal)}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Slutbeloppet beräknas och verifieras av servern.
          </p>

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
            disabled={
              isSubmitting ||
              shippingLoading ||
              !shippingReady ||
              (shippingMethod === "pickup" && !pickupPointId)
            }
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting
              ? "Öppnar Stripe Checkout..."
              : `Betala ${formatPrice(grandTotal)}`}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Säker betalning via Stripe Checkout. Endast testläge.
          </p>
        </aside>
      </form>
    </main>
  );
}

export default CheckoutPage;
