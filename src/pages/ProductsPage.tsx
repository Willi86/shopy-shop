import ProductCard from "../features/products/components/ProductCard";
import { mockProducts } from "../features/products/data/mockProducts";

function ProductsPage() {
  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Priamos 3D Lab
          </p>

          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Våra produkter
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Unika 3D-printade produkter skapade med fokus på design,
                funktion och personlighet.
              </p>
            </div>

            <p className="text-sm font-medium text-slate-500">
              {mockProducts.length} produkter
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mockProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default ProductsPage;
