import { supabase } from "../lib/supabase";
import type { CartItem } from "../types/cart";
import type { Product } from "../types/product";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
};

type CartItemRow = {
  id: string;
  quantity: number;
  products: ProductRow[];
};

export async function getOrCreateCart(userId: string): Promise<string> {
  const { data: existingCart, error: selectError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existingCart) {
    return existingCart.id;
  }

  const { data: newCart, error: insertError } = await supabase
    .from("carts")
    .insert({
      user_id: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return newCart.id;
}

export async function getCartItems(
  cartId: string,
): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(`
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
    `)
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as CartItemRow[];

  return rows
    .map((row) => {
      const productRow = row.products[0];

      if (!productRow) {
        return null;
      }

      const product: Product = {
        id: productRow.id,
        name: productRow.name,
        description: productRow.description,
        price: Number(productRow.price),
        imageUrl: productRow.image_url,
        stock: productRow.stock,
        category: productRow.category,
      };

      return {
        product,
        quantity: row.quantity,
      };
    })
    .filter((item): item is CartItem => item !== null);
}

export async function saveCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .upsert(
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
    throw new Error(error.message);
  }
}

export async function deleteCartItem(
  cartId: string,
  productId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearCartItems(
  cartId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(error.message);
  }
}