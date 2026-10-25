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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function createOrder(
  order: CreateOrderInput,
): Promise<string> {
  const response = await fetch(`${API_URL}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerAddress: order.customerAddress,
      postalCode: order.postalCode,
      city: order.city,
      items: order.items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error ?? "Kunde inte skapa ordern.",
    );
  }

  if (!result.orderId) {
    throw new Error("Servern returnerade inget order-ID.");
  }

  return result.orderId;
}
