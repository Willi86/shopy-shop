import { supabase } from "../lib/supabase";

export type ProductFormData = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
};

type UploadedImage = {
  path: string;
  publicUrl: string;
};

const PRODUCT_BUCKET = "product-images";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3001"
).replace(/\/$/, "");

function validateImage(file: File): void {
  if (file.type !== "image/jpeg") {
    throw new Error("Endast JPG-bilder stöds.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Bilden får vara högst 5 MB.");
  }
}

async function getAdminAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(
      "Kunde inte läsa administratörssessionen.",
      { cause: error },
    );
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Ingen aktiv administratörssession.");
  }

  return accessToken;
}

async function getApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const result: { error?: string } = await response.json();

    return result.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

/**
 * Uploads a product image through the Express backend.
 * The browser no longer uploads directly to Supabase Storage.
 */
async function uploadProductImage(
  file: File,
): Promise<UploadedImage> {
  validateImage(file);

  const accessToken = await getAdminAccessToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/product-images/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const message = await getApiError(
      response,
      "Kunde inte ladda upp produktbilden.",
    );

    throw new Error(message);
  }

  const result: {
    success?: boolean;
    path?: string;
    publicUrl?: string;
  } = await response.json();

  if (
    !result.success ||
    !result.path ||
    !result.publicUrl
  ) {
    throw new Error(
      "Servern returnerade ett ogiltigt svar vid bilduppladdning.",
    );
  }

  return {
    path: result.path,
    publicUrl: result.publicUrl,
  };
}

/**
 * Removes an unused product image through Express.
 */
async function removeProductImage(
  path: string,
): Promise<void> {
  const accessToken = await getAdminAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/api/product-images`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    },
  );

  if (!response.ok) {
    const message = await getApiError(
      response,
      "Kunde inte ta bort produktbilden.",
    );

    throw new Error(message);
  }

  const result: {
    success?: boolean;
    removed?: boolean;
  } = await response.json();

  if (!result.success || !result.removed) {
    throw new Error(
      "Servern kunde inte bekräfta att bilden togs bort.",
    );
  }
}

function getStoragePathFromPublicUrl(
  publicUrl: string,
): string | null {
  const marker = `/storage/v1/object/public/${PRODUCT_BUCKET}/`;

  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const path = publicUrl.slice(
    markerIndex + marker.length,
  );

  return decodeURIComponent(path);
}

/**
 * Synchronizes a product with Algolia through Express.
 *
 * Synchronization is best-effort for product creation
 * and updates.
 */
async function syncProductWithAlgolia(
  productId: string,
): Promise<void> {
  try {
    const accessToken = await getAdminAccessToken();

    const response = await fetch(
      `${API_BASE_URL}/api/algolia/products/${
        encodeURIComponent(
          productId,
        )
      }/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Algolia synchronization request failed: ${response.status}`,
      );
    }

    const result: {
      success?: boolean;
      synced?: boolean;
    } = await response.json();

    if (!result.synced) {
      throw new Error(
        "Backend could not confirm Algolia synchronization.",
      );
    }
  } catch (error) {
    console.warn(
      "Product saved in Supabase, but Algolia synchronization failed:",
      error,
    );
  }
}

/**
 * Removes a deleted product from Algolia.
 */
async function removeProductFromAlgolia(
  productId: string,
): Promise<void> {
  const accessToken = await getAdminAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/api/algolia/products/${
      encodeURIComponent(
        productId,
      )
    }/sync`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Algolia deletion request failed: ${response.status}`,
    );
  }

  const result: {
    success?: boolean;
    removed?: boolean;
  } = await response.json();

  if (!result.success || !result.removed) {
    throw new Error(
      "Algolia could not confirm product removal.",
    );
  }
}

/**
 * Creates a product with an image uploaded through Express.
 */
export async function createAdminProduct(
  product: ProductFormData,
  image: File,
): Promise<void> {
  const uploadedImage = await uploadProductImage(image);

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: product.name.trim(),
      description: product.description.trim(),
      price: product.price,
      stock: product.stock,
      category: product.category.trim(),
      image_url: uploadedImage.publicUrl,
    })
    .select("id")
    .single();

  if (error) {
    await removeProductImage(
      uploadedImage.path,
    ).catch(console.error);

    throw new Error(
      `Kunde inte skapa produkten: ${error.message}`,
      { cause: error },
    );
  }

  await syncProductWithAlgolia(data.id);
}

/**
 * Updates a product and optionally replaces its image.
 */
export async function updateAdminProduct(
  productId: string,
  product: ProductFormData,
  currentImageUrl: string,
  newImage?: File,
): Promise<void> {
  let uploadedImage: UploadedImage | null = null;

  if (newImage) {
    uploadedImage = await uploadProductImage(newImage);
  }

  const imageUrl = uploadedImage?.publicUrl ?? currentImageUrl;

  const { data, error } = await supabase
    .from("products")
    .update({
      name: product.name.trim(),
      description: product.description.trim(),
      price: product.price,
      stock: product.stock,
      category: product.category.trim(),
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("id")
    .single();

  if (error) {
    if (uploadedImage) {
      await removeProductImage(
        uploadedImage.path,
      ).catch(console.error);
    }

    throw new Error(
      `Kunde inte uppdatera produkten: ${error.message}`,
      { cause: error },
    );
  }

  if (
    uploadedImage &&
    currentImageUrl !== uploadedImage.publicUrl
  ) {
    const oldImagePath = getStoragePathFromPublicUrl(currentImageUrl);

    if (oldImagePath !== null) {
      try {
        await removeProductImage(oldImagePath);
      } catch (error) {
        console.error(
          "Could not remove previous product image:",
          error,
        );
      }
    }
  }

  await syncProductWithAlgolia(data.id);
}

/**
 * Deletes a product from Supabase and Algolia,
 * then removes its managed image through Express.
 */
export async function deleteAdminProduct(
  productId: string,
  currentImageUrl: string,
): Promise<void> {
  await getAdminAccessToken();

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .select("id");

  if (error) {
    throw new Error(
      `Kunde inte ta bort produkten: ${error.message}`,
      { cause: error },
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Produkten kunde inte hittas eller tas bort.",
    );
  }

  try {
    await removeProductFromAlgolia(productId);
  } catch (error) {
    console.error(
      "Product deleted from Supabase, but Algolia removal failed:",
      error,
    );

    throw new Error(
      "Produkten har tagits bort från databasen, men kunde inte tas bort från Algolia. Sökindexet behöver synkroniseras.",
      { cause: error },
    );
  }

  const imagePath = getStoragePathFromPublicUrl(currentImageUrl);

  if (imagePath !== null) {
    try {
      await removeProductImage(imagePath);
    } catch (error) {
      console.warn(
        "Product deleted, but its image could not be removed:",
        error,
      );
    }
  }
}
