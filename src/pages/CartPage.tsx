import { Link } from "react-router";

import { useCart } from '../features/cart/useCart'

function CartPage() {
  const {
    items,
    totalPrice,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Din varukorg är tom
          </h1>

          <p className="mt-3 text-slate-600">
            Lägg till några produkter så visas de här.
          </p>

          <Link
            to="/products"
            className="mt-7 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
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
          Din beställning
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Varukorg
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={item.product.id}
              className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
            >
              <img
                src={item.product.imageUrl}
                alt={item.product.name}
                className="h-28 w-28 rounded-2xl object-cover"
              />

              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500">
                  {item.product.category}
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  {item.product.name}
                </h2>

                <p className="mt-2 font-semibold text-slate-950">
                  {item.product.price.toLocaleString("sv-SE")} kr
                </p>
              </div>

              <div className="flex items-center justify-between gap-5 sm:flex-col sm:items-end">
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => decreaseQuantity(item.product.id)}
                    className="px-3 py-2 text-lg"
                    aria-label={`Minska antal av ${item.product.name}`}
                  >
                    −
                  </button>

                  <span className="min-w-10 text-center font-semibold">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => increaseQuantity(item.product.id)}
                    className="px-3 py-2 text-lg"
                    aria-label={`Öka antal av ${item.product.name}`}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                >
                  Ta bort
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Ordersammanfattning
          </h2>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-6">
            <span className="font-medium text-slate-600">Totalt</span>

            <span className="text-2xl font-bold text-slate-950">
              {totalPrice.toLocaleString("sv-SE")} kr
            </span>
          </div>

          <Link
            to="/checkout"
            className="mt-6 flex w-full justify-center rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Till kassan
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default CartPage;
