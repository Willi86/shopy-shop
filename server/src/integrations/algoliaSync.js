
import { algoliasearch } from "algoliasearch";

const INDEX_NAME =
  process.env.ALGOLIA_INDEX_NAME || "products";

let client = null;

function getClient() {
  const appId = process.env.ALGOLIA_APP_ID;
  const writeKey = process.env.ALGOLIA_WRITE_API_KEY;

  if (!appId || !writeKey) {
    throw new Error(
      "Algolia configuration is missing: " +
        "ALGOLIA_APP_ID or ALGOLIA_WRITE_API_KEY",
    );
  }

  if (!client) {
    client = algoliasearch(appId, writeKey);
  }

  return client;
}

function toAlgoliaRecord(product) {
  if (!product?.id) {
    throw new Error("Product ID is required");
  }

  return {
    objectID: String(product.id),
    article_number: product.article_number ?? null,
    name: product.name,
    description: product.description ?? "",
    price: Number(product.price),
    stock: Number(product.stock),
    category: product.category ?? "",
    image_url: product.image_url ?? "",
  };
}

export async function syncProduct(product) {
  const record = toAlgoliaRecord(product);

  await getClient().saveObject({
    indexName: INDEX_NAME,
    body: record,
  });

  return record.objectID;
}

export async function syncProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error("Products must be an array");
  }

  if (products.length === 0) {
    return 0;
  }

  const records = products.map(toAlgoliaRecord);

  await getClient().saveObjects({
    indexName: INDEX_NAME,
    objects: records,
  });

  return records.length;
}

export async function removeProductFromAlgolia(
  productId,
) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  await getClient().deleteObject({
    indexName: INDEX_NAME,
    objectID: String(productId),
  });
}

export async function trySyncProduct(product) {
  try {
    await syncProduct(product);

    return {
      success: true,
      warning: null,
    };
  } catch (error) {
    console.error(
      "Algolia product synchronization failed:",
      error,
    );

    return {
      success: false,
      warning:
        "Produkten sparades i databasen, " +
        "men sökindexet kunde inte uppdateras.",
    };
  }
}

export async function trySyncProducts(products) {
  try {
    const count = await syncProducts(products);

    return {
      success: true,
      count,
      warning: null,
    };
  } catch (error) {
    console.error(
      "Algolia bulk synchronization failed:",
      error,
    );

    return {
      success: false,
      count: 0,
      warning:
        "Produkterna sparades i databasen, " +
        "men sökindexet kunde inte uppdateras.",
    };
  }
}

export async function tryRemoveProduct(productId) {
  try {
    await removeProductFromAlgolia(productId);

    return {
      success: true,
      warning: null,
    };
  } catch (error) {
    console.error(
      "Algolia product deletion failed:",
      error,
    );

    return {
      success: false,
      warning:
        "Produkten togs bort från databasen, " +
        "men kunde inte tas bort från sökindexet.",
    };
  }
}
