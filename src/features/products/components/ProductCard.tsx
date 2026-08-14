import type { Product } from "../../../types/product";

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          {product.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">
            {product.name}
          </h2>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
            {product.description}
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              {product.price.toLocaleString("sv-SE")} kr
            </p>
          </div>

          <button
            type="button"
            disabled={product.stock === 0}
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lägg i varukorg
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
