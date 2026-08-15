import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL in .env.seed");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY in .env.seed");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const bucketName = "product-images";

const products = [
  {
    slug: "allah-muhammad-decoration",
    fileName: "allah-muhammad.jpg",
    name: "Allah & Muhammad Dekoration",
    description:
      "3D-printad islamisk dekoration med Allah och Muhammad, skapad som en stilren detalj för hemmet.",
    price: 249,
    stock: 6,
    category: "Islamisk dekoration",
  },
  {
    slug: "asma-ul-husna",
    fileName: "asmauAllah.jpg",
    name: "Asma ul Husna",
    description:
      "Dekorativ 3D-print med Allahs vackra namn. En elegant och personlig detalj för hemmet.",
    price: 299,
    stock: 4,
    category: "Islamisk dekoration",
  },
  {
    slug: "fanous-led-lantern",
    fileName: "fanous1.jpg",
    name: "Fanoos LED-lykta",
    description:
      "3D-printad Fanoos-lykta med detaljrikt mönster. Anpassad för säker LED-belysning.",
    price: 219,
    stock: 10,
    category: "Belysning",
  },
  {
    slug: "fanous-premium",
    fileName: "fanous2.jpg",
    name: "Fanoos Premium",
    description:
      "En större dekorativ Fanoos med traditionellt inspirerad design och modern 3D-printad finish.",
    price: 279,
    stock: 7,
    category: "Belysning",
  },
  {
    slug: "muhammad-decoration",
    fileName: "muhammad.jpg",
    name: "Muhammad ﷺ Dekoration",
    description:
      "Stilren 3D-printad kalligrafidekoration med namnet Muhammad ﷺ för hylla, skrivbord eller hem.",
    price: 189,
    stock: 8,
    category: "Islamisk dekoration",
  },
  {
    slug: "love-decoration",
    fileName: "love.jpg",
    name: "Love Dekoration",
    description:
      "Modern 3D-printad dekoration som passar perfekt på skrivbord, hylla eller som personlig present.",
    price: 149,
    stock: 12,
    category: "Dekoration",
  },
  {
    slug: "page-holder",
    fileName: "pagestop.jpg",
    name: "Sidhållare",
    description:
      "Praktisk 3D-printad sidhållare som hjälper till att hålla boken öppen när du läser.",
    price: 79,
    stock: 20,
    category: "Tillbehör",
  },
  {
    slug: "bird-feeder",
    fileName: "birdfeeder.jpg",
    name: "Fågelmatare",
    description:
      "3D-printad fågelmatare för trädgård eller balkong. Enkel att fylla och montera.",
    price: 169,
    stock: 9,
    category: "Hem & trädgård",
  },
];

async function ensureBucket() {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const bucketExists = buckets.some((bucket) => bucket.id === bucketName);

  if (bucketExists) {
    console.log(`✓ Storage bucket "${bucketName}" already exists`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    bucketName,
    {
      public: true,
      allowedMimeTypes: ["image/jpeg"],
      fileSizeLimit: "15MB",
    },
  );

  if (createError) {
    throw createError;
  }

  console.log(`✓ Created Storage bucket "${bucketName}"`);
}

async function uploadProductImage(product) {
  const localPath = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "products",
    product.fileName,
  );

  const fileBuffer = await fs.readFile(localPath);

  const storagePath = `products/${product.fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

  console.log(`✓ Uploaded ${product.fileName}`);

  return data.publicUrl;
}

async function seedProducts() {
  await ensureBucket();

  const rows = [];

  for (const product of products) {
    const imageUrl = await uploadProductImage(product);

    rows.push({
      name: product.name,
      description: product.description,
      price: product.price,
      image_url: imageUrl,
      stock: product.stock,
      category: product.category,
    });
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw error;
  }

  const { error: insertError } = await supabase.from("products").insert(rows);

  if (insertError) {
    throw insertError;
  }

  console.log(`✓ Inserted ${rows.length} products`);
}

async function main() {
  try {
    console.log("Starting Priamos 3D Lab product seed...");
    console.log("");

    await seedProducts();

    console.log("");
    console.log("Seed complete.");
  } catch (error) {
    console.error("");
    console.error("Seed failed:");
    console.error(error);

    process.exitCode = 1;
  }
}

main();
