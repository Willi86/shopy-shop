import { useMemo, useRef, useState, type ReactNode } from "react";

import { CartContext, type AddToCartResult } from "./cartContext";

import type { CartItem } from "../../types/cart";
import type { Product } from "../../types/product";

type CartProviderProps = {
  children: ReactNode;
};

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  const itemsRef = useRef<CartItem[]>([]);

  function updateItems(nextItems: CartItem[]) {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }

  function addToCart(product: Product): AddToCartResult {
    if (product.stock <= 0) {
      return "out-of-stock";
    }

    const currentItems = itemsRef.current;

    const existingItem = currentItems.find(
      (item) => item.product.id === product.id,
    );

    if (existingItem && existingItem.quantity >= product.stock) {
      return "max-stock";
    }

    const nextItems = existingItem
      ? currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        )
      : [
          ...currentItems,
          {
            product,
            quantity: 1,
          },
        ];

    updateItems(nextItems);

    return "added";
  }

  function increaseQuantity(productId: string) {
    const currentItems = itemsRef.current;

    const nextItems = currentItems.map((item) => {
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
    });

    updateItems(nextItems);
  }

  function decreaseQuantity(productId: string) {
    const currentItems = itemsRef.current;

    const nextItems = currentItems
      .map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: item.quantity - 1,
            }
          : item,
      )
      .filter((item) => item.quantity > 0);

    updateItems(nextItems);
  }

  function removeFromCart(productId: string) {
    const nextItems = itemsRef.current.filter(
      (item) => item.product.id !== productId,
    );

    updateItems(nextItems);
  }

  function clearCart() {
    updateItems([]);
  }

  function canIncreaseQuantity(productId: string): boolean {
    const cartItem = itemsRef.current.find(
      (item) => item.product.id === productId,
    );

    return !cartItem || cartItem.quantity < cartItem.product.stock;
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
