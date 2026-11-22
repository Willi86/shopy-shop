import { z } from "zod";

// This is the ONLY file that knows Resend's address and API key.
const RESEND_EMAILS_URL = "https://api.resend.com/emails";

const resendResponseSchema = z.object({
  id: z.string().min(1),
});

/**
 * Sends one email through Resend.
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * idempotencyKey makes sure the same key never sends twice
 * (Resend remembers keys for 24 hours):
 * https://resend.com/docs/dashboard/emails/idempotency-keys
 *
 * Throws on any failure. The caller decides what to do with it.
 */
export async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email is not configured (RESEND_API_KEY / EMAIL_FROM)");
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!response.ok) {
    const reason =
      body && typeof body.message === "string" ? body.message : "unknown error";

    throw new Error(`Resend request failed: ${response.status} ${reason}`);
  }

  // Validate Resend's answer before using it.
  return resendResponseSchema.parse(body);
}
