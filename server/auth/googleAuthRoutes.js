import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { z } from "zod";

const router = Router();

const googleJWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 },
);

const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
});

const customerSchema = z.object({
  id: z.uuid(),
  google_sub: z.string(),
  email: z.email(),
  name: z.string(),
});

function getConfig() {
  const config = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    frontendUrl: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sessionSecret: process.env.CUSTOMER_SESSION_SECRET,
  };

  if (
    !config.clientId ||
    !config.clientSecret ||
    !config.callbackUrl ||
    !config.supabaseUrl ||
    !config.supabaseKey ||
    !config.sessionSecret ||
    config.sessionSecret.length < 32
  ) {
    throw new Error("Google OAuth environment configuration is missing");
  }

  return config;
}

function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

// OAuth state cookie: used during Google's redirect flow.
function oauthStateCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

// Customer session cookie: sent from the frontend to the backend.
function customerSessionCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
    maxAge,
  };
}

function readCookie(req, name) {
  const entry = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return entry?.slice(name.length + 1) ?? null;
}

function matchesState(expected, actual) {
  if (!expected || typeof actual !== "string") {
    return false;
  }

  const left = Buffer.from(expected);
  const right = Buffer.from(actual);

  return left.length === right.length && timingSafeEqual(left, right);
}

function redirectWithError(res, message) {
  // Guard against a malformed FRONTEND_ORIGIN so the error
  // path itself cannot throw and turn into a 500.
  let frontendUrl = "http://localhost:5173";

  try {
    const configured = process.env.FRONTEND_ORIGIN;
    if (configured) {
      frontendUrl = new URL(configured).origin;
    }
  } catch {
    frontendUrl = "http://localhost:5173";
  }

  const url = new URL("/login", frontendUrl);
  url.searchParams.set("authError", message);

  return res.redirect(url.toString());
}

async function supabaseRequest(path, options = {}) {
  const config = getConfig();

  const headers = {
    apikey: config.supabaseKey,
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Legacy service-role JWTs support Bearer authentication.
  // New sb_secret_ keys must not be used as Bearer JWTs.
  if (!config.supabaseKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${config.supabaseKey}`;
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return response.json();
}

async function getCustomerFromSession(req) {
  const token = readCookie(req, "customer_session");

  if (!token) {
    return null;
  }

  try {
    const config = getConfig();

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.sessionSecret),
      {
        issuer: "priamos-shop",
        audience: "customer",
        algorithms: ["HS256"],
      },
    );

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireCustomer(req, res, next) {
  try {
    const customerId = await getCustomerFromSession(req);

    if (!customerId) {
      return res.status(401).json({
        error: "You must be logged in",
      });
    }

    res.locals.customerId = customerId;
    return next();
  } catch {
    return res.status(401).json({
      error: "Authentication failed",
    });
  }
}

export async function optionalCustomer(req, res, next) {
  try {
    const customerId = await getCustomerFromSession(req);

    res.locals.customerId = customerId ?? null;

    return next();
  } catch (error) {
    console.error("Optional customer authentication failed:", error);

    return res.status(500).json({
      error: "Could not verify customer session",
    });
  }
}

// --------------------------------------------------
// GET /api/auth/google
// Start Google OAuth authentication
// --------------------------------------------------

router.get("/google", (req, res) => {
  try {
    const config = getConfig();

    const state = randomBytes(32).toString("base64url");

    res.cookie(
      "google_oauth_state",
      state,
      oauthStateCookieOptions(10 * 60 * 1000),
    );

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    googleUrl.searchParams.set("client_id", config.clientId);
    googleUrl.searchParams.set("redirect_uri", config.callbackUrl);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", state);

    return res.redirect(googleUrl.toString());
  } catch (error) {
    console.error("Google OAuth start failed:", error);

    return res.status(503).json({
      error: "Google login is currently unavailable",
    });
  }
});

// --------------------------------------------------
// GET /api/auth/google/callback
// Complete Google OAuth authentication
// --------------------------------------------------

router.get("/google/callback", async (req, res) => {
  const expectedState = readCookie(req, "google_oauth_state");

  res.clearCookie("google_oauth_state", oauthStateCookieOptions(0));

  if (!matchesState(expectedState, req.query.state)) {
    return redirectWithError(res, "Invalid or expired login request");
  }

  if (req.query.error || typeof req.query.code !== "string") {
    return redirectWithError(res, "Google login was cancelled");
  }

  try {
    const config = getConfig();

    // Exchange authorization code for tokens.
    // This happens only on the server.
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: req.query.code,
        grant_type: "authorization_code",
        redirect_uri: config.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Google token exchange failed");
    }

    const tokenData = z
      .object({
        id_token: z.string().min(1),
      })
      .parse(await tokenResponse.json());

    // Verify Google's signature, issuer,
    // audience and token expiration.
    const { payload } = await jwtVerify(tokenData.id_token, googleJWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: config.clientId,
      algorithms: ["RS256"],
    });

    const profile = googleProfileSchema.parse(payload);

    if (!profile.email_verified) {
      return redirectWithError(res, "Your Google email is not verified");
    }

    // Identify customers by Google's stable sub,
    // never by their email address.
    const existingCustomers = await supabaseRequest(
      `customers?google_sub=eq.${encodeURIComponent(
        profile.sub,
      )}&select=id,google_sub,email,name&limit=1`,
    );

    let customer = existingCustomers[0];

    if (!customer) {
      const createdCustomers = await supabaseRequest(
        "customers?select=id,google_sub,email,name",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            google_sub: profile.sub,
            email: profile.email,
            name: profile.name ?? profile.email,
          }),
        },
      );

      customer = createdCustomers[0];
    }

    const validatedCustomer = customerSchema.parse(customer);

    // Create our own session JWT.
    // Google's tokens are never sent to React.
    const sessionToken = await new SignJWT({
      role: "customer",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(validatedCustomer.id)
      .setIssuer("priamos-shop")
      .setAudience("customer")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(config.sessionSecret));

    res.cookie(
      "customer_session",
      sessionToken,
      customerSessionCookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return res.redirect(new URL("/my-account", config.frontendUrl).toString());
  } catch (error) {
    console.error("Google OAuth callback failed:", error);

    return redirectWithError(res, "Could not sign in with Google");
  }
});

// --------------------------------------------------
// GET /api/auth/me
// Return the authenticated customer
// --------------------------------------------------

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customers = await supabaseRequest(
      `customers?id=eq.${encodeURIComponent(
        res.locals.customerId,
      )}&select=id,email,name&limit=1`,
    );

    if (!customers[0]) {
      return res.status(401).json({
        error: "Customer account not found",
      });
    }

    return res.json(
      z
        .object({
          id: z.uuid(),
          email: z.email(),
          name: z.string(),
        })
        .parse(customers[0]),
    );
  } catch (error) {
    console.error("Customer profile error:", error);

    return res.status(502).json({
      error: "Could not load customer profile",
    });
  }
});

// --------------------------------------------------
// POST /api/auth/logout
// End customer session
// --------------------------------------------------

router.post("/logout", (_req, res) => {
  res.clearCookie("customer_session", customerSessionCookieOptions(0));

  return res.status(204).end();
});

export default router;
