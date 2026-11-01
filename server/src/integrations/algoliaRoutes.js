import { Router } from "express";
import { z } from "zod";

import { trySyncProduct, tryRemoveProduct } from "./algoliaSync.js";

export function createAlgoliaRouter({ requireAdmin, paymentDb }) {
  const router = Router();

  const productIdSchema = z.string().uuid();

  // Synchronize an existing Supabase product with Algolia.
  router.post("/products/:productId/sync", requireAdmin, async (req, res) => {
    const parsedId = productIdSchema.safeParse(req.params.productId);

    if (!parsedId.success) {
      return res.status(400).json({
        error: "Invalid product ID",
      });
    }

    try {
      const productId = parsedId.data;

      const params = new URLSearchParams({
        id: `eq.${productId}`,
        select: "*",
        limit: "1",
      });

      const products = await paymentDb(`/rest/v1/products?${params}`);

      const product = products?.[0];

      if (!product) {
        return res.status(404).json({
          error: "Product not found",
        });
      }

      const synced = await trySyncProduct(product);

      return res.json({
        success: true,
        productId,
        synced,
      });
    } catch (error) {
      console.error("Algolia product synchronization failed:", error);

      return res.status(500).json({
        error: "Could not synchronize product",
      });
    }
  });

  // Remove a deleted product from the Algolia index.
  router.delete("/products/:productId/sync", requireAdmin, async (req, res) => {
    const parsedId = productIdSchema.safeParse(req.params.productId);

    if (!parsedId.success) {
      return res.status(400).json({
        error: "Invalid product ID",
      });
    }

    try {
      const productId = parsedId.data;

      const params = new URLSearchParams({
        id: `eq.${productId}`,
        select: "id",
        limit: "1",
      });

      const products = await paymentDb(`/rest/v1/products?${params}`);

      if (products?.length) {
        return res.status(409).json({
          error:
            "Product still exists in Supabase. Delete it before removing it from Algolia.",
        });
      }

      const removed = await tryRemoveProduct(productId);

      return res.json({
        success: true,
        productId,
        removed,
      });
    } catch (error) {
      console.error("Algolia product removal failed:", error);

      return res.status(500).json({
        error: "Could not remove product from Algolia",
      });
    }
  });

  return router;
}
