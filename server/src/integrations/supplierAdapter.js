import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";

const BASE_URL = (
  process.env.SUPPLIER_API_BASE_URL ||
  "https://leverantor-api.vercel.app"
).replace(/\/$/, "");

const INDUSTRY = process.env.SUPPLIER_INDUSTRY || "elektronik";

function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if (char === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quote");
  }

  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const nonempty = rows.filter((cells) =>
    cells.some((value) => value.trim() !== ""),
  );

  if (nonempty.length < 2) {
    throw new Error("Supplier CSV is empty");
  }

  const headers = nonempty
    .shift()
    .map((header) => header.trim().replace(/^\uFEFF/, ""));

  if (new Set(headers).size !== headers.length) {
    throw new Error("Supplier CSV contains duplicate headers");
  }

  return nonempty.map((values) =>
    values.length === headers.length
      ? Object.fromEntries(
          headers.map((header, index) => [header, values[index]]),
        )
      : { __invalid: "Incorrect number of CSV columns" },
  );
}

function parseXml(text) {
  if (XMLValidator.validate(text) !== true) {
    throw new Error("Invalid supplier XML");
  }

  const doc = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
  }).parse(text);

  const root =
    doc.products ||
    doc.produkter ||
    doc.catalog ||
    doc.katalog;

  const items =
    root?.product ??
    root?.produkt ??
    root?.products?.product ??
    root?.produkter?.produkt;

  if (!items) {
    throw new Error("Unrecognized supplier XML structure");
  }

  return Array.isArray(items) ? items : [items];
}

function pick(record, ...names) {
  if (!record || typeof record !== "object") {
    return undefined;
  }

  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null) {
      return record[name];
    }
  }

  return undefined;
}

function asString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return String(
      value["#text"] ?? value["@_value"] ?? "",
    ).trim();
  }

  return String(value).trim();
}

const productSchema = z.object({
  article_number: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().finite().positive().max(99999999.99),
  stock: z.number().int().nonnegative(),
  category: z.string().trim().min(1).max(100),
  image_url: z.union([z.url().max(2048), z.literal("")]),
});

function normalize(record) {
  if (record?.__invalid) {
    throw new Error(record.__invalid);
  }

  const rawPrice = asString(
    pick(record, "pris", "price", "unitPrice", "unit_price"),
  );

  const rawStock = asString(
    pick(
      record,
      "lagersaldo",
      "lager",
      "stock",
      "stockQuantity",
      "stock_quantity",
      "saldo",
    ),
  );

  const parsedPrice = Number(
    rawPrice.replace(/\s/g, "").replace(",", "."),
  );

  const parsedStock =
    rawStock === "" ? 0 : Number(rawStock);

  const mapped = {
    article_number: asString(
      pick(
        record,
        "artNr",
        "artnr",
        "artikelnummer",
        "article_number",
        "sku",
        "@_artNr",
        "@_artikelnummer",
      ),
    ),
    name: asString(
      pick(record, "namn", "name", "produktnamn", "title"),
    ),
    description: asString(
      pick(record, "beskrivning", "description", "text"),
    ),
    price: parsedPrice,
    stock: parsedStock,
    category:
      asString(
        pick(record, "kategori", "category", "bransch"),
      ) || INDUSTRY,
    image_url: asString(
      pick(
        record,
        "bildUrl",
        "bild_url",
        "bild",
        "image_url",
        "imageUrl",
        "image",
      ),
    ),
  };

  const validated = productSchema.safeParse(mapped);

  if (!validated.success) {
    throw new Error(
      validated.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("; "),
    );
  }

  return validated.data;
}

export async function fetchSupplierCatalog(format) {
  if (format !== "csv" && format !== "xml") {
    throw new Error("Unsupported supplier format");
  }

  const key = process.env.SUPPLIER_API_KEY;

  if (!key) {
    throw new Error("SUPPLIER_API_KEY is not configured");
  }

  const url = new URL(
    `/v1/export/products.${format}`,
    BASE_URL,
  );

  url.searchParams.set("bransch", INDUSTRY);

  const response = await fetch(url, {
    headers: {
      "X-Api-Key": key,
      Accept:
        format === "csv"
          ? "text/csv"
          : "application/xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");

    throw new Error(
      response.status === 429
        ? `Supplier rate limit exceeded. Retry after ${
            retryAfter || "a few"
          } seconds.`
        : `Supplier API returned HTTP ${response.status}`,
    );
  }

  const bytes = await response.arrayBuffer();
  const contentType =
    response.headers.get("content-type") || "";

  const charset =
    /charset=([^;]+)/i
      .exec(contentType)?.[1]
      ?.trim()
      .replace(/["']/g, "") || "utf-8";

  let text;

  try {
    text = new TextDecoder(charset, {
      fatal: true,
    }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }

  const records =
    format === "csv" ? parseCsv(text) : parseXml(text);

  if (records.length === 0 || records.length > 500) {
    throw new Error(
      "Supplier must return between 1 and 500 products",
    );
  }

  const products = [];
  const skipped = [];
  const seen = new Set();

  records.forEach((record, index) => {
    try {
      const product = normalize(record);

      if (seen.has(product.article_number)) {
        throw new Error(
          "Duplicate article number in supplier file",
        );
      }

      seen.add(product.article_number);
      products.push(product);
    } catch (error) {
      skipped.push({
        row: index + 1,
        articleNumber:
          asString(
            pick(
              record,
              "artNr",
              "artnr",
              "artikelnummer",
              "article_number",
              "sku",
              "@_artNr",
              "@_artikelnummer",
            ),
          ) || null,
        reason:
          error instanceof Error
            ? error.message
            : "Invalid product",
      });
    }
  });

  return {
    format,
    industry: INDUSTRY,
    received: records.length,
    products,
    skipped,
  };
}