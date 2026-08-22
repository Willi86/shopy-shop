import { supabase } from "../lib/supabase";

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

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

export async function updateOrderManagement(
  input: UpdateOrderInput,
): Promise<void> {
  const carrier = normalizeText(input.carrier);

  const trackingNumber = normalizeText(input.trackingNumber);

  const adminNote = normalizeText(input.adminNote);

  const historyNote = normalizeText(input.note);

  if (
    input.refundAmount !== null &&
    (!Number.isFinite(input.refundAmount) || input.refundAmount < 0)
  ) {
    throw new Error("Återbetalningsbeloppet är ogiltigt.");
  }

  const { error } = await supabase.rpc("update_order_management", {
    p_order_id: input.orderId,

    p_order_status: input.orderStatus,

    p_payment_status: input.paymentStatus,

    p_fulfillment_status: input.fulfillmentStatus,

    p_return_status: input.returnStatus,

    p_carrier: carrier,

    p_tracking_number: trackingNumber,

    p_refund_amount: input.refundAmount,

    p_admin_note: adminNote,

    p_history_note: historyNote,
  });

  if (error) {
    throw new Error(`Kunde inte uppdatera ordern: ${error.message}`);
  }
}
