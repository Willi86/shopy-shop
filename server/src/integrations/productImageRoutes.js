import crypto from "node:crypto";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return callback(new Error("Only JPEG images are supported."));
    }

    callback(null, true);
  },
});

export function createProductImageRouter({ express, requireAdmin }) {
  const router = express.Router();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase backend configuration.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // POST /api/product-images/upload
  router.post(
    "/upload",
    requireAdmin,
    (req, res, next) => {
      upload.single("file")(req, res, (error) => {
        if (error) {
          return res.status(400).json({
            error:
              error instanceof multer.MulterError
                ? error.message
                : error.message || "Invalid image upload.",
          });
        }

        next();
      });
    },
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({
          error: "An image is required. Use the field name 'file'.",
        });
      }

      const extension = ALLOWED_IMAGE_TYPES[req.file.mimetype];

      if (!extension) {
        return res.status(400).json({
          error: "Unsupported image type.",
        });
      }

      // Validate the actual JPEG file signature.
      const buffer = req.file.buffer;

      const isJpeg =
        buffer.length >= 4 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[buffer.length - 2] === 0xff &&
        buffer[buffer.length - 1] === 0xd9;

      if (!isJpeg) {
        return res.status(400).json({
          error: "The uploaded file is not a valid JPEG image.",
        });
      }

      const storagePath = `products/${crypto.randomUUID()}.${extension}`;

      try {
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: req.file.mimetype,
            cacheControl: "31536000",
            upsert: false,
          });

        if (error) {
          console.error("Product image upload failed:", error);

          return res.status(502).json({
            error: "Could not upload product image.",
          });
        }

        const { data } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

        return res.status(201).json({
          success: true,
          path: storagePath,
          publicUrl: data.publicUrl,
        });
      } catch (error) {
        console.error("Unexpected image upload error:", error);

        return res.status(500).json({
          error: "Unexpected image upload error.",
        });
      }
    },
  );

  // DELETE /api/product-images
  router.delete("/", requireAdmin, async (req, res) => {
    const storagePath = req.body?.path;

    if (
      typeof storagePath !== "string" ||
      !/^products\/[0-9a-f-]{36}\.jpg$/i.test(storagePath)
    ) {
      return res.status(400).json({
        error: "Invalid product image path.",
      });
    }

    try {
      // Prevent deleting an image still used by a product.
      const { data: products, error: lookupError } = await supabase
        .from("products")
        .select("image_url");

      if (lookupError) {
        throw lookupError;
      }

      const { data: imageData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      const imageIsUsed = products.some(
        (product) => product.image_url === imageData.publicUrl,
      );

      if (imageIsUsed) {
        return res.status(409).json({
          error: "This image is still used by a product.",
        });
      }

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        removed: true,
      });
    } catch (error) {
      console.error("Product image deletion failed:", error);

      return res.status(502).json({
        error: "Could not delete product image.",
      });
    }
  });

  return router;
}
