import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useToast } from "../components/ui/useToast";
import { useAuth } from "../features/auth/useAuth";

import {
  getAdminOrders,
  type AdminOrder,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentStatus,
  type ReturnStatus,
} from "../services/adminOrderService";

import {
  getOrderHistory,
  type OrderHistoryEntry,
  type OrderHistoryField,
} from "../services/orderHistoryService";

import { updateOrderManagement } from "../services/orderManagementService";

type OrderDraft = {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  returnStatus: ReturnStatus;

  carrier: string;
  trackingNumber: string;

  refundAmount: string;
  adminNote: string;
  historyNote: string;
};

const orderStatusOptions: {
  value: OrderStatus;
  label: string;
}[] = [
  {
    value: "active",
    label: "Aktiv",
  },
  {
    value: "completed",
    label: "Slutförd",
  },
  {
    value: "cancelled",
    label: "Avbruten",
  },
];

const paymentStatusOptions: {
  value: PaymentStatus;
  label: string;
}[] = [
  {
    value: "pending",
    label: "Väntar på betalning",
  },
  {
    value: "paid",
    label: "Betald",
  },
  {
    value: "failed",
    label: "Betalning misslyckades",
  },
  {
    value: "partially_refunded",
    label: "Delvis återbetald",
  },
  {
    value: "refunded",
    label: "Återbetald",
  },
];

const fulfillmentStatusOptions: {
  value: FulfillmentStatus;
  label: string;
}[] = [
  {
    value: "unfulfilled",
    label: "Ej behandlad",
  },
  {
    value: "processing",
    label: "Behandlas",
  },
  {
    value: "packed",
    label: "Packad",
  },
  {
    value: "shipped",
    label: "Skickad",
  },
  {
    value: "out_for_delivery",
    label: "Ute för leverans",
  },
  {
    value: "delivered",
    label: "Levererad",
  },
];

const returnStatusOptions: {
  value: ReturnStatus;
  label: string;
}[] = [
  {
    value: "none",
    label: "Ingen retur",
  },
  {
    value: "requested",
    label: "Retur begärd",
  },
  {
    value: "approved",
    label: "Retur godkänd",
  },
  {
    value: "rejected",
    label: "Retur nekad",
  },
  {
    value: "in_transit",
    label: "Retur på väg",
  },
  {
    value: "received",
    label: "Retur mottagen",
  },
  {
    value: "damaged",
    label: "Returnerad skadad",
  },
  {
    value: "refunded",
    label: "Retur återbetald",
  },
  {
    value: "replacement_requested",
    label: "Ersättningsvara begärd",
  },
  {
    value: "replacement_sent",
    label: "Ersättningsvara skickad",
  },
];

const historyFieldLabels: Record<OrderHistoryField, string> = {
  order_status: "Orderstatus",
  payment_status: "Betalning",
  fulfillment_status: "Leverans",
  return_status: "Retur",
  carrier: "Transportör",
  tracking_number: "Spårningsnummer",
  refund_amount: "Återbetalningsbelopp",
  admin_note: "Adminanteckning",
};

function createDraft(order: AdminOrder): OrderDraft {
  return {
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    returnStatus: order.returnStatus,

    carrier: order.carrier ?? "",
    trackingNumber: order.trackingNumber ?? "",

    refundAmount: order.refundAmount === null ? "" : String(order.refundAmount),

    adminNote: order.adminNote ?? "",
    historyNote: "",
  };
}

function createDraftMap(orders: AdminOrder[]): Record<string, OrderDraft> {
  return Object.fromEntries(
    orders.map((order) => [order.id, createDraft(order)]),
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("sv-SE");
}

function formatHistoryValue(value: string | null): string {
  if (value === null || value === "") {
    return "—";
  }

  return value.replaceAll("_", " ");
}

function AdminPage() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<AdminOrder[]>([]);

  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);

  const [historyByOrder, setHistoryByOrder] = useState<
    Record<string, OrderHistoryEntry[]>
  >({});

  const [historyLoadingOrderId, setHistoryLoadingOrderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    getAdminOrders()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setOrders(data);
        setDrafts(createDraftMap(data));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setError(
          error instanceof Error ? error.message : "Kunde inte ladda ordrar.",
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadOrders() {
    const data = await getAdminOrders();

    setOrders(data);
    setDrafts(createDraftMap(data));
  }

  async function reloadOrderHistory(orderId: string) {
    const history = await getOrderHistory(orderId);

    setHistoryByOrder((currentHistory) => ({
      ...currentHistory,
      [orderId]: history,
    }));
  }

  function updateDraft<Key extends keyof OrderDraft>(
    orderId: string,
    key: Key,
    value: OrderDraft[Key],
  ) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,

      [orderId]: {
        ...currentDrafts[orderId],
        [key]: value,
      },
    }));
  }

  function resetOrderDraft(order: AdminOrder) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [order.id]: createDraft(order),
    }));
  }

  function toggleOrderEditor(order: AdminOrder) {
    if (editingOrderId === order.id) {
      resetOrderDraft(order);
      setEditingOrderId(null);
      return;
    }

    resetOrderDraft(order);

    setEditingOrderId(order.id);
  }

  async function toggleOrderHistory(orderId: string) {
    if (historyOrderId === orderId) {
      setHistoryOrderId(null);
      return;
    }

    setHistoryOrderId(orderId);

    try {
      setHistoryLoadingOrderId(orderId);

      await reloadOrderHistory(orderId);
    } catch (error) {
      setHistoryOrderId(null);

      showToast({
        title: "Kunde inte ladda historiken",
        description:
          error instanceof Error
            ? error.message
            : "Ett oväntat fel inträffade.",
        variant: "error",
      });
    } finally {
      setHistoryLoadingOrderId(null);
    }
  }

  async function handleSaveOrder(order: AdminOrder) {
    const draft = drafts[order.id];

    if (!draft) {
      return;
    }

    let refundAmount: number | null = null;

    if (draft.refundAmount.trim() !== "") {
      refundAmount = Number(draft.refundAmount);

      if (!Number.isFinite(refundAmount) || refundAmount < 0) {
        showToast({
          title: "Ogiltigt återbetalningsbelopp",
          description: "Ange ett giltigt belopp för återbetalningen.",
          variant: "error",
        });

        return;
      }
    }

    try {
      setSavingOrderId(order.id);

      await updateOrderManagement({
        orderId: order.id,

        currentOrder: order,

        orderStatus: draft.orderStatus,
        paymentStatus: draft.paymentStatus,
        fulfillmentStatus: draft.fulfillmentStatus,
        returnStatus: draft.returnStatus,

        carrier: draft.carrier.trim() || null,

        trackingNumber: draft.trackingNumber.trim() || null,

        refundAmount,

        adminNote: draft.adminNote.trim() || null,

        note: draft.historyNote.trim() || undefined,
      });

      await reloadOrders();

      if (historyOrderId === order.id) {
        await reloadOrderHistory(order.id);
      }

      setEditingOrderId(null);

      showToast({
        title: "Ordern har uppdaterats",
        description: "Ändringarna och orderhistoriken har sparats.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Kunde inte uppdatera ordern",
        description:
          error instanceof Error
            ? error.message
            : "Ett oväntat fel inträffade.",
        variant: "error",
        duration: 6000,
      });
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Adminpanel
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            Orderhantering
          </h1>

          <p className="mt-3 text-slate-600">Inloggad som {user?.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/products"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            Hantera produkter
          </Link>

          <span className="inline-flex w-fit rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold capitalize text-white">
            {role}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 space-y-4">
          {Array.from({
            length: 3,
          }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-slate-950">Inga ordrar ännu</h2>

          <p className="mt-2 text-slate-600">
            Nya beställningar kommer att visas här.
          </p>
        </div>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <div className="mt-8 space-y-6">
          {orders.map((order) => {
            const draft = drafts[order.id];

            if (!draft) {
              return null;
            }

            const isSaving = savingOrderId === order.id;

            const isEditing = editingOrderId === order.id;

            const isHistoryOpen = historyOrderId === order.id;

            const isHistoryLoading = historyLoadingOrderId === order.id;

            const orderHistory = historyByOrder[order.id] ?? [];

            const shippingFieldsRequired =
              draft.fulfillmentStatus === "shipped" ||
              draft.fulfillmentStatus === "out_for_delivery" ||
              draft.fulfillmentStatus === "delivered";

            const refundFieldRelevant =
              draft.paymentStatus === "partially_refunded" ||
              draft.paymentStatus === "refunded" ||
              draft.returnStatus === "refunded";

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Order
                      </p>

                      <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">
                        {order.id}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Skapad {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-100 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Order
                        </p>

                        <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
                          {order.orderStatus.replaceAll("_", " ")}
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                          Betalning
                        </p>

                        <p className="mt-1 text-sm font-semibold capitalize text-blue-900">
                          {order.paymentStatus.replaceAll("_", " ")}
                        </p>
                      </div>

                      <div className="rounded-xl bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                          Leverans
                        </p>

                        <p className="mt-1 text-sm font-semibold capitalize text-amber-900">
                          {order.fulfillmentStatus.replaceAll("_", " ")}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                          Retur
                        </p>

                        <p className="mt-1 text-sm font-semibold capitalize text-emerald-900">
                          {order.returnStatus.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-2">
                    <div>
                      <h2 className="font-bold text-slate-950">Kund</h2>

                      <p className="mt-2 text-slate-700">
                        {order.customerName}
                      </p>

                      <p className="text-sm text-slate-500">
                        {order.customerEmail}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        {order.customerAddress}, {order.postalCode} {order.city}
                      </p>
                    </div>

                    <div>
                      <h2 className="font-bold text-slate-950">Produkter</h2>

                      <div className="mt-2 space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-4 text-sm"
                          >
                            <span className="text-slate-600">
                              {item.productName} × {item.quantity}
                            </span>

                            <span className="font-semibold text-slate-950">
                              {(item.price * item.quantity).toLocaleString(
                                "sv-SE",
                              )}{" "}
                              kr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        Senast uppdaterad {formatDate(order.updatedAt)}
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        Totalt: {order.totalPrice.toLocaleString("sv-SE")} kr
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleOrderHistory(order.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                      >
                        {isHistoryOpen ? "Dölj historik" : "Visa historik"}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => toggleOrderEditor(order)}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-slate-800 hover:shadow active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isEditing ? "Stäng redigering" : "Redigera order"}
                      </button>
                    </div>
                  </div>
                </div>

                {isHistoryOpen && (
                  <section className="border-t border-slate-200 bg-white px-6 py-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                          Audit log
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-slate-950">
                          Orderhistorik
                        </h2>
                      </div>

                      {!isHistoryLoading && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {orderHistory.length} ändringar
                        </span>
                      )}
                    </div>

                    {isHistoryLoading ? (
                      <div className="mt-5 space-y-3">
                        {Array.from({
                          length: 3,
                        }).map((_, index) => (
                          <div
                            key={index}
                            className="h-20 animate-pulse rounded-2xl bg-slate-100"
                          />
                        ))}
                      </div>
                    ) : orderHistory.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm text-slate-600">
                          Det finns ännu ingen sparad historik för den här
                          ordern.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {orderHistory.map((historyEntry) => (
                          <article
                            key={historyEntry.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {historyFieldLabels[historyEntry.fieldName]}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                  <span className="rounded-lg bg-white px-2.5 py-1 text-slate-500">
                                    {formatHistoryValue(historyEntry.oldValue)}
                                  </span>

                                  <span
                                    aria-hidden="true"
                                    className="text-slate-400"
                                  >
                                    →
                                  </span>

                                  <span className="rounded-lg bg-slate-950 px-2.5 py-1 font-semibold text-white">
                                    {formatHistoryValue(historyEntry.newValue)}
                                  </span>
                                </div>
                              </div>

                              <time className="shrink-0 text-xs text-slate-500">
                                {formatDate(historyEntry.createdAt)}
                              </time>
                            </div>

                            {historyEntry.note && (
                              <div className="mt-3 border-t border-slate-200 pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Kommentar
                                </p>

                                <p className="mt-1 text-sm leading-6 text-slate-700">
                                  {historyEntry.note}
                                </p>
                              </div>
                            )}

                            {historyEntry.changedBy && (
                              <p className="mt-3 break-all text-xs text-slate-400">
                                Admin: {historyEntry.changedBy}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {isEditing && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-6">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                        Hantera order
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        Status och leverans
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        Ändra bara det som behöver uppdateras och spara sedan
                        ordern.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label
                          htmlFor={`order-status-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Orderstatus
                        </label>

                        <select
                          id={`order-status-${order.id}`}
                          value={draft.orderStatus}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "orderStatus",
                              event.target.value as OrderStatus,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {orderStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`payment-status-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Betalning
                        </label>

                        <select
                          id={`payment-status-${order.id}`}
                          value={draft.paymentStatus}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "paymentStatus",
                              event.target.value as PaymentStatus,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {paymentStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`fulfillment-status-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Leverans
                        </label>

                        <select
                          id={`fulfillment-status-${order.id}`}
                          value={draft.fulfillmentStatus}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "fulfillmentStatus",
                              event.target.value as FulfillmentStatus,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {fulfillmentStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`return-status-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Retur
                        </label>

                        <select
                          id={`return-status-${order.id}`}
                          value={draft.returnStatus}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "returnStatus",
                              event.target.value as ReturnStatus,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {returnStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`carrier-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Transportör
                        </label>

                        <input
                          id={`carrier-${order.id}`}
                          type="text"
                          value={draft.carrier}
                          disabled={isSaving}
                          required={shippingFieldsRequired}
                          onChange={(event) =>
                            updateDraft(order.id, "carrier", event.target.value)
                          }
                          placeholder="Ex. PostNord, DHL, UPS"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`tracking-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Spårningsnummer
                        </label>

                        <input
                          id={`tracking-${order.id}`}
                          type="text"
                          value={draft.trackingNumber}
                          disabled={isSaving}
                          required={shippingFieldsRequired}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "trackingNumber",
                              event.target.value,
                            )
                          }
                          placeholder="Spårningsnummer"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    {refundFieldRelevant && (
                      <div className="mt-5">
                        <label
                          htmlFor={`refund-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Återbetalningsbelopp (kr)
                        </label>

                        <input
                          id={`refund-${order.id}`}
                          type="number"
                          min="0"
                          max={order.totalPrice}
                          step="0.01"
                          value={draft.refundAmount}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "refundAmount",
                              event.target.value,
                            )
                          }
                          className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          Maximalt {order.totalPrice.toLocaleString("sv-SE")}{" "}
                          kr.
                        </p>
                      </div>
                    )}

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`admin-note-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Adminanteckning
                        </label>

                        <textarea
                          id={`admin-note-${order.id}`}
                          rows={4}
                          value={draft.adminNote}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "adminNote",
                              event.target.value,
                            )
                          }
                          placeholder="Intern information om ordern..."
                          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`history-note-${order.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Kommentar till ändringen
                        </label>

                        <textarea
                          id={`history-note-${order.id}`}
                          rows={4}
                          value={draft.historyNote}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "historyNote",
                              event.target.value,
                            )
                          }
                          placeholder="Ex. Kunden bekräftade retur via e-post."
                          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          Sparas tillsammans med ändringen i orderhistoriken.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Betald
                        </p>

                        <p className="mt-1 text-slate-700">
                          {formatDate(order.paidAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Packad
                        </p>

                        <p className="mt-1 text-slate-700">
                          {formatDate(order.packedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Skickad
                        </p>

                        <p className="mt-1 text-slate-700">
                          {formatDate(order.shippedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Levererad
                        </p>

                        <p className="mt-1 text-slate-700">
                          {formatDate(order.deliveredAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => resetOrderDraft(order)}
                        className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Återställ
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleSaveOrder(order)}
                        className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none disabled:active:scale-100"
                      >
                        {isSaving ? "Sparar..." : "Spara ändringar"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default AdminPage;
