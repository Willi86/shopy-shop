import { useEffect, useState } from "react";

import ProductCard from "../features/products/components/ProductCard";
import type { Product } from "../types/product";

const API_URL = "http://localhost:3001/api/products/search";
const PAGE_SIZE = 8;

type ApiProduct = Omit<Product, "imageUrl"> & {
  image_url: string | null;
};

type SearchResponse = {
  data: ApiProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const categories = [
  "Islamisk dekoration",
  "Dekoration",
  "Hem & trädgård",
  "Belysning",
  "Test",
  "its just a test",
];

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
        });

        if (debouncedSearch.trim()) {
          params.set("q", debouncedSearch.trim());
        }

        if (category) {
          params.set("category", category);
        }

        const response = await fetch(`${API_URL}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Kunde inte hämta produkter (${response.status}).`);
        }

        const result = (await response.json()) as SearchResponse;

        if (
          !Array.isArray(result.data) ||
          !result.pagination ||
          typeof result.pagination.total !== "number" ||
          typeof result.pagination.totalPages !== "number"
        ) {
          throw new Error("Ogiltigt svar från produkt-API.");
        }

        const mappedProducts: Product[] = result.data.map((product) => ({
          ...product,
          imageUrl: product.image_url ?? "",
        }));

        setProducts(mappedProducts);
        setTotal(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setProducts([]);
        setTotal(0);
        setTotalPages(1);

        setError(
          error instanceof Error
            ? error.message
            : "Kunde inte ladda produkterna.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, category, sort, page]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCategory(value: string) {
    setCategory(value);
    setPage(1);
  }

  function handleSort(value: string) {
    setSort(value);
    setPage(1);
  }

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
                {total} {total === 1 ? "produkt" : "produkter"}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        <div className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="product-search"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Sök produkter
            </label>

            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Sök efter en produkt..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
            />
          </div>

          <div>
            <label
              htmlFor="product-category"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Kategori
            </label>

            <select
              id="product-category"
              value={category}
              onChange={(event) => handleCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">Alla kategorier</option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="product-sort"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Sortera
            </label>

            <select
              id="product-sort"
              value={sort}
              onChange={(event) => handleSort(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="newest">Nyaste först</option>

              <option value="price_asc">Pris: lägst först</option>

              <option value="price_desc">Pris: högst först</option>

              <option value="name_asc">Namn: A–Ö</option>
            </select>
          </div>
        </div>

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
              Inga produkter hittades
            </h2>

            <p className="mt-2 text-slate-600">
              Prova ett annat sökord eller välj en annan kategori.
            </p>
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Föregående
                </button>

                <span className="text-sm font-medium text-slate-600">
                  Sida {page} av {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Nästa
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default ProductsPage;
