import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router";

import {
  createAdminProduct,
  updateAdminProduct,
  type ProductFormData,
} from "../services/adminProductService";

import { getProducts } from "../services/productService";

import type { Product } from "../types/product";

const initialForm: ProductFormData = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "",
};

function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [form, setForm] = useState<ProductFormData>(initialForm);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pageTitle = editingProduct ? "Redigera produkt" : "Lägg till produkt";

  const displayedImage = imagePreviewUrl ?? editingProduct?.imageUrl ?? null;

  useEffect(() => {
    let cancelled = false;

    getProducts()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setProducts(data);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Kunde inte ladda produkterna.",
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function reloadProducts() {
    try {
      const data = await getProducts();

      setProducts(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Kunde inte ladda produkterna.",
      );
    }
  }

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, "sv")),
    [products],
  );

  function updateField<Key extends keyof ProductFormData>(
    key: Key,
    value: ProductFormData[Key],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  function clearImagePreview() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImagePreviewUrl(null);
  }

  function resetForm() {
    setForm(initialForm);
    setEditingProduct(null);
    setImageFile(null);

    clearImagePreview();

    setError(null);
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);

    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
    });

    setImageFile(null);

    clearImagePreview();

    setError(null);
    setSuccessMessage(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Bilden måste vara JPG eller WebP.");

      event.target.value = "";

      return;
    }

    const maxFileSize = 2 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setError(
        "Bilden får vara högst 2 MB. Optimera bilden innan uppladdning.",
      );

      event.target.value = "";

      return;
    }

    clearImagePreview();

    setImageFile(file);

    setImagePreviewUrl(URL.createObjectURL(file));

    setError(null);
  }

  function validateForm(): string | null {
    if (form.name.trim().length < 2) {
      return "Produktnamnet måste innehålla minst 2 tecken.";
    }

    if (form.description.trim().length < 10) {
      return "Beskrivningen måste innehålla minst 10 tecken.";
    }

    // Enhanced price validation
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      return "Priset måste vara större än 0.";
    }

    if (price > 99999999.99) {
      return "Priset får inte överstiga 99 999 999,99 kr.";
    }

    // Check for too many decimal places
    if (price.toString().split(".")[1]?.length > 2) {
      return "Priset får ha högst 2 decimaler.";
    }

    if (!Number.isInteger(form.stock) || form.stock < 0) {
      return "Lagersaldot måste vara 0 eller högre.";
    }

    if (form.category.trim().length < 2) {
      return "Ange en kategori.";
    }

    if (!editingProduct && !imageFile) {
      return "Du måste välja en produktbild.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);

      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      if (editingProduct) {
        await updateAdminProduct(
          editingProduct.id,
          form,
          editingProduct.imageUrl,
          imageFile ?? undefined,
        );

        resetForm();

        setSuccessMessage("Produkten har uppdaterats.");
      } else {
        if (!imageFile) {
          setError("Du måste välja en produktbild.");

          return;
        }

        await createAdminProduct(form, imageFile);

        resetForm();

        setSuccessMessage("Produkten har skapats.");
      }

      await reloadProducts();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:py-12">
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Adminpanel
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            Produkter
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Skapa och redigera produkter som visas i butiken.
          </p>
        </div>

        <Link
          to="/admin"
          className="inline-flex w-fit rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          ← Till ordrar
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {editingProduct ? "Redigering" : "Ny produkt"}
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                {pageTitle}
              </h2>
            </div>

            {editingProduct && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950"
              >
                Avbryt
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="productName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Produktnamn
              </label>

              <input
                id="productName"
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Fanoos Premium"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Kategori
              </label>

              <input
                id="category"
                type="text"
                value={form.category}
                onChange={(event) =>
                  updateField("category", event.target.value)
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Belysning"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Beskrivning
              </label>

              <textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                required
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Beskriv produkten..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="price"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Pris (kr)
                </label>

                <input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={form.price === 0 ? "" : form.price.toString()}
                  onChange={(event) => {
                    const value = event.target.value.replace(/,/g, "."); // Replace comma with dot
                    const numValue = parseFloat(value);
                    if (value === "" || value === "-") {
                      updateField("price", 0);
                      return;
                    }
                    if (!isNaN(numValue) && numValue >= 0) {
                      // Round to 2 decimal places and clamp
                      const rounded = Math.round(numValue * 100) / 100;
                      const clamped = Math.min(rounded, 99999999.99);
                      updateField("price", clamped);
                    }
                  }}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
              </div>

              <div>
                <label
                  htmlFor="stock"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Lager
                </label>

                <input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) =>
                    updateField("stock", Number(event.target.value))
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="productImage"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Produktbild
              </label>

              <input
                id="productImage"
                type="file"
                accept="image/jpeg,image/webp"
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />

              <p className="mt-2 text-xs text-slate-500">
                JPG eller WebP, max 2 MB.
                {editingProduct &&
                  " Lämna tomt för att behålla nuvarande bild."}
              </p>
            </div>

            {displayedImage && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={displayedImage}
                  alt="Förhandsvisning"
                  className="block h-auto w-full"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting
                ? "Sparar..."
                : editingProduct
                  ? "Spara ändringar"
                  : "Skapa produkt"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Alla produkter
              </h2>

              {!isLoading && (
                <p className="mt-1 text-sm text-slate-500">
                  {products.length} produkter
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({
                length: 4,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-52 animate-pulse rounded-3xl bg-slate-200"
                />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
              <h3 className="text-xl font-bold text-slate-950">
                Inga produkter
              </h3>

              <p className="mt-2 text-slate-600">
                Skapa din första produkt med formuläret.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {sortedProducts.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="aspect-16/10 overflow-hidden bg-slate-100">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {product.category}
                        </p>

                        <h3 className="mt-1 font-bold text-slate-950">
                          {product.name}
                        </h3>
                      </div>

                      <p className="shrink-0 font-bold text-slate-950">
                        {product.price.toLocaleString("sv-SE")} kr
                      </p>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {product.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">
                        {product.stock} i lager
                      </span>

                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Redigera
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default AdminProductsPage;
