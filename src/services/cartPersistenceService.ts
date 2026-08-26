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

let ensureCartPromise: Promise<string> | null = null;

function mapProduct(
  row: NonNullable<CartItemRow["products"]>,
): Product {
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

async function getOrCreateCart(
  userId: string,
): Promise<string> {
  const {
    data: existingCart,
    error: existingCartError,
  } = await supabase
    .from("carts")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCartError) {
    throw new Error(
      `Kunde inte läsa varukorgen: ${existingCartError.message}`,
    );
  }

  if (existingCart) {
    return (existingCart as CartRow).id;
  }

  const {
    data: createdCart,
    error: createCartError,
  } = await supabase
    .from("carts")
    .insert({
      user_id: userId,
    })
    .select("id, user_id")
    .single();

  if (!createCartError && createdCart) {
    return (createdCart as CartRow).id;
  }

  /*
   * Another initialization may have created the same cart
   * between our SELECT and INSERT.
   *
   * Because carts.user_id is unique, PostgreSQL correctly
   * rejects the duplicate. Instead of treating that as a
   * fatal error, read the cart that now exists.
   */
  if (createCartError?.code === "23505") {
    const {
      data: concurrentCart,
      error: concurrentCartError,
    } = await supabase
      .from("carts")
      .select("id, user_id")
      .eq("user_id", userId)
      .single();

    if (concurrentCartError) {
      throw new Error(
        `Kunde inte läsa den skapade varukorgen: ${concurrentCartError.message}`,
      );
    }

    return (concurrentCart as CartRow).id;
  }

  throw new Error(
    `Kunde inte skapa varukorgen: ${
      createCartError?.message ??
        "Okänt databasfel."
    }`,
  );
}

async function initializeCartSession(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      `Kunde inte läsa kundsessionen: ${sessionError.message}`,
    );
  }

  let currentSession = session;

  /*
   * If there is no Supabase session at all, create the
   * anonymous guest identity used by the persistent cart.
   */
  if (!currentSession) {
    const {
      data,
      error,
    } = await supabase.auth.signInAnonymously();

    if (error) {
      throw new Error(
        `Kunde inte skapa gästsession: ${error.message}`,
      );
    }

    currentSession = data.session;

    if (!currentSession) {
      throw new Error(
        "Kunde inte skapa en kundsession.",
      );
    }
  }

  /*
   * Verify the user against Supabase Auth instead of relying
   * only on the locally cached session object.
   */
  let {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  /*
   * The access token may have become unusable while a refresh
   * token is still available. Ask Supabase Auth for a fresh
   * session once before giving up.
   */
  if (userError || !userData.user) {
    const {
      data: refreshedData,
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw new Error(
        `Kunde inte uppdatera kundsessionen: ${refreshError.message}`,
      );
    }

    if (!refreshedData.session) {
      throw new Error(
        "Kundsessionen kunde inte uppdateras.",
      );
    }

    const verifiedUser = await supabase.auth.getUser();

    userData = verifiedUser.data;
    userError = verifiedUser.error;
  }

  if (userError || !userData.user) {
    throw new Error(
      `Kunde inte verifiera kundsessionen: ${
        userError?.message ??
          "Ingen användare hittades."
      }`,
    );
  }

  return getOrCreateCart(
    userData.user.id,
  );
}

export async function ensureCartSession(): Promise<string> {
  /*
   * All simultaneous callers share the SAME initialization.
   *
   * This is important during React development where more
   * than one component/effect can request cart initialization
   * almost simultaneously.
   */
  if (!ensureCartPromise) {
    ensureCartPromise = initializeCartSession().finally(() => {
      ensureCartPromise = null;
    });
  }

  return ensureCartPromise;
}

export async function loadPersistentCart(
  cartId: string,
): Promise<CartItem[]> {
  const {
    data,
    error,
  } = await supabase
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
    throw new Error(
      `Kunde inte ladda varukorgen: ${error.message}`,
    );
  }

  const rows = data as unknown as CartItemRow[];

  return rows
    .filter(
      (
        row,
      ): row is CartItemRow & {
        products: NonNullable<
          CartItemRow["products"]
        >;
      } => row.products !== null,
    )
    .map((row) => ({
      product: mapProduct(
        row.products,
      ),

      quantity: Math.min(
        row.quantity,
        row.products.stock,
      ),
    }))
    .filter(
      (item) => item.quantity > 0,
    );
}

export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(
      cartId,
      productId,
    );

    return;
  }

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
    throw new Error(
      `Kunde inte spara varukorgen: ${error.message}`,
    );
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

export async function clearPersistentCart(
  cartId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(
      `Kunde inte tömma varukorgen: ${error.message}`,
    );
  }
}
