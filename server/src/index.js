import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const app = express();

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

// --------------------------------------------------
// Health check
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

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
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
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Supabase search error:", {
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

// --------------------------------------------------
// Administrator authentication
// --------------------------------------------------

async function requireAdmin(req, res, next) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return res.status(503).json({
      error: "Import service is not configured",
    });
  }

  const authorization = req.headers.authorization ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = match[1];

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
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

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?${params}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!profileResponse.ok) {
      throw new Error(`Profile lookup failed: ${profileResponse.status}`);
    }

    const profiles = await profileResponse.json();

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
// CSV and XML parsing
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024,
    files: 1,
  },
});

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

function parseXml(text) {
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
// Product validation
// --------------------------------------------------

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

  const normalized = {
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    stock: input.stock,
    category: input.category,
    image_url: input.image_url ?? "",
  };

  return productSchema.safeParse(normalized);
}

// --------------------------------------------------
// Product import endpoint
// --------------------------------------------------

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
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(validProducts),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const details = await response.text();

        console.error("Product import failed:", {
          status: response.status,
          details,
        });

        return res.status(502).json({
          error: "Could not save imported products",
        });
      }

      const inserted = await response.json();

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
// Error handler
// --------------------------------------------------

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.message,
    });
  }

  console.error(error);

  return res.status(500).json({
    error: "Unexpected server error",
  });
});

app.listen(PORT, () => {
  console.log(`Shopy Shop API running on http://localhost:${PORT}`);
});
