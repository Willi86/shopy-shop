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

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
  : "";

export async function getOrderHistory(
  orderId: string,
): Promise<OrderHistoryEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}/history`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );

  if (response.status === 401) {
    throw new Error("Din administratörssession har gått ut. Logga in igen.");
  }

  if (!response.ok) {
    throw new Error(
      `Kunde inte ladda orderhistoriken. (HTTP ${response.status})`,
    );
  }

  const data = (await response.json()) as { history?: OrderHistoryRow[] };

  return (data.history ?? []).map((row) => ({
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
