import { createContext } from "react";

import type { CartItem } from "../../types/cart";
import type { Product } from "../../types/product";

export type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
);
