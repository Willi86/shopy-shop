import { Link } from "react-router";

import heroImage from "../assets/products/fanous3.jpg";
import ProductCard from "../features/products/components/ProductCard";
import { mockProducts } from "../features/products/data/mockProducts";

function HomePage() {
  const featuredProducts = mockProducts.slice(0, 4);

  return (
    <main>
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">
              Priamos 3D Lab
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-bold tracking-tight sm:text-6xl">
              Idéer blir verkliga, lager för lager.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Upptäck unika 3D-printade produkter för hemmet, vardagen och
              speciella tillfällen.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/products"
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Se produkter
              </Link>

              <a
                href="#featured"
                className="rounded-2xl border border-slate-700 px-6 py-3 font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Populärt just nu
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <img
              src={heroImage}
              alt="3D-printad Fanoos från Priamos 3D Lab"
              className="w-full max-w-[380px] rounded-[2rem] shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 text-center sm:grid-cols-3">
          <div>
            <p className="text-2xl font-bold text-slate-950">3D-printat</p>
            <p className="mt-1 text-sm text-slate-500">
              Tillverkat lager för lager
            </p>
          </div>

          <div>
            <p className="text-2xl font-bold text-slate-950">Unik design</p>
            <p className="mt-1 text-sm text-slate-500">
              Produkter med personlighet
            </p>
          </div>

          <div>
            <p className="text-2xl font-bold text-slate-950">Små serier</p>
            <p className="mt-1 text-sm text-slate-500">Producerat med omsorg</p>
          </div>
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Utvalda produkter
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Populärt just nu
            </h2>
          </div>

          <Link
            to="/products"
            className="font-semibold text-slate-700 transition hover:text-slate-950"
          >
            Visa alla produkter →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="overflow-hidden rounded-[2rem] bg-slate-200 px-8 py-12 md:px-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Priamos 3D Lab
          </p>

          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Designad digitalt. Skapad fysiskt.
          </h2>

          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Varje produkt börjar som en digital design och byggs sedan upp lager
            för lager med 3D-printing.
          </p>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
