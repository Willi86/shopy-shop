import "dotenv/config";

// ============================================================
// 1. IMPORTS
// ============================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import crypto from "node:crypto";
import Stripe from "stripe";
import { algoliasearch } from "algoliasearch";

import {
  getServicePoints,
  getEstimatedDelivery,
  normalizePostalCode,
  shippingConfig,
  validateServicePoint,
} from "./shipping/shippingService.js";

// ============================================================
// 2. APPLICATION AND ENVIRONMENT CONFIGURATION
// ============================================================

const app = express();

const PORT = Number(process.env.PORT ?? 3001);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Legacy test payment webhook
const PAYMENT_WEBHOOK_SECRET = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

// Algolia configuration
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;

// The write key is currently used only on the backend.
// Prefer ALGOLIA_SEARCH_API_KEY when it is available.
const ALGOLIA_API_KEY =
  process.env.ALGOLIA_SEARCH_API_KEY || process.env.ALGOLIA_WRITE_API_KEY;

const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "products";

// ============================================================
// 3. VALIDATE REQUIRED ENVIRONMENT VARIABLES
// ============================================================

if (!STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("Missing or invalid Stripe test secret key");
}

if (!STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
  throw new Error("Missing or invalid STRIPE_WEBHOOK_SECRET");
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

if (!PAYMENT_WEBHOOK_SECRET || PAYMENT_WEBHOOK_SECRET.length < 32) {
  throw new Error("Missing or invalid TEST_PAYMENT_WEBHOOK_SECRET");
}

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  throw new Error("Missing Algolia environment variables");
}

// ============================================================
// 4. INITIALIZE EXTERNAL SERVICES
// ============================================================

const stripe = new Stripe(STRIPE_SECRET_KEY);

const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

// ============================================================
// 5. SECURITY AND CORS MIDDLEWARE
// ============================================================

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
  }),
);

// ============================================================
// 6. SUPABASE DATABASE HELPER
// ============================================================

// Uses the service-role key for trusted backend operations.
// The service-role key must never be exposed to the frontend.

async function paymentDb(path, options = {}) {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Legacy service_role keys are JWTs.
  // Modern sb_secret_ keys must not be used as JWTs.
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

// Shared UUID validation schema
const uuidSchema = z.string().uuid();

// ============================================================
// 7. STRIPE WEBHOOK
// IMPORTANT: Must be registered before express.json()
// ============================================================

// Stripe sends signed events.
// The raw request body is required for signature verification.

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
      // ------------------------------------------------------
      // 7.1 Successful Stripe payment
      // ------------------------------------------------------

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

        // Verify the paid amount against the database.
        // Never trust an amount supplied by the frontend.
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

        // The Supabase RPC handles payment processing.
        // It also protects against duplicate processing.
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

          // Stripe has collected the payment.
          // Returning 500 allows Stripe to retry.
          // A refund or manual resolution may still be needed.
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

      // ------------------------------------------------------
      // 7.2 Expired Stripe Checkout session
      // ------------------------------------------------------

      if (event.type === "checkout.session.expired") {
        const session = event.data.object;

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

        // Do not cancel the order automatically.
        // Another Checkout session might still be active.
        return res.json({
          received: true,
          expired: true,
        });
      }

      // ------------------------------------------------------
      // 7.3 Failed asynchronous Stripe payment
      // ------------------------------------------------------

      if (event.type === "checkout.session.async_payment_failed") {
        const session = event.data.object;

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

// ============================================================
// 8. LEGACY TEST PAYMENT WEBHOOK
// IMPORTANT: Must be registered before express.json()
// ============================================================

// This webhook uses an HMAC signature.
// It remains available for the assignment's test-payment flow.

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

// ============================================================
// 9. STANDARD JSON MIDDLEWARE
// ============================================================

// This must appear after the raw-body webhook routes.
app.use(
  express.json({
    limit: "100kb",
  }),
);

// ============================================================
// 10. HEALTH CHECK
// ============================================================

// GET /api/health
app.get("/api/health", (_req, res) => {
  return res.json({
    status: "ok",
    service: "shopy-shop-api",
  });
});

// ============================================================
// 11. SHIPPING API - LABB 5
// ============================================================

// The current adapter is a PostNord mock.
// Real PostNord API credentials are not configured yet.

const shippingPostalCodeSchema = z.object({
  postalCode: z.string().trim().min(1).max(10),
});

// GET /api/shipping/options?postalCode=11122
app.get("/api/shipping/options", async (req, res) => {
  const parsed = shippingPostalCodeSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid shipping request",
    });
  }

  try {
    const postalCode = normalizePostalCode(parsed.data.postalCode);

    const [servicePoints, estimatedDelivery] = await Promise.all([
      getServicePoints(postalCode),
      getEstimatedDelivery(postalCode),
    ]);

    return res.json({
      provider: shippingConfig.provider,
      postalCode,
      methods: [
        {
          id: "pickup",
          name: "Hämta hos ombud",
          price: shippingConfig.prices.pickup,
        },
        {
          id: "home",
          name: "Hemleverans",
          price: shippingConfig.prices.home,
        },
      ],
      freeShippingThreshold: shippingConfig.freeShippingThreshold,
      servicePoints,
      estimatedDelivery,
      isMock: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid Swedish postal code",
      });
    }

    console.error("Shipping options failed:", error);

    return res.status(502).json({
      error: "Could not load shipping options",
    });
  }
});

// ============================================================
// 12. PRODUCT SEARCH - SUPABASE + ALGOLIA
// ============================================================

// Without a search query:
//   Supabase provides products and standard sorting.
//
// With a search query:
//   Algolia provides typo-tolerant search.
//
// Both branches return the same response format so the
// existing React ProductsPage.tsx continues to work.

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),

  category: z.string().trim().max(80).default(""),

  sort: z
    .enum(["newest", "price_asc", "price_desc", "name", "name_asc"])
    .default("newest"),

  page: z.coerce.number().int().min(1).max(10000).default(1),

  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// ------------------------------------------------------------
// 12.1 Sort Algolia search results
// ------------------------------------------------------------

function sortAlgoliaProducts(products, sort) {
  const result = [...products];

  switch (sort) {
    case "price_asc":
      result.sort((a, b) => Number(a.price) - Number(b.price));
      break;

    case "price_desc":
      result.sort((a, b) => Number(b.price) - Number(a.price));
      break;

    case "name":
    case "name_asc":
      result.sort((a, b) => String(a.name).localeCompare(String(b.name), "sv"));
      break;

    default:
      // Preserve Algolia relevance ordering.
      break;
  }

  return result;
}

// ------------------------------------------------------------
// 12.2 GET /api/products/search
// ------------------------------------------------------------

app.get("/api/products/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid search parameters",
      details: z.treeifyError(parsed.error),
    });
  }

  const { q, category, sort, page, limit } = parsed.data;

  try {
    // ------------------------------------------------------
    // 12.3 Supabase listing (empty search)
    // ------------------------------------------------------

    if (!q) {
      const filters = new URLSearchParams({
        select: "id,name,description,price,image_url,stock,category",
        offset: String((page - 1) * limit),
        limit: String(limit),
      });

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
        throw new Error(`Supabase product listing failed: ${response.status}`);
      }

      const products = await response.json();

      const contentRange = response.headers.get("content-range");

      const countValue = contentRange?.split("/")[1];

      const parsedCount = countValue ? Number(countValue) : NaN;

      const total = Number.isFinite(parsedCount)
        ? parsedCount
        : products.length;

      return res.json({
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        searchProvider: "supabase",
      });
    }

    // ------------------------------------------------------
    // 12.4 Algolia typo-tolerant search
    // ------------------------------------------------------

    // The assignment currently has a small catalog.
    // Retrieve up to 1000 matches before applying
    // price/name sorting and pagination.
    //
    // A larger catalog should use Algolia replicas
    // for globally consistent sorting.

    const searchParams = {
      query: q,
      hitsPerPage: 1000,
      typoTolerance: true,
      attributesToRetrieve: [
        "objectID",
        "name",
        "description",
        "price",
        "stock",
        "category",
        "image_url",
      ],
    };

    if (category) {
      searchParams.facetFilters = [`category:${category}`];
    }

    const result = await algolia.searchSingleIndex({
      indexName: ALGOLIA_INDEX_NAME,
      searchParams,
    });

    const products = (result.hits ?? []).map((hit) => ({
      id: hit.objectID,
      name: hit.name,
      description: hit.description ?? "",
      price: Number(hit.price),
      stock: Number(hit.stock),
      category: hit.category ?? "",
      image_url: hit.image_url ?? "",
    }));

    const sortedProducts = sortAlgoliaProducts(products, sort);

    const total = sortedProducts.length;

    const start = (page - 1) * limit;

    const paginatedProducts = sortedProducts.slice(start, start + limit);

    return res.json({
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      searchProvider: "algolia",
    });
  } catch (error) {
    console.error("Product search failed:", error);

    return res.status(502).json({
      error: "Could not load products",
    });
  }
});

// ============================================================
// 13. ADMIN AUTHENTICATION
// ============================================================

// Requires a valid Supabase user token.
// Only users with the "admin" role may import products.

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

// ============================================================
// 14. CSV PRODUCT IMPORT PARSER
// ============================================================

// Supports quoted fields and comma-separated values.

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
      return {
        __invalidCsv: true,
      };
    }

    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index]]),
    );
  });
}

// ============================================================
// 15. XML PRODUCT IMPORT PARSER
// ============================================================

// Expected structure:
// <products>
//   <product>
//     <name>Example</name>
//     ...
//   </product>
// </products>

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

// ============================================================
// 16. PRODUCT IMPORT - CSV AND XML
// ============================================================

// Admin-only endpoint.
// Valid products are inserted into Supabase.

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

// POST /api/products/import
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

// ============================================================
// 17. CHECKOUT - SECURE ORDER CREATION
// ============================================================

// Validates customer information, shipping selection,
// and products before creating the order in Supabase.
//
// Product prices and shipping totals are calculated
// by the database, not by the browser.

const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(200),

  customerEmail: z.email(),

  customerAddress: z.string().trim().min(1).max(500),

  postalCode: z.string().trim().min(1).max(30),

  city: z.string().trim().min(1).max(150),

  shippingMethod: z.enum(["pickup", "home"]),

  pickupPointId: z.string().trim().min(1).max(100).optional(),

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

// POST /api/checkout
app.post("/api/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid checkout information",
      details: z.treeifyError(parsed.error),
    });
  }

  const data = parsed.data;

  let postalCode;

  try {
    postalCode = normalizePostalCode(data.postalCode);
  } catch {
    return res.status(400).json({
      error: "Invalid Swedish postal code",
    });
  }

  let pickupPoint = null;

  if (data.shippingMethod === "pickup") {
    if (!data.pickupPointId) {
      return res.status(400).json({
        error: "Select a pickup point",
      });
    }

    try {
      pickupPoint = await validateServicePoint(postalCode, data.pickupPointId);
    } catch (error) {
      console.error("Pickup point validation failed:", error);

      return res.status(502).json({
        error: "Could not validate pickup point",
      });
    }

    if (!pickupPoint) {
      return res.status(400).json({
        error: "Invalid pickup point for this postal code",
      });
    }
  } else if (data.pickupPointId) {
    return res.status(400).json({
      error: "Home delivery cannot have a pickup point",
    });
  }

  try {
    const orderId = await paymentDb("/rest/v1/rpc/create_checkout_order", {
      method: "POST",
      body: JSON.stringify({
        p_customer_name: data.customerName,

        p_customer_email: data.customerEmail,

        p_customer_address: data.customerAddress,

        p_postal_code: postalCode,

        p_city: data.city,

        p_items: data.items,

        p_shipping_method: data.shippingMethod,

        p_pickup_point: pickupPoint
          ? {
              id: pickupPoint.id,
              name: pickupPoint.name,
            }
          : null,
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

// ============================================================
// 18. LEGACY TEST PAYMENT CREATION
// ============================================================

// Creates or reuses a pending test payment.
// This is separate from Stripe Checkout.

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

// ============================================================
// 19. STRIPE CHECKOUT - CREATE PAYMENT SESSION
// ============================================================

// Uses the amount stored in the Supabase order.
// The frontend cannot override the payment amount.

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

    // Stripe expects SEK amounts in öre.
    const amountInOre = Math.round(Number(order.total_price) * 100);

    if (!Number.isSafeInteger(amountInOre) || amountInOre < 100) {
      return res.status(400).json({
        error: "Invalid order amount",
      });
    }

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

// ============================================================
// 20. STRIPE CHECKOUT - VERIFY PAYMENT STATUS
// ============================================================

// Confirms both Stripe and Supabase report the payment as paid.

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

// ============================================================
// 21. GLOBAL ERROR HANDLER
// ============================================================

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

// ============================================================
// 22. SERVER STARTUP AND VERCEL EXPORT
// ============================================================

// Export the Express app for Vercel serverless deployment.
export default app;

// Start a local HTTP server only outside Vercel.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Shopy Shop API running on http://localhost:${PORT}`);
  });
}
