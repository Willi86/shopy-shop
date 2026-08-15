import { supabase } from "../lib/supabase";
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

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, category")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return (data as ProductRow[]).map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    imageUrl: product.image_url,
    stock: product.stock,
    category: product.category,
  }));
}
