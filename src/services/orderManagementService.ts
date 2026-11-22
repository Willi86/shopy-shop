import type {
  AdminOrder,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
} from "./adminOrderService";

export type UpdateOrderInput = {
  orderId: string;

  currentOrder: AdminOrder;

  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  returnStatus: ReturnStatus;

  carrier: string | null;
  trackingNumber: string | null;

  refundAmount: number | null;
  adminNote: string | null;

  note?: string;
};

// Same-origin in production (goes through the Vercel /api rewrite),
// so the GitHub admin session cookie is sent.
const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
  : "";

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

export async function updateOrderManagement(
  input: UpdateOrderInput,
): Promise<void> {
  if (
    input.refundAmount !== null &&
    (!Number.isFinite(input.refundAmount) || input.refundAmount < 0)
  ) {
    throw new Error("Återbetalningsbeloppet är ogiltigt.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(input.orderId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        orderStatus: input.orderStatus,
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: input.fulfillmentStatus,
        returnStatus: input.returnStatus,
        carrier: normalizeText(input.carrier),
        trackingNumber: normalizeText(input.trackingNumber),
        refundAmount: input.refundAmount,
        adminNote: normalizeText(input.adminNote),
        historyNote: normalizeText(input.note),
      }),
    },
  );

  if (response.status === 401) {
    throw new Error("Din administratörssession har gått ut. Logga in igen.");
  }

  if (!response.ok) {
    let message = "Kunde inte uppdatera ordern.";

    try {
      const data: { error?: string } = await response.json();

      if (data.error) {
        message = data.error;
      }
    } catch {
      // keep default message
    }

    throw new Error(message);
  }
}
