import { supabase } from "../lib/supabase";

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

  total_price: number;

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

  refund_amount: number | null;
  admin_note: string | null;

  created_at: string;
  updated_at: string;

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
      total_price,
      order_status,
      payment_status,
      fulfillment_status,
      return_status,
      carrier,
      tracking_number,
      paid_at,
      packed_at,
      shipped_at,
      delivered_at,
      cancelled_at,
      return_requested_at,
      returned_at,
      refund_amount,
      admin_note,
      created_at,
      updated_at,
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

    refundAmount:
      order.refund_amount === null ? null : Number(order.refund_amount),

    adminNote: order.admin_note,

    createdAt: order.created_at,
    updatedAt: order.updated_at,

    items: order.order_items.map((item) => ({
      id: item.id,
      productName: item.product_name,
      price: Number(item.price),
      quantity: item.quantity,
    })),
  }));
}
