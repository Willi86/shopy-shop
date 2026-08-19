import { createContext } from "react";

import type { CartItem } from "../../types/cart";
import type { Product } from "../../types/product";

export type AddToCartResult = "added" | "max-stock" | "out-of-stock";

export type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product) => AddToCartResult;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  canIncreaseQuantity: (productId: string) => boolean;
};

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
);
