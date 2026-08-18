import { supabase } from "../lib/supabase";
import type { CartItem } from "../types/cart";

type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  postalCode: string;
  city: string;
  totalPrice: number;
  items: CartItem[];
};

async function decreaseStock(items: CartItem[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase.rpc("decrease_product_stock", {
      p_product_id: item.product.id,
      p_quantity: item.quantity,
    });

    if (error) {
      throw new Error(
        `Kunde inte uppdatera lagersaldot för ${item.product.name}: ${error.message}`,
      );
    }
  }
}

export async function createOrder(order: CreateOrderInput): Promise<string> {
  const orderId = crypto.randomUUID();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_address: order.customerAddress,
    postal_code: order.postalCode,
    city: order.city,
    total_price: order.totalPrice,
    status: "ordered",
  });

  if (orderError) {
    throw new Error(`Kunde inte skapa order: ${orderError.message}`);
  }

  const orderItems = order.items.map((item) => ({
    order_id: orderId,
    product_id: item.product.id,
    product_name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
  }));

  const { error: orderItemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (orderItemsError) {
    throw new Error(
      `Ordern skapades men orderraderna kunde inte sparas: ${orderItemsError.message}`,
    );
  }

  await decreaseStock(order.items);

  return orderId;
}
