import { supabase } from "../lib/supabase";

export type AdminOrderItem = {
  id: string;
  productName: string;
  price: number;
  quantity: number;
};

export type AdminOrder = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  postalCode: string;
  city: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  items: AdminOrderItem[];
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  postal_code: string;
  city: string;
  status: string;
  total_price: number;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    price: number;
    quantity: number;
  }[];
};

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      customer_name,
      customer_email,
      customer_address,
      postal_code,
      city,
      status,
      total_price,
      created_at,
      order_items (
        id,
        product_name,
        price,
        quantity
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte ladda ordrar: ${error.message}`);
  }

  return (data as OrderRow[]).map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerAddress: order.customer_address,
    postalCode: order.postal_code,
    city: order.city,
    status: order.status,
    totalPrice: Number(order.total_price),
    createdAt: order.created_at,
    items: order.order_items.map((item) => ({
      id: item.id,
      productName: item.product_name,
      price: Number(item.price),
      quantity: item.quantity,
    })),
  }));
}
