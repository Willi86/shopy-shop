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

function mapProduct(row: ProductRow): Product {
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

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, category")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return (data as ProductRow[]).map(mapProduct);
}

export async function getProductById(productId: string): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, category")
    .eq("id", productId)
    .single();

  if (error) {
    throw new Error(`Failed to load product: ${error.message}`);
  }

  return mapProduct(data as ProductRow);
}
