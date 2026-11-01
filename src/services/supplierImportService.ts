import { supabase } from "../lib/supabase";

export type SupplierImportFormat = "csv" | "xml";

export type SupplierImportError = {
  row: number;
  articleNumber: string | null;
  reason: string;
};

export type SupplierImportResult = {
  message: string;
  format: SupplierImportFormat;
  industry: string;
  received: number;
  created: number;
  updated: number;
  imported: number;
  skipped: number;
  errors: SupplierImportError[];
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

export async function importSupplierProducts(
  format: SupplierImportFormat,
): Promise<SupplierImportResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error(
      "Du måste vara inloggad som administratör.",
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/supplier/import/${format}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(45000),
    },
  );

  const result: unknown = await response.json();

  if (!response.ok) {
    const details =
      typeof result === "object" &&
      result !== null &&
      "details" in result &&
      typeof result.details === "string"
        ? result.details
        : null;

    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Importen misslyckades.";

    throw new Error(
      details ? `${message}: ${details}` : message,
    );
  }

  return result as SupplierImportResult;
}