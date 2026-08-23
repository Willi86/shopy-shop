import { supabase } from "../lib/supabase";

import type { CartItem } from "../types/cart";
import type { Product } from "../types/product";

type CartRow = {
  id: string;
  user_id: string;
};

type CartItemRow = {
  id: string;
  quantity: number;

  products: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    stock: number;
    category: string;
  } | null;
};

function mapProduct(row: NonNullable<CartItemRow["products"]>): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    imageUrl: row.image_url,
    stock: row.stock,
    category: row.category,
  };
}

export async function ensureCartSession(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Kunde inte läsa kundsessionen: ${sessionError.message}`);
  }

  let userId = session?.user.id ?? null;

  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      throw new Error(`Kunde inte skapa gästsession: ${error.message}`);
    }

    userId = data.user?.id ?? null;
  }

  if (!userId) {
    throw new Error("Kunde inte skapa en kundsession.");
  }

  const { data: existingCart, error: existingCartError } = await supabase
    .from("carts")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCartError) {
    throw new Error(`Kunde inte läsa varukorgen: ${existingCartError.message}`);
  }

  if (existingCart) {
    return (existingCart as CartRow).id;
  }

  const { data: createdCart, error: createCartError } = await supabase
    .from("carts")
    .insert({
      user_id: userId,
    })
    .select("id, user_id")
    .single();

  if (createCartError) {
    throw new Error(`Kunde inte skapa varukorgen: ${createCartError.message}`);
  }

  return (createdCart as CartRow).id;
}

export async function loadPersistentCart(cartId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      quantity,
      products (
        id,
        name,
        description,
        price,
        image_url,
        stock,
        category
      )
    `,
    )
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(`Kunde inte ladda varukorgen: ${error.message}`);
  }

  const rows = data as unknown as CartItemRow[];

  return rows
    .filter(
      (
        row,
      ): row is CartItemRow & {
        products: NonNullable<CartItemRow["products"]>;
      } => row.products !== null,
    )
    .map((row) => ({
      product: mapProduct(row.products),
      quantity: Math.min(row.quantity, row.products.stock),
    }))
    .filter((item) => item.quantity > 0);
}

export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(cartId, productId);
    return;
  }

  const { error } = await supabase.from("cart_items").upsert(
    {
      cart_id: cartId,
      product_id: productId,
      quantity,
    },
    {
      onConflict: "cart_id,product_id",
    },
  );

  if (error) {
    throw new Error(`Kunde inte spara varukorgen: ${error.message}`);
  }
}

export async function removeCartItem(
  cartId: string,
  productId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(
      `Kunde inte ta bort produkten från varukorgen: ${error.message}`,
    );
  }
}

export async function clearPersistentCart(cartId: string): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(`Kunde inte tömma varukorgen: ${error.message}`);
  }
}
