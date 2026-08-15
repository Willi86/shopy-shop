import { useEffect, useState } from "react";
import { Link } from "react-router";

import ProductCard from "../features/products/components/ProductCard";
import { getProducts } from "../services/productService";
import type { Product } from "../types/product";

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setError(null);

        const data = await getProducts();

        setProducts(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Kunde inte ladda produkterna.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProducts();
  }, []);

  const featuredProducts = products.slice(0, 4);

  const heroProduct =
    products.find((product) => product.name.toLowerCase().includes("fanoos")) ??
    products[0];

  return (
    <main>
      <section className="overflow-hidden bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-slate-400">
              Priamos 3D Lab
            </p>

            <h1 className="mt-5 max-w-2xl text-5xl font-bold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Idéer blir verkliga,
              <span className="block text-slate-300">lager för lager.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Unika 3D-printade produkter för hemmet, vardagen och personliga
              tillfällen.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="rounded-xl bg-white px-6 py-3.5 font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                Utforska produkter
              </Link>

              <a
                href="#featured"
                className="rounded-xl border border-slate-700 px-6 py-3.5 font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-900"
              >
                Populärt just nu
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            {heroProduct ? (
              <div className="relative w-full max-w-130 overflow-hidden rounded-4xl bg-slate-900 shadow-2xl">
                <img
                  src={heroProduct.imageUrl}
                  alt={heroProduct.name}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="block h-auto w-full"
                />

                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/25 to-transparent px-6 pb-6 pt-20">
                  <p className="text-sm font-medium text-white/70">
                    Utvald produkt
                  </p>

                  <p className="mt-1 text-xl font-bold">{heroProduct.name}</p>
                </div>
              </div>
            ) : (
              <div className="aspect-4/3 w-full max-w-130 animate-pulse rounded-4xl bg-slate-900" />
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-slate-200 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="py-7 text-center">
            <p className="font-bold text-slate-950">3D-printat</p>

            <p className="mt-1 text-sm text-slate-500">
              Tillverkat lager för lager
            </p>
          </div>

          <div className="py-7 text-center">
            <p className="font-bold text-slate-950">Unika produkter</p>

            <p className="mt-1 text-sm text-slate-500">
              Design med personlighet
            </p>
          </div>

          <div className="py-7 text-center">
            <p className="font-bold text-slate-950">Små serier</p>

            <p className="mt-1 text-sm text-slate-500">Producerat med omsorg</p>
          </div>
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Utvalda produkter
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Populärt just nu
            </h2>
          </div>

          <Link
            to="/products"
            className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-950"
          >
            Visa alla produkter →
          </Link>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white"
              >
                <div className="h-75 animate-pulse bg-slate-200" />

                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:pb-20">
        <div className="rounded-4xl bg-slate-900 px-8 py-12 text-white md:px-12 md:py-14">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Priamos 3D Lab
          </p>

          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Designad digitalt.
            <br />
            Skapad fysiskt.
          </h2>

          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Varje produkt börjar som en digital idé och byggs sedan upp lager
            för lager genom 3D-printing.
          </p>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
