import type { CartItem } from "../types/cart";

export type ShippingMethod = "pickup" | "home";

type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  postalCode: string;
  city: string;
  shippingMethod: ShippingMethod;
  pickupPointId?: string;
  items: CartItem[];
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
      shippingMethod: order.shippingMethod,
      pickupPointId: order.shippingMethod === "pickup"
        ? order.pickupPointId
        : undefined,
      items: order.items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Servern skickade ett oväntat svar. Kontrollera API-servern.",
    );
  }

  const result: {
    orderId?: unknown;
    error?: string;
  } = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? "Kunde inte skapa ordern.");
  }

  if (
    typeof result.orderId !== "string" ||
    !result.orderId
  ) {
    throw new Error("Servern returnerade inget giltigt order-ID.");
  }

  return result.orderId;
}
