
import "dotenv/config";
import { algoliasearch } from "algoliasearch";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_WRITE_API_KEY = process.env.ALGOLIA_WRITE_API_KEY;
const ALGOLIA_INDEX_NAME =
  process.env.ALGOLIA_INDEX_NAME || "products";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !ALGOLIA_APP_ID ||
  !ALGOLIA_WRITE_API_KEY
) {
  throw new Error(
    "Missing Supabase or Algolia environment variables",
  );
}

const client = algoliasearch(
  ALGOLIA_APP_ID,
  ALGOLIA_WRITE_API_KEY,
);

async function loadProducts() {
  const products = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      select:
        "id,name,description,price,stock,category,image_url",
      limit: String(pageSize),
      offset: String(offset),
      order: "id.asc",
    });

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    };

    if (!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) {
      headers.Authorization =
        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?${params}`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Supabase product fetch failed: ${response.status}`,
      );
    }

    const batch = await response.json();

    if (!Array.isArray(batch)) {
      throw new Error("Unexpected Supabase response");
    }

    products.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return products;
}

async function main() {
  console.log("Loading products from Supabase...");

  const products = await loadProducts();

  const records = products.map((product) => ({
    objectID: product.id,
    name: product.name,
    description: product.description ?? "",
    price: Number(product.price),
    stock: Number(product.stock),
    category: product.category ?? "",
    image_url: product.image_url ?? "",
  }));

  console.log(`Found ${records.length} products.`);

  if (records.length === 0) {
    throw new Error(
      "No products found. Refusing to modify Algolia index.",
    );
  }

  // Create or update the search index.
  await client.setSettings({
    indexName: ALGOLIA_INDEX_NAME,
    indexSettings: {
      searchableAttributes: [
        "name",
        "category",
        "description",
      ],
      attributesForFaceting: [
        "searchable(category)",
      ],
      customRanking: ["desc(stock)"],
    },
  });

  // Save all product records.
  // objectID matches the Supabase product UUID.
  await client.saveObjects({
    indexName: ALGOLIA_INDEX_NAME,
    objects: records,
  });

  console.log(
    `Successfully sent ${records.length} products to Algolia index "${ALGOLIA_INDEX_NAME}".`,
  );
  console.log(
    "Note: This is an upsert sync. Previously indexed products deleted from Supabase are not automatically removed.",
  );
}

main().catch((error) => {
  console.error("Algolia synchronization failed:", error);
  process.exitCode = 1;
});
