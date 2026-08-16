import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { useCart } from "../features/cart/useCart";
import { getProductById } from "../services/productService";
import type { Product } from "../types/product";

function ProductDetailsPage() {
  const { id } = useParams();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      if (!id) {
        setError("Produkten kunde inte hittas.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);

        const data = await getProductById(id);

        setProduct(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Produkten kunde inte laddas.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProduct();
  }, [id]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid animate-pulse gap-10 lg:grid-cols-2">
          <div className="aspect-4/3 rounded-4xl bg-slate-200" />

          <div className="space-y-5 py-4">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-10 w-3/4 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded bg-slate-200" />
            <div className="h-24 w-full rounded bg-slate-100" />
            <div className="h-12 w-44 rounded-xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-950">
            Produkten kunde inte hittas
          </h1>

          <p className="mt-3 text-red-700">
            {error ?? "Produkten finns inte längre."}
          </p>

          <Link
            to="/products"
            className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            Tillbaka till produkter
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      <nav
        aria-label="Brödsmulor"
        className="mb-8 flex items-center gap-2 text-sm text-slate-500"
      >
        <Link to="/" className="transition-colors hover:text-slate-950">
          Hem
        </Link>

        <span>/</span>

        <Link to="/products" className="transition-colors hover:text-slate-950">
          Produkter
        </Link>

        <span>/</span>

        <span className="truncate text-slate-950">{product.name}</span>
      </nav>

      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <section className="overflow-hidden rounded-4xl border border-slate-200 bg-white">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="block h-auto w-full"
          />
        </section>

        <section className="lg:sticky lg:top-28">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
            {product.category}
          </span>

          <h1 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
            {product.price.toLocaleString("sv-SE")} kr
          </p>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
            {product.description}
          </p>

          <div className="mt-8 border-y border-slate-200 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Lagerstatus
              </span>

              <span
                className={
                  product.stock > 0
                    ? "text-sm font-semibold text-emerald-700"
                    : "text-sm font-semibold text-red-600"
                }
              >
                {product.stock > 0
                  ? `${product.stock} i lager`
                  : "Slut i lager"}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={product.stock === 0}
            onClick={() => addToCart(product)}
            className="mt-8 w-full rounded-2xl bg-slate-950 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            Lägg i varukorg
          </button>

          <div className="mt-8 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-bold text-slate-950">3D-printad</p>

              <p className="mt-1 text-sm text-slate-500">
                Tillverkad lager för lager
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950">Små serier</p>

              <p className="mt-1 text-sm text-slate-500">
                Producerad med omsorg
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950">Unik design</p>

              <p className="mt-1 text-sm text-slate-500">Priamos 3D Lab</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProductDetailsPage;
