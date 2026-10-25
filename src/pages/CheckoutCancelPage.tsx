import { Link, useSearchParams } from "react-router";

function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
          !
        </div>

        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-amber-700">
          Stripe Checkout
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Betalningen avbröts
        </h1>

        <p className="mt-4 text-slate-600">
          Du har lämnat betalningssidan utan att slutföra köpet. Ingen betalning
          har bekräftats för den här sessionen.
        </p>

        <p className="mt-3 text-sm text-slate-600">
          Du kan gå tillbaka till kassan och försöka igen.
        </p>

        {orderId && (
          <div className="mt-7 rounded-2xl border border-amber-200 bg-white p-5">
            <p className="text-sm text-slate-500">Ordernummer</p>

            <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">
              {orderId}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/checkout"
            className="rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Tillbaka till kassan
          </Link>

          <Link
            to="/products"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
          >
            Fortsätt handla
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Betalningarna körs i Stripes testläge.
        </p>
      </div>
    </main>
  );
}

export default CheckoutCancelPage;
