import { supabase } from "../lib/supabase";

export type OrderHistoryField =
  | "order_status"
  | "payment_status"
  | "fulfillment_status"
  | "return_status"
  | "carrier"
  | "tracking_number"
  | "refund_amount"
  | "admin_note";

export type OrderHistoryEntry = {
  id: string;
  orderId: string;
  changedBy: string | null;
  fieldName: OrderHistoryField;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
};

type OrderHistoryRow = {
  id: string;
  order_id: string;
  changed_by: string | null;
  field_name: OrderHistoryField;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
};

export async function getOrderHistory(
  orderId: string,
): Promise<OrderHistoryEntry[]> {
  const { data, error } = await supabase
    .from("order_status_history")
    .select(`
      id,
      order_id,
      changed_by,
      field_name,
      old_value,
      new_value,
      note,
      created_at
    `)
    .eq("order_id", orderId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Kunde inte ladda orderhistoriken: ${error.message}`,
    );
  }

  return (data as OrderHistoryRow[]).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    changedBy: row.changed_by,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    note: row.note,
    createdAt: row.created_at,
  }));
}