import { Router } from "express";
import { requireCustomer } from "../../auth/googleAuthRoutes.js";

export function createCustomerOrderRouter({ paymentDb }) {
  const router = Router();

  // All routes require a valid Google customer session.
  router.use(requireCustomer);

  // GET /api/customers/me/orders
  router.get("/me/orders", async (_req, res) => {
    const customerId = res.locals.customerId;

    if (!customerId) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    try {
      const params = new URLSearchParams({
        select: [
          "id",
          "created_at",
          "total_price",
          "order_status",
          "payment_status",
          "fulfillment_status",
        ].join(","),
        customer_id: `eq.${customerId}`,
        order: "created_at.desc",
        limit: "100",
      });

      const orders = await paymentDb(`/rest/v1/orders?${params.toString()}`);

      if (!Array.isArray(orders)) {
        throw new Error("Unexpected order history response");
      }

      return res.json({
        orders: orders.map((order) => ({
          id: order.id,
          createdAt: order.created_at,
          totalPrice: Number(order.total_price),
          currency: "SEK",
          orderStatus: order.order_status,
          paymentStatus: order.payment_status,
          fulfillmentStatus: order.fulfillment_status,
        })),
      });
    } catch (error) {
      console.error("Customer order history failed:", error);

      return res.status(500).json({
        error: "Could not load customer orders",
      });
    }
  });

  return router;
}
