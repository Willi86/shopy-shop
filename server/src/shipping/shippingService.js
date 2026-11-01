import { z } from "zod";

// Shipping prices are controlled by the backend.
// Never accept shipping prices from the frontend.
const SHIPPING_PRICES = Object.freeze({
  pickup: 59,
  home: 99,
});

const FREE_SHIPPING_THRESHOLD = 500;

const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{3}\s?\d{2}$/, "Invalid Swedish postal code");

const shippingMethodSchema = z.enum(["pickup", "home"]);

const servicePointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
});

const MOCK_SERVICE_POINTS = [
  {
    id: "MOCK-SE-001",
    name: "PostNord Ombud Stockholm",
    address: "Drottninggatan 1",
    postalCode: "111 51",
    city: "Stockholm",
  },
  {
    id: "MOCK-SE-002",
    name: "PostNord Ombud Göteborg",
    address: "Kungsgatan 1",
    postalCode: "411 19",
    city: "Göteborg",
  },
  {
    id: "MOCK-SE-003",
    name: "PostNord Ombud Malmö",
    address: "Södra Förstadsgatan 1",
    postalCode: "211 43",
    city: "Malmö",
  },
];

export function normalizePostalCode(postalCode) {
  return postalCodeSchema.parse(postalCode).replace(/\s/g, "");
}

export function calculateShippingPrice(method, subtotal) {
  const parsedMethod = shippingMethodSchema.parse(method);

  if (
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal) ||
    subtotal < 0
  ) {
    throw new Error("Invalid order subtotal");
  }

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }

  return SHIPPING_PRICES[parsedMethod];
}

export async function getServicePoints(postalCode) {
  normalizePostalCode(postalCode);

  // MOCK MODE ONLY.
  // Replace with the official PostNord sandbox API
  // after obtaining access and verifying its documentation.
  return z.array(servicePointSchema).parse(MOCK_SERVICE_POINTS);
}

export async function validateServicePoint(postalCode, servicePointId) {
  if (
    typeof servicePointId !== "string" ||
    !servicePointId.startsWith("MOCK-SE-")
  ) {
    return null;
  }

  const points = await getServicePoints(postalCode);

  return points.find((point) => point.id === servicePointId) ?? null;
}

export async function getEstimatedDelivery(postalCode) {
  normalizePostalCode(postalCode);

  // Illustrative estimate only; NOT a PostNord ETA.
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 3);

  return date.toISOString().slice(0, 10);
}

export const shippingConfig = Object.freeze({
  provider: "mock",
  prices: SHIPPING_PRICES,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
});
