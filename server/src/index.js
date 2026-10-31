import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import crypto from "node:crypto";
import Stripe from "stripe";

const app = express();
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("Missing or invalid Stripe test secret key");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYMENT_WEBHOOK_SECRET = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

if (!PAYMENT_WEBHOOK_SECRET || PAYMENT_WEBHOOK_SECRET.length < 32) {
  throw new Error("Missing or invalid TEST_PAYMENT_WEBHOOK_SECRET");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));

// --------------------------------------------------
// Supabase helper
// --------------------------------------------------

async function paymentDb(path, options = {}) {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Legacy service_role keys are JWTs and may be
  // supplied as a Bearer token.
  // Modern sb_secret_ keys must NOT be used as JWTs.
  if (!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(10000),
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.error("Supabase database error:", {
      status: response.status,
      details: data,
    });

    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return data;
}

const uuidSchema = z.string().uuid();

// --------------------------------------------------
// Stripe webhook - signed events
// Must be registered before express.json()
// --------------------------------------------------

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
  throw new Error("Missing or invalid STRIPE_WEBHOOK_SECRET");
}

app.post(
  "/api/stripe/webhook",
  express.raw({
    type: "application/json",
    limit: "64kb",
  }),
  async (req, res) => {
    const signature = req.get("stripe-signature");

    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error: "Missing Stripe signature or raw request body",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      console.error("Stripe signature verification failed:", error.message);

      return res.status(400).json({
        error: "Invalid Stripe webhook signature",
      });
    }

    try {
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = event.data.object;

        if (session.payment_status !== "paid") {
          return res.json({
            received: true,
            ignored: "Payment not completed",
          });
        }

        const orderId =
          session.metadata?.orderId ?? session.client_reference_id;

        const parsedOrderId = uuidSchema.safeParse(orderId);

        if (!parsedOrderId.success) {
          console.error("Stripe event has invalid order ID:", event.id);

          return res.status(400).json({
            error: "Invalid order reference",
          });
        }

        // Verify the amount against the database order.
        const params = new URLSearchParams({
          id: `eq.${orderId}`,
          select: "id,total_price,payment_status",
          limit: "1",
        });

        const orders = await paymentDb(`/rest/v1/orders?${params}`);

        const order = orders?.[0];

        if (!order) {
          return res.status(404).json({
            error: "Order not found",
          });
        }

        const expectedAmount = Math.round(Number(order.total_price) * 100);

        if (
          session.currency?.toLowerCase() !== "sek" ||
          session.amount_total !== expectedAmount
        ) {
          console.error("Stripe payment amount mismatch:", {
            eventId: event.id,
            orderId,
          });

          return res.status(400).json({
            error: "Payment amount or currency mismatch",
          });
        }

        const result = await paymentDb("/rest/v1/rpc/process_stripe_payment", {
          method: "POST",
          body: JSON.stringify({
            p_order_id: orderId,
            p_session_id: session.id,
          }),
        });

        if (
          result?.status === "stock_unavailable" ||
          result?.status === "invalid_payment_state" ||
          result?.status === "cancelled"
        ) {
          console.error("Stripe payment requires manual resolution:", {
            eventId: event.id,
            orderId,
            sessionId: session.id,
            result,
          });

          // Stripe has collected the payment. Returning 500
          // allows Stripe to retry, but a refund or manual
          // resolution is still required.
          return res.status(500).json({
            error: "Paid checkout requires manual resolution",
          });
        }

        if (result?.status !== "paid" && result?.status !== "already_paid") {
          throw new Error(
            `Unexpected payment processing result: ${JSON.stringify(result)}`,
          );
        }

        // Mark the Stripe session as completed.
        await paymentDb(
          `/rest/v1/stripe_checkout_sessions?session_id=eq.${encodeURIComponent(session.id)}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "complete",
              updated_at: new Date().toISOString(),
            }),
          },
        );

        return res.json({
          received: true,
          result,
        });
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object;
        // Mark this specific Stripe session as expired.
        await paymentDb(
          `/rest/v1/stripe_checkout_sessions?session_id=eq.${encodeURIComponent(session.id)}&status=eq.open`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "expired",
              updated_at: new Date().toISOString(),
            }),
          },
        );
        console.log("Stripe Checkout session expired:", {
          sessionId: session.id,
          orderId: session.metadata?.orderId ?? session.client_reference_id,
        });

        // Do not cancel the order here yet:
        // another Checkout session might still be active.
        return res.json({
          received: true,
          expired: true,
        });
      }

      if (event.type === "checkout.session.async_payment_failed") {
        const session = event.data.object;
        // Mark this specific Stripe session as failed.
        await paymentDb(
          `/rest/v1/stripe_checkout_sessions?session_id=eq.${encodeURIComponent(session.id)}&status=eq.open`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "failed",
              updated_at: new Date().toISOString(),
            }),
          },
        );
        console.log("Stripe asynchronous payment failed:", {
          sessionId: session.id,
          orderId: session.metadata?.orderId ?? session.client_reference_id,
        });

        return res.json({
          received: true,
          paymentFailed: true,
        });
      }

      return res.json({
        received: true,
        ignored: event.type,
      });
    } catch (error) {
      console.error("Stripe webhook processing failed:", error);

      return res.status(500).json({
        error: "Could not process Stripe webhook",
      });
    }
  },
);

// --------------------------------------------------
// Payment webhook
// Must be registered before express.json()
// --------------------------------------------------

app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "32kb",
  }),
  async (req, res) => {
    const signature = req.get("x-test-signature");

    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error: "Missing signature or request body",
      });
    }

    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", PAYMENT_WEBHOOK_SECRET)
        .update(req.body)
        .digest("hex");

    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return res.status(401).json({
        error: "Invalid webhook signature",
      });
    }

    let event;

    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        error: "Invalid webhook JSON",
      });
    }

    const parsed = z
      .object({
        eventId: uuidSchema,
        paymentId: uuidSchema,
        type: z.enum(["payment.succeeded", "payment.failed"]),
      })
      .safeParse(event);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid webhook event",
      });
    }

    try {
      const result = await paymentDb(
        "/rest/v1/rpc/process_test_payment_webhook",
        {
          method: "POST",
          body: JSON.stringify({
            p_event_id: parsed.data.eventId,
            p_payment_id: parsed.data.paymentId,
            p_event_type: parsed.data.type,
          }),
        },
      );

      return res.json(result);
    } catch (error) {
      console.error("Webhook failed:", error);

      return res.status(500).json({
        error: "Could not process webhook",
      });
    }
  },
);

// --------------------------------------------------
// Standard middleware
// --------------------------------------------------

app.use(express.json({ limit: "100kb" }));

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "shopy-shop-api",
  });
});

// --------------------------------------------------
// Product search
// --------------------------------------------------

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  category: z.string().trim().max(80).optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "name", "name_asc"])
    .default("newest"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

app.get("/api/products/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid search parameters",
      details: z.treeifyError(parsed.error),
    });
  }

  const { q, category, sort, page, limit } = parsed.data;

  const filters = new URLSearchParams({
    select: "id,name,description,price,image_url,stock,category",
    offset: String((page - 1) * limit),
    limit: String(limit),
  });

  if (q) {
    const safeQuery = q.replace(/[%,().*"\\]/g, " ").trim();

    if (safeQuery) {
      filters.set(
        "or",
        `(name.ilike.*${safeQuery}*,description.ilike.*${safeQuery}*)`,
      );
    }
  }

  if (category) {
    const safeCategory = category.replace(/[(),"]/g, "");
    filters.set("category", `eq.${safeCategory}`);
  }

  const sorting = {
    newest: "created_at.desc",
    price_asc: "price.asc",
    price_desc: "price.desc",
    name: "name.asc",
    name_asc: "name.asc",
  };

  filters.set("order", sorting[sort]);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?${filters}`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      const details = await response.text();

      console.error("Product search failed:", {
        status: response.status,
        details,
      });

      return res.status(502).json({
        error: "Could not load products",
      });
    }

    const products = await response.json();
    const contentRange = response.headers.get("content-range");
    const countValue = contentRange?.split("/")[1];
    const parsedCount = countValue ? Number(countValue) : NaN;
    const total = Number.isFinite(parsedCount) ? parsedCount : products.length;

    return res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Product search failed:", error);

    return res.status(502).json({
      error: "Could not load products",
    });
  }
});

// --------------------------------------------------
// Admin authentication
// --------------------------------------------------

async function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!userResponse.ok) {
      return res.status(401).json({
        error: "Invalid or expired access token",
      });
    }

    const user = await userResponse.json();

    if (!user.id) {
      return res.status(401).json({
        error: "Invalid user",
      });
    }

    const params = new URLSearchParams({
      select: "role",
      id: `eq.${user.id}`,
      limit: "1",
    });

    const profiles = await paymentDb(`/rest/v1/profiles?${params}`);

    if (profiles[0]?.role !== "admin") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    req.adminUserId = user.id;
    next();
  } catch (error) {
    console.error("Admin authentication failed:", error);

    return res.status(502).json({
      error: "Could not verify administrator access",
    });
  }
}

// --------------------------------------------------
// CSV parsing
// --------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new Error("Invalid CSV quoting");
      }

      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("Unclosed quoted CSV field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((cells) =>
    cells.some((cell) => cell.trim() !== ""),
  );

  if (nonEmptyRows.length < 2) {
    throw new Error("CSV must contain headers and products");
  }

  const headers = nonEmptyRows[0].map((value) => value.trim());

  const requiredHeaders = ["name", "description", "price", "stock", "category"];

  if (
    new Set(headers).size !== headers.length ||
    requiredHeaders.some((header) => !headers.includes(header))
  ) {
    throw new Error(
      "CSV headers must include name,description,price,stock,category",
    );
  }

  return nonEmptyRows.slice(1).map((cells) => {
    if (cells.length !== headers.length) {
      return { __invalidCsv: true };
    }

    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index]]),
    );
  });
}

// --------------------------------------------------
// XML parsing
// --------------------------------------------------

function parseXml(text) {
  const validation = XMLValidator.validate(text);

  if (validation !== true) {
    throw new Error("Invalid XML document");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
  });

  const parsed = parser.parse(text);

  if (!parsed?.products || parsed.products.product === undefined) {
    throw new Error(
      "XML must contain <products><product>...</product></products>",
    );
  }

  const products = parsed.products.product;

  return Array.isArray(products) ? products : [products];
}

// --------------------------------------------------
// Product import
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024,
    files: 1,
  },
});

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  price: z.coerce.number().finite().min(0).max(99999999.99),
  stock: z.coerce.number().int().min(0),
  category: z.string().trim().min(1).max(100),
  image_url: z.union([z.url().max(2048), z.literal("")]).optional(),
});

function validateProduct(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return productSchema.safeParse({});
  }

  return productSchema.safeParse({
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    stock: input.stock,
    category: input.category,
    image_url: input.image_url ?? "",
  });
}

app.post(
  "/api/products/import",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Upload a CSV or XML file using the field name 'file'",
      });
    }

    const filename = req.file.originalname.toLowerCase();

    if (!filename.endsWith(".csv") && !filename.endsWith(".xml")) {
      return res.status(400).json({
        error: "Only CSV and XML files are supported",
      });
    }

    let records;

    try {
      const content = req.file.buffer.toString("utf8");

      records = filename.endsWith(".csv")
        ? parseCsv(content)
        : parseXml(content);
    } catch (error) {
      return res.status(400).json({
        error: "Could not parse import file",
        details: error.message,
      });
    }

    if (records.length === 0 || records.length > 500) {
      return res.status(400).json({
        error: "Import must contain between 1 and 500 products",
      });
    }

    const validProducts = [];
    const errors = [];

    records.forEach((record, index) => {
      const result = validateProduct(record);

      if (!result.success) {
        errors.push({
          row: index + 1,
          details: z.treeifyError(result.error),
        });

        return;
      }

      validProducts.push({
        name: result.data.name,
        description: result.data.description,
        price: result.data.price,
        stock: result.data.stock,
        category: result.data.category,
        image_url: result.data.image_url || "",
      });
    });

    if (validProducts.length === 0) {
      return res.status(422).json({
        error: "No valid products found",
        imported: 0,
        rejected: errors.length,
        errors,
      });
    }

    try {
      const inserted = await paymentDb("/rest/v1/products", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(validProducts),
      });

      return res.status(201).json({
        message: "Product import completed",
        imported: inserted.length,
        rejected: errors.length,
        errors,
        products: inserted,
      });
    } catch (error) {
      console.error("Product import failed:", error);

      return res.status(502).json({
        error: "Could not save imported products",
      });
    }
  },
);

// --------------------------------------------------
// Checkout - secure server-side order creation
// --------------------------------------------------

const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email(),
  customerAddress: z.string().trim().min(1).max(500),
  postalCode: z.string().trim().min(1).max(30),
  city: z.string().trim().min(1).max(150),
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});

app.post("/api/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid checkout information",
      details: z.treeifyError(parsed.error),
    });
  }

  try {
    const orderId = await paymentDb("/rest/v1/rpc/create_checkout_order", {
      method: "POST",
      body: JSON.stringify({
        p_customer_name: parsed.data.customerName,
        p_customer_email: parsed.data.customerEmail,
        p_customer_address: parsed.data.customerAddress,
        p_postal_code: parsed.data.postalCode,
        p_city: parsed.data.city,
        p_items: parsed.data.items,
      }),
    });

    return res.status(201).json({
      orderId,
    });
  } catch (error) {
    console.error("Checkout failed:", error);

    return res.status(500).json({
      error: "Could not create order",
    });
  }
});

// --------------------------------------------------
// Create test payment
// --------------------------------------------------

app.post("/api/payments/create", async (req, res) => {
  const parsed = z
    .object({
      orderId: uuidSchema,
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid order ID",
    });
  }

  try {
    const orderId = parsed.data.orderId;

    const params = new URLSearchParams({
      id: `eq.${orderId}`,
      select: "id,total_price,payment_status,order_status",
      limit: "1",
    });

    const orders = await paymentDb(`/rest/v1/orders?${params}`);

    const order = orders?.[0];

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (order.order_status === "cancelled") {
      return res.status(409).json({
        error: "Order is cancelled",
      });
    }

    if (order.payment_status === "paid") {
      return res.status(409).json({
        error: "Order already paid",
      });
    }

    const existingParams = new URLSearchParams({
      order_id: `eq.${orderId}`,
      status: "eq.pending",
      select: "id,order_id,amount,status",
      order: "created_at.desc",
      limit: "1",
    });

    const existing = await paymentDb(
      `/rest/v1/test_payments?${existingParams}`,
    );

    if (existing?.length) {
      return res.json({
        paymentId: existing[0].id,
        orderId: existing[0].order_id,
        amount: Number(existing[0].amount),
        currency: "SEK",
        status: existing[0].status,
      });
    }

    const payments = await paymentDb("/rest/v1/test_payments", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        order_id: order.id,
        amount: order.total_price,
        status: "pending",
      }),
    });

    const payment = payments?.[0];

    if (!payment) {
      throw new Error("Payment was not returned");
    }

    return res.status(201).json({
      paymentId: payment.id,
      orderId: order.id,
      amount: Number(payment.amount),
      currency: "SEK",
      status: "pending",
    });
  } catch (error) {
    console.error("Create payment failed:", error);

    return res.status(500).json({
      error: "Could not create payment",
    });
  }
});

// --------------------------------------------------
// Stripe Checkout - create hosted payment session
// --------------------------------------------------

app.post("/api/stripe/checkout", async (req, res) => {
  const parsed = z
    .object({
      orderId: uuidSchema,
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid order ID",
    });
  }

  try {
    const orderId = parsed.data.orderId;

    // Read the order from Supabase.
    // Never trust payment amounts sent by the frontend.
    const params = new URLSearchParams({
      id: `eq.${orderId}`,
      select: "id,total_price,payment_status,order_status",
      limit: "1",
    });

    const orders = await paymentDb(`/rest/v1/orders?${params}`);

    const order = orders?.[0];

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (order.payment_status === "paid" || order.order_status === "cancelled") {
      return res.status(409).json({
        error: "Order is already paid or cancelled",
      });
    }

    // Stripe requires amounts in the smallest currency unit.
    // For SEK, 1 krona = 100 öre.
    const amountInOre = Math.round(Number(order.total_price) * 100);

    if (!Number.isSafeInteger(amountInOre) || amountInOre < 100) {
      return res.status(400).json({
        error: "Invalid order amount",
      });
    }

    // Create Stripe Checkout session in test mode.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: orderId,

      metadata: {
        orderId,
      },

      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: `Shopy Shop order ${orderId.slice(0, 8)}`,
            },
            unit_amount: amountInOre,
          },
          quantity: 1,
        },
      ],

      success_url: `${FRONTEND_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${FRONTEND_ORIGIN}/checkout/cancel?order_id=${encodeURIComponent(orderId)}`,
    });

    // Save the Stripe session so we can track its status.
    await paymentDb("/rest/v1/stripe_checkout_sessions", {
      method: "POST",
      headers: {
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        session_id: session.id,
        order_id: orderId,
        status: "open",
      }),
    });

    return res.status(201).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout failed:", error);

    return res.status(500).json({
      error: "Could not create Stripe Checkout session",
    });
  }
});

app.get("/api/stripe/checkout/status", async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        error: "Invalid Stripe Checkout session ID",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const orderId = session.metadata?.orderId ?? session.client_reference_id;

    if (!orderId) {
      return res.status(400).json({
        error: "Stripe session has no associated order",
      });
    }

    const orders = await paymentDb(
      `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}` +
        "&select=id,total_price,payment_status,paid_at",
      {
        method: "GET",
      },
    );

    const order = Array.isArray(orders) ? orders[0] : null;

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const amountMatches =
      session.currency === "sek" &&
      session.amount_total === Math.round(Number(order.total_price) * 100);

    if (!amountMatches) {
      return res.status(409).json({
        error: "Stripe payment amount does not match order",
      });
    }

    return res.json({
      orderId: order.id,
      amount: Number(order.total_price),
      currency: "sek",
      status:
        session.payment_status === "paid" && order.payment_status === "paid"
          ? "paid"
          : "pending",
      paidAt: order.paid_at,
    });
  } catch (error) {
    console.error("Stripe checkout status error:", error);

    return res.status(500).json({
      error: "Could not verify Stripe payment",
    });
  }
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: "Invalid JSON request body",
    });
  }

  console.error(error);

  return res.status(500).json({
    error: "Unexpected server error",
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

// --------------------------------------------------
// Start server locally / export for Vercel
// --------------------------------------------------

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Shopy Shop API running on http://localhost:${PORT}`);
  });
}
