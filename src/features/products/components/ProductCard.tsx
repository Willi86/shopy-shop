import { Link } from "react-router";

import { useCart } from "../../cart/useCart";
import type { Product } from "../../../types/product";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <Link
        to={`/products/${product.id}`}
        className="relative block min-h-65 overflow-hidden bg-slate-100 sm:min-h-75"
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover"
        />

        <span className="absolute left-4 top-4 rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          {product.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <Link to={`/products/${product.id}`} className="group/title">
            <h2 className="text-lg font-bold tracking-tight text-slate-950 transition-colors group-hover/title:text-slate-600">
              {product.name}
            </h2>
          </Link>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
            {product.description}
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-slate-100 pt-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}
            </p>

            <p className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              {product.price.toLocaleString("sv-SE")} kr
            </p>
          </div>

          <button
            type="button"
            disabled={product.stock === 0}
            onClick={() => addToCart(product)}
            className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lägg i varukorg
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
