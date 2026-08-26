import { Link } from "react-router";

function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
              P3D
            </div>

            <div>
              <p className="font-bold leading-none text-slate-950">Priamos</p>

              <p className="mt-1 text-xs font-medium tracking-widest text-slate-500">
                3D LAB
              </p>
            </div>
          </Link>

          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
            3D-printade produkter skapade med fokus på design, funktion och
            småskalig produktion.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            Navigering
          </p>

          <div className="mt-4 flex flex-col items-start gap-3">
            <Link
              to="/"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Hem
            </Link>

            <Link
              to="/products"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Produkter
            </Link>

            <Link
              to="/cart"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Varukorg
            </Link>

            <Link
              to="/contact"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Kontakt
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            Kontakt
          </p>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            Har du frågor om en produkt eller en beställning?
          </p>

          <Link
            to="/contact"
            className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            Kontakta oss
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Priamos 3D Lab</p>

          <p>Skapad med React, TypeScript och Supabase.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
