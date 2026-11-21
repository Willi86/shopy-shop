const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
  : "";

export type OrderStatus = "active" | "completed" | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type FulfillmentStatus =
  | "unfulfilled"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered";

export type ReturnStatus =
  | "none"
  | "requested"
  | "approved"
  | "rejected"
  | "in_transit"
  | "received"
  | "damaged"
  | "refunded"
  | "replacement_requested"
  | "replacement_sent";

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
  totalPrice: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  returnStatus: ReturnStatus;
  carrier: string | null;
  trackingNumber: string | null;
  paidAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  returnRequestedAt: string | null;
  returnedAt: string | null;
  refundAmount: number | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  postal_code: string;
  city: string;
  total_price: number | string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  return_status: ReturnStatus;
  carrier: string | null;
  tracking_number: string | null;
  paid_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  return_requested_at: string | null;
  returned_at: string | null;
  refund_amount: number | string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  order_items: {
    id: string;
    product_name: string;
    price: number | string;
    quantity: number;
  }[] | null;
};

type AdminOrdersResponse = {
  orders: OrderRow[];
};

function mapOrder(order: OrderRow): AdminOrder {
  return {
    id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerAddress: order.customer_address,
    postalCode: order.postal_code,
    city: order.city,

    totalPrice: Number(order.total_price),

    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    returnStatus: order.return_status,

    carrier: order.carrier,
    trackingNumber: order.tracking_number,

    paidAt: order.paid_at,
    packedAt: order.packed_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
    returnRequestedAt: order.return_requested_at,
    returnedAt: order.returned_at,

    refundAmount: order.refund_amount === null
      ? null
      : Number(order.refund_amount),

    adminNote: order.admin_note,

    createdAt: order.created_at,
    updatedAt: order.updated_at,

    items: (order.order_items ?? []).map((item) => ({
      id: item.id,
      productName: item.product_name,
      price: Number(item.price),
      quantity: item.quantity,
    })),
  };
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/admin/orders`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    console.error("[ADMIN ORDERS] Network request failed:", error);

    throw new Error(
      "Kunde inte ansluta till servern för att hämta ordrar.",
      { cause: error },
    );
  }

  if (response.status === 401) {
    throw new Error(
      "Din administratörssession saknas eller har gått ut. Logga in med GitHub igen.",
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Du saknar behörighet att visa ordrar.",
    );
  }

  if (!response.ok) {
    let message = "Kunde inte ladda ordrar.";

    try {
      const errorData: unknown = await response.json();

      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData &&
        typeof errorData.error === "string"
      ) {
        message = errorData.error;
      }
    } catch (error) {
      console.warn(
        "[ADMIN ORDERS] Could not parse error response:",
        error,
      );
    }

    throw new Error(`${message} (HTTP ${response.status})`);
  }

  let data: AdminOrdersResponse;

  try {
    data = (await response.json()) as AdminOrdersResponse;
  } catch (error) {
    throw new Error(
      "Servern returnerade ett ogiltigt JSON-svar.",
      { cause: error },
    );
  }

  if (!data || !Array.isArray(data.orders)) {
    throw new Error(
      "Servern returnerade ett ogiltigt ordersvar.",
    );
  }

  return data.orders.map(mapOrder);
}
