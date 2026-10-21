import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";

const app = express();

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "shopy-shop-api",
  });
});

// Validate product search parameters
const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  category: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// Product search API
app.get("/api/products/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid search parameters",
      details: z.treeifyError(parsed.error),
    });
  }

  const { q, category, sort, page, limit } = parsed.data;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: "Supabase is not configured",
    });
  }

  const filters = new URLSearchParams({
    select: "id,name,description,price,image_url,stock,category",
    offset: String((page - 1) * limit),
    limit: String(limit),
  });

  if (q) {
    // Treat user input as text, not PostgREST filter syntax.
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
  };

  filters.set("order", sorting[sort]);

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/products?${filters}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Supabase HTTP error:", {
        status: response.status,
        body: errorBody,
      });

      throw new Error(`Supabase HTTP ${response.status}`);
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

// Handle unexpected errors
app.use((error, _req, res, _next) => {
  console.error(error);

  res.status(500).json({
    error: "Unexpected server error",
  });
});

app.listen(PORT, () => {
  console.log(`Shopy Shop API running on http://localhost:${PORT}`);
});
