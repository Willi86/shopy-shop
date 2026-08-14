import { Link } from 'react-router'

import { useCart } from '../features/cart/useCart'

function CheckoutPage() {
  const { items, totalPrice } = useCart()

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
            className="mt-7 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Se produkter
          </Link>
        </div>
      </main>
    )
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

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Kunduppgifter
          </h2>

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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950"
                placeholder="Stad"
              />
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

                  <p className="text-sm text-slate-500">
                    {item.quantity} st
                  </p>
                </div>

                <p className="font-semibold text-slate-950">
                  {(item.product.price * item.quantity).toLocaleString(
                    'sv-SE',
                  )}{' '}
                  kr
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-6">
            <span className="font-medium text-slate-600">
              Totalt
            </span>

            <span className="text-2xl font-bold text-slate-950">
              {totalPrice.toLocaleString('sv-SE')} kr
            </span>
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Skapa order
          </button>
        </aside>
      </div>
    </main>
  )
}

export default CheckoutPage