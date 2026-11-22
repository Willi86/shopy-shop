import { Router } from "express";
import { z } from "zod";

const orderStatus = z.enum(["active", "completed", "cancelled"]);

const paymentStatus = z.enum([
  "pending",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
]);

const fulfillmentStatus = z.enum([
  "unfulfilled",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
]);

const returnStatus = z.enum([
  "none",
  "requested",
  "approved",
  "rejected",
  "in_transit",
  "received",
  "damaged",
  "refunded",
  "replacement_requested",
  "replacement_sent",
]);

const updateOrderSchema = z.object({
  orderStatus,
  paymentStatus,
  fulfillmentStatus,
  returnStatus,
  carrier: z.string().trim().max(100).nullable(),
  trackingNumber: z.string().trim().max(100).nullable(),
  refundAmount: z.number().finite().min(0).max(99999999.99).nullable(),
  adminNote: z.string().trim().max(5000).nullable(),
  historyNote: z.string().trim().max(2000).nullable(),
});

const idSchema = z.uuid();

/**
 * Admin order routes.
 * Mount with: app.use("/api/admin", requireGithubAdmin, createAdminOrderRouter({ paymentDb }))
 */
export function createAdminOrderRouter({ paymentDb }) {
  const router = Router();

  // GET /api/admin/orders
  router.get("/orders", async (_req, res) => {
    try {
      const params = new URLSearchParams({
        select: "*,order_items(id,product_name,price,quantity)",
        order: "created_at.desc",
        limit: "500",
      });

      const orders = await paymentDb(`/rest/v1/orders?${params}`);

      return res.json({ orders: orders ?? [] });
    } catch (error) {
      console.error("Admin orders load failed:", error);

      return res.status(502).json({ error: "Kunde inte ladda ordrar." });
    }
  });

  // GET /api/admin/orders/:id/history
  router.get("/orders/:id/history", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);

    if (!id.success) {
      return res.status(400).json({ error: "Ogiltigt order-ID." });
    }

    try {
      const params = new URLSearchParams({
        select:
          "id,order_id,changed_by,field_name,old_value,new_value,note,created_at",
        order_id: `eq.${id.data}`,
        order: "created_at.desc",
      });

      const history = await paymentDb(
        `/rest/v1/order_status_history?${params}`,
      );

      return res.json({ history: history ?? [] });
    } catch (error) {
      console.error("Admin order history failed:", error);

      return res
        .status(502)
        .json({ error: "Kunde inte ladda orderhistoriken." });
    }
  });

  // PATCH /api/admin/orders/:id
  router.patch("/orders/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);

    if (!id.success) {
      return res.status(400).json({ error: "Ogiltigt order-ID." });
    }

    const parsed = updateOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Ogiltig orderinformation.",
        details: z.treeifyError(parsed.error),
      });
    }

    const d = parsed.data;

    // Empty strings become null.
    const clean = (value) => (value && value.length > 0 ? value : null);

    try {
      await paymentDb("/rest/v1/rpc/update_order_management", {
        method: "POST",
        body: JSON.stringify({
          p_order_id: id.data,
          p_order_status: d.orderStatus,
          p_payment_status: d.paymentStatus,
          p_fulfillment_status: d.fulfillmentStatus,
          p_return_status: d.returnStatus,
          p_carrier: clean(d.carrier),
          p_tracking_number: clean(d.trackingNumber),
          p_refund_amount: d.refundAmount,
          p_admin_note: clean(d.adminNote),
          p_history_note: clean(d.historyNote),
        }),
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Admin order update failed:", error);

      return res.status(502).json({ error: "Kunde inte uppdatera ordern." });
    }
  });

  return router;
}
