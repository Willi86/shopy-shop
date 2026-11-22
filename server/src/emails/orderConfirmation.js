import { sendEmail } from "../integrations/emailAdapter.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSek(value) {
  return `${Number(value).toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}

function buildConfirmation(order) {
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  const items = (order.order_items ?? []).map((item) => ({
    name: item.product_name,
    quantity: Number(item.quantity),
    price: Number(item.price),
  }));

  const itemsTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const total = Number(order.total_price);
  const shipping = Math.round((total - itemsTotal) * 100) / 100;

  const subject = `Orderbekräftelse – order ${orderNumber}`;

  // ---------- Plain text ----------
  const textLines = [
    `Hej ${order.customer_name}!`,
    "",
    `Tack för din beställning. Din betalning är mottagen.`,
    `Ordernummer: ${orderNumber}`,
    "",
    "Produkter:",
    ...items.map(
      (item) =>
        `- ${item.name} x ${item.quantity}: ${formatSek(item.price * item.quantity)}`,
    ),
  ];

  if (shipping > 0) {
    textLines.push(`- Frakt: ${formatSek(shipping)}`);
  }

  textLines.push("", `Totalt: ${formatSek(total)}`, "", "Priamos 3D Lab");

  // ---------- HTML (all customer data is escaped) ----------
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 0">${escapeHtml(item.name)} × ${item.quantity}</td>
          <td style="padding:6px 0;text-align:right">${escapeHtml(
            formatSek(item.price * item.quantity),
          )}</td>
        </tr>`,
    )
    .join("");

  const shippingRow =
    shipping > 0
      ? `
        <tr>
          <td style="padding:6px 0">Frakt</td>
          <td style="padding:6px 0;text-align:right">${escapeHtml(
            formatSek(shipping),
          )}</td>
        </tr>`
      : "";

  const html = `<!doctype html>
<html lang="sv">
  <body style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
    <h1 style="font-size:22px">Tack för din beställning!</h1>
    <p>Hej ${escapeHtml(order.customer_name)},</p>
    <p>Din betalning är mottagen.</p>
    <p><strong>Ordernummer:</strong> ${escapeHtml(orderNumber)}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      ${rows}
      ${shippingRow}
      <tr>
        <td style="padding:12px 0;border-top:1px solid #cbd5e1"><strong>Totalt</strong></td>
        <td style="padding:12px 0;border-top:1px solid #cbd5e1;text-align:right"><strong>${escapeHtml(
          formatSek(total),
        )}</strong></td>
      </tr>
    </table>
    <p style="margin-top:24px;color:#64748b">Priamos 3D Lab</p>
  </body>
</html>`;

  return { subject, html, text: textLines.join("\n") };
}

/**
 * Loads the paid order and sends the confirmation email.
 * One email per order: the Idempotency-Key is tied to the order id,
 * so a repeated Stripe webhook never sends a second email.
 */
async function sendOrderConfirmation({ paymentDb, orderId }) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
    select:
      "id,customer_name,customer_email,total_price,order_items(product_name,price,quantity)",
    limit: "1",
  });

  const orders = await paymentDb(`/rest/v1/orders?${params}`);
  const order = orders?.[0];

  if (!order) {
    throw new Error(`Order ${orderId} not found for confirmation email`);
  }

  const { subject, html, text } = buildConfirmation(order);

  return sendEmail({
    to: order.customer_email,
    subject,
    html,
    text,
    idempotencyKey: `order-confirmation/${order.id}`,
  });
}

/**
 * Never throws. A failed email must not affect the paid order
 * and must not make the Stripe webhook answer 500.
 */
export async function sendOrderConfirmationSafely({ paymentDb, orderId }) {
  try {
    const result = await sendOrderConfirmation({ paymentDb, orderId });

    console.log("Order confirmation email sent:", {
      orderId,
      emailId: result.id,
    });
  } catch (error) {
    console.error("Order confirmation email failed:", {
      orderId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}