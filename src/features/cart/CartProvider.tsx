import { useMemo, useState, type ReactNode } from "react";

import { CartContext } from "./cartContext";
import type { CartItem } from "../../types/cart";
import type { Product } from "../../types/product";

type CartProviderProps = {
  children: ReactNode;
};

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addToCart(product: Product) {
    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.product.id === product.id,
      );

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          return currentItems;
        }

        return currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      if (product.stock <= 0) {
        return currentItems;
      }

      return [
        ...currentItems,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(productId: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.product.id !== productId) {
          return item;
        }

        if (item.quantity >= item.product.stock) {
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      }),
    );
  }

  function decreaseQuantity(productId: string) {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.product.id !== productId),
    );
  }

  function clearCart() {
    setItems([]);
  }

  function canIncreaseQuantity(productId: string): boolean {
    const cartItem = items.find((item) => item.product.id === productId);

    if (!cartItem) {
      return false;
    }

    return cartItem.quantity < cartItem.product.stock;
  }

  const totalItems = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        canIncreaseQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
