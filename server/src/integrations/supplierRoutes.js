import { Router } from "express";
import { fetchSupplierCatalog } from "./supplierAdapter.js";

export function createSupplierRouter({
  requireAdmin,
  paymentDb,
}) {
  const router = Router();

  router.post(
    "/import/:format",
    requireAdmin,
    async (req, res) => {
      const { format } = req.params;

      if (format !== "csv" && format !== "xml") {
        return res.status(400).json({
          error: "Format must be csv or xml",
        });
      }

      let catalog;

      try {
        catalog = await fetchSupplierCatalog(format);
      } catch (error) {
        console.error("Supplier download failed:", error);

        return res.status(502).json({
          error: "Could not download supplier products",
          details:
            error instanceof Error
              ? error.message
              : "Unknown supplier error",
        });
      }

      if (catalog.products.length === 0) {
        return res.status(422).json({
          error: "No valid supplier products found",
          received: catalog.received,
          created: 0,
          updated: 0,
          skipped: catalog.skipped.length,
          errors: catalog.skipped,
        });
      }

      try {
        const articleNumbers = catalog.products.map(
          (product) => product.article_number,
        );

        const filter = new URLSearchParams({
          select: "article_number",
          article_number: `in.(${articleNumbers
            .map((number) => `"${number.replace(/["\\]/g, "")}"`)
            .join(",")})`,
        });

        const existingProducts = await paymentDb(
          `/rest/v1/products?${filter}`,
        );

        const existingNumbers = new Set(
          existingProducts.map(
            (product) => product.article_number,
          ),
        );

        const created = catalog.products.filter(
          (product) =>
            !existingNumbers.has(product.article_number),
        ).length;

        const updated =
          catalog.products.length - created;

        const params = new URLSearchParams({
          on_conflict: "article_number",
        });

        const saved = await paymentDb(
          `/rest/v1/products?${params}`,
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(catalog.products),
          },
        );

        if (
          !Array.isArray(saved) ||
          saved.length !== catalog.products.length
        ) {
          throw new Error(
            "Database did not confirm all supplier products",
          );
        }

        return res.json({
          message: "Supplier import completed",
          format: catalog.format,
          industry: catalog.industry,
          received: catalog.received,
          created,
          updated,
          imported: saved.length,
          skipped: catalog.skipped.length,
          errors: catalog.skipped,
        });
      } catch (error) {
        console.error("Supplier import failed:", error);

        return res.status(502).json({
          error: "Could not save supplier products",
          details:
            error instanceof Error
              ? error.message
              : "Database error",
        });
      }
    },
  );

  return router;
}