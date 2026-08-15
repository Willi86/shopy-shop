import { useEffect, useState } from "react";

import ProductCard from "../features/products/components/ProductCard";
import { getProducts } from "../services/productService";
import type { Product } from "../types/product";

function ProductsPage() {
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

  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Priamos 3D Lab
              </p>

              <h1 className="mt-2 text-4xl font-bold tracking-[-0.03em] text-slate-950 sm:text-5xl">
                Våra produkter
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-slate-600">
                Unika 3D-printade produkter skapade med fokus på design,
                funktion och personlighet.
              </p>
            </div>

            {!isLoading && !error && (
              <p className="text-sm font-medium text-slate-500">
                {products.length}{" "}
                {products.length === 1 ? "produkt" : "produkter"}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Produkterna kunde inte laddas</p>

            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white"
              >
                <div className="h-75 animate-pulse bg-slate-200" />

                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />

                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />

                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />

                  <div className="mt-6 h-10 animate-pulse rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && products.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <h2 className="text-xl font-bold text-slate-950">
              Inga produkter ännu
            </h2>

            <p className="mt-2 text-slate-600">
              Produkterna kommer att visas här när de har lagts till.
            </p>
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ProductsPage;
