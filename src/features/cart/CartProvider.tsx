import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ensureCartSession,
  loadPersistentCart,
  upsertCartItem,
  removeCartItem,
  clearPersistentCart,
} from "../../services/cartPersistenceService";

import { CartContext, type AddToCartResult } from "./cartContext";

import type { CartItem } from "../../types/cart";
import type { Product } from "../../types/product";

type CartProviderProps = {
  children: ReactNode;
};

function mergeCartItems(
  persistedItems: CartItem[],
  localItems: CartItem[],
): CartItem[] {
  const mergedItems = new Map<string, CartItem>();

  for (const item of persistedItems) {
    mergedItems.set(item.product.id, item);
  }

  for (const localItem of localItems) {
    const persistedItem = mergedItems.get(localItem.product.id);

    if (!persistedItem) {
      mergedItems.set(localItem.product.id, localItem);
      continue;
    }

    const quantity = Math.min(
      persistedItem.quantity + localItem.quantity,
      localItem.product.stock,
    );

    if (quantity <= 0) {
      mergedItems.delete(localItem.product.id);
      continue;
    }

    mergedItems.set(localItem.product.id, {
      product: localItem.product,
      quantity,
    });
  }

  return [...mergedItems.values()];
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  const itemsRef = useRef<CartItem[]>([]);

  const cartIdRef = useRef<string | null>(null);

  const isHydratedRef = useRef(false);

  const hadLocalChangesBeforeHydrationRef = useRef(false);

  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  function updateItems(nextItems: CartItem[]) {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }

  function enqueueSync(operation: () => Promise<void>) {
    syncQueueRef.current = syncQueueRef.current
      .then(operation)
      .catch((error) => {
        console.error("Failed to synchronize cart with Supabase:", error);
      });
  }

  function persistQuantity(productId: string, quantity: number) {
    const cartId = cartIdRef.current;

    if (!cartId || !isHydratedRef.current) {
      hadLocalChangesBeforeHydrationRef.current = true;
      return;
    }

    enqueueSync(async () => {
      await upsertCartItem(cartId, productId, quantity);
    });
  }

  function persistRemoval(productId: string) {
    const cartId = cartIdRef.current;

    if (!cartId || !isHydratedRef.current) {
      hadLocalChangesBeforeHydrationRef.current = true;
      return;
    }

    enqueueSync(async () => {
      await removeCartItem(cartId, productId);
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeCart() {
      try {
        const cartId = await ensureCartSession();

        const persistedItems = await loadPersistentCart(cartId);

        if (cancelled) {
          return;
        }

        cartIdRef.current = cartId;

        const nextItems = hadLocalChangesBeforeHydrationRef.current
          ? mergeCartItems(persistedItems, itemsRef.current)
          : persistedItems;

        updateItems(nextItems);

        isHydratedRef.current = true;

        /*
         * If the visitor interacted with the shop before
         * Supabase finished loading, synchronize the merged
         * result back to the database.
         */
        if (hadLocalChangesBeforeHydrationRef.current) {
          for (const item of nextItems) {
            enqueueSync(async () => {
              await upsertCartItem(cartId, item.product.id, item.quantity);
            });
          }

          hadLocalChangesBeforeHydrationRef.current = false;
        }
      } catch (error) {
        console.error("Failed to initialize persistent cart:", error);
      }
    }

    void initializeCart();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const nextQuantity = existingItem ? existingItem.quantity + 1 : 1;

    const nextItems = existingItem
      ? currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                product,
                quantity: nextQuantity,
              }
            : item,
        )
      : [
          ...currentItems,
          {
            product,
            quantity: nextQuantity,
          },
        ];

    updateItems(nextItems);

    persistQuantity(product.id, nextQuantity);

    return "added";
  }

  function increaseQuantity(productId: string) {
    const currentItems = itemsRef.current;

    const existingItem = currentItems.find(
      (item) => item.product.id === productId,
    );

    if (!existingItem) {
      return;
    }

    if (existingItem.quantity >= existingItem.product.stock) {
      return;
    }

    const nextQuantity = existingItem.quantity + 1;

    const nextItems = currentItems.map((item) =>
      item.product.id === productId
        ? {
            ...item,
            quantity: nextQuantity,
          }
        : item,
    );

    updateItems(nextItems);

    persistQuantity(productId, nextQuantity);
  }

  function decreaseQuantity(productId: string) {
    const currentItems = itemsRef.current;

    const existingItem = currentItems.find(
      (item) => item.product.id === productId,
    );

    if (!existingItem) {
      return;
    }

    const nextQuantity = existingItem.quantity - 1;

    if (nextQuantity <= 0) {
      const nextItems = currentItems.filter(
        (item) => item.product.id !== productId,
      );

      updateItems(nextItems);

      persistRemoval(productId);

      return;
    }

    const nextItems = currentItems.map((item) =>
      item.product.id === productId
        ? {
            ...item,
            quantity: nextQuantity,
          }
        : item,
    );

    updateItems(nextItems);

    persistQuantity(productId, nextQuantity);
  }

  function removeFromCart(productId: string) {
    const nextItems = itemsRef.current.filter(
      (item) => item.product.id !== productId,
    );

    updateItems(nextItems);

    persistRemoval(productId);
  }

  function clearCart() {
    updateItems([]);

    const cartId = cartIdRef.current;

    if (!cartId || !isHydratedRef.current) {
      hadLocalChangesBeforeHydrationRef.current = true;

      return;
    }

    enqueueSync(async () => {
      await clearPersistentCart(cartId);
    });
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
