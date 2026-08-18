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

function getFileExtension(file: File): string {
  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/jpeg") {
    return "jpg";
  }

  throw new Error("Endast JPG och WebP stöds.");
}

async function uploadProductImage(
  file: File,
): Promise<UploadedImage> {
  const extension = getFileExtension(file);

  const path = `products/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Kunde inte ladda upp bilden: ${error.message}`,
    );
  }

  const { data } = supabase.storage
    .from(PRODUCT_BUCKET)
    .getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

async function removeProductImage(
  path: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(
      `Kunde inte ta bort produktbilden: ${error.message}`,
    );
  }
}

function getStoragePathFromPublicUrl(
  publicUrl: string,
): string | null {
  const marker =
    `/storage/v1/object/public/${PRODUCT_BUCKET}/`;

  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const path = publicUrl.slice(
    markerIndex + marker.length,
  );

  return decodeURIComponent(path);
}

export async function createAdminProduct(
  product: ProductFormData,
  image: File,
): Promise<void> {
  const uploadedImage =
    await uploadProductImage(image);

  const { error } = await supabase
    .from("products")
    .insert({
      name: product.name.trim(),
      description: product.description.trim(),
      price: product.price,
      stock: product.stock,
      category: product.category.trim(),
      image_url: uploadedImage.publicUrl,
    });

  if (error) {
    await removeProductImage(
      uploadedImage.path,
    ).catch(console.error);

    throw new Error(
      `Kunde inte skapa produkten: ${error.message}`,
    );
  }
}

export async function updateAdminProduct(
  productId: string,
  product: ProductFormData,
  currentImageUrl: string,
  newImage?: File,
): Promise<void> {
  let uploadedImage: UploadedImage | null = null;

  if (newImage) {
    uploadedImage =
      await uploadProductImage(newImage);
  }

  const imageUrl =
    uploadedImage?.publicUrl ??
    currentImageUrl;

  const { error } = await supabase
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
    .eq("id", productId);

  if (error) {
    if (uploadedImage) {
      await removeProductImage(
        uploadedImage.path,
      ).catch(console.error);
    }

    throw new Error(
      `Kunde inte uppdatera produkten: ${error.message}`,
    );
  }

  if (
    uploadedImage &&
    currentImageUrl !== uploadedImage.publicUrl
  ) {
    const oldImagePath =
      getStoragePathFromPublicUrl(
        currentImageUrl,
      );

    if (oldImagePath) {
      await removeProductImage(
        oldImagePath,
      ).catch((error) => {
        console.error(
          "Could not remove previous product image:",
          error,
        );
      });
    }
  }
}