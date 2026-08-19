import { Link } from "react-router";

import { useToast } from "../../../components/ui/useToast";
import { useCart } from "../../cart/useCart";
import type { Product } from "../../../types/product";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addToCart, canIncreaseQuantity } = useCart();
  const { showToast } = useToast();

  function handleAddToCart() {
    if (product.stock <= 0) {
      showToast({
        title: "Slut i lager",
        description: `${product.name} finns inte i lager just nu.`,
        variant: "error",
      });

      return;
    }

    const canAddMore = canIncreaseQuantity(product.id);

    if (!canAddMore) {
      showToast({
        title: "Max antal i varukorgen",
        description: `Du har redan lagt till maximalt tillgängligt antal av ${product.name}.`,
        variant: "info",
        action: {
          label: "Visa varukorg",
          to: "/cart",
        },
      });

      return;
    }

    addToCart(product);

    showToast({
      title: "Tillagd i varukorgen",
      description: `${product.name} har lagts till.`,
      variant: "success",
      action: {
        label: "Visa varukorg",
        to: "/cart",
      },
    });
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-lg">
      <Link
        to={`/products/${product.id}`}
        className="relative block min-h-65 overflow-hidden bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-950 sm:min-h-75"
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
          <Link
            to={`/products/${product.id}`}
            className="group/title rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
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
            <p
              className={
                product.stock > 0
                  ? "text-xs font-medium text-slate-500"
                  : "text-xs font-semibold text-red-600"
              }
            >
              {product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}
            </p>

            <p className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              {product.price.toLocaleString("sv-SE")} kr
            </p>
          </div>

          <button
            type="button"
            disabled={product.stock === 0}
            onClick={handleAddToCart}
            className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-slate-800 hover:shadow-md active:scale-[0.97] active:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
          >
            Lägg i varukorg
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
