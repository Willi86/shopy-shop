import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const router = Router();

const githubTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  scope: z.string().optional(),
});

const githubProfileSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
  avatar_url: z.url().nullable().optional(),
});

const adminRecordSchema = z.object({
  id: z.uuid(),
  github_id: z.number().int().positive(),
  github_login: z.string().min(1),
});

const SESSION_COOKIE = "github_admin_session";
const STATE_COOKIE = "github_oauth_state";

const STATE_MAX_AGE = 10 * 60 * 1000;
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

function getConfig() {
  const config = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
    allowedLogins: process.env.ADMIN_GITHUB_LOGINS,
    frontendUrl: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sessionSecret: process.env.CUSTOMER_SESSION_SECRET,
  };

  if (
    !config.clientId ||
    !config.clientSecret ||
    !config.callbackUrl ||
    !config.allowedLogins ||
    !config.supabaseUrl ||
    !config.supabaseKey ||
    !config.sessionSecret ||
    config.sessionSecret.length < 32
  ) {
    throw new Error("GitHub OAuth environment configuration is missing");
  }

  return config;
}

function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function cookieOptions(maxAge) {
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

function getFrontendUrl() {
  const configured = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

  return new URL(configured).origin;
}

function redirectWithError(res, message) {
  let frontendUrl = "http://localhost:5173";

  try {
    frontendUrl = getFrontendUrl();
  } catch {
    // Keep the error redirect safe.
  }

  const url = new URL("/login", frontendUrl);
  url.searchParams.set("authError", message);

  return res.redirect(url.toString());
}

function isAllowedAdmin(login) {
  const config = getConfig();

  const allowedLogins = config.allowedLogins
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowedLogins.includes(login.toLowerCase());
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }

  return response.json();
}

async function supabaseRequest(path, options = {}) {
  const config = getConfig();

  const headers = {
    apikey: config.supabaseKey,
    "Content-Type": "application/json",
    ...options.headers,
  };

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

async function findOrCreateAdmin(profile) {
  const githubId = profile.id;

  const existing = await supabaseRequest(
    `github_admins?github_id=eq.${githubId}` +
      "&select=id,github_id,github_login&limit=1",
  );

  if (existing[0]) {
    const admin = adminRecordSchema.parse(existing[0]);

    if (admin.github_login !== profile.login) {
      const updated = await supabaseRequest(
        `github_admins?id=eq.${encodeURIComponent(
          admin.id,
        )}&select=id,github_id,github_login`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            github_login: profile.login,
          }),
        },
      );

      return adminRecordSchema.parse(updated[0]);
    }

    return admin;
  }

  // The database must have a UNIQUE constraint on
  // github_id. This also prevents duplicate admin records
  // when multiple callbacks happen concurrently.
  const created = await supabaseRequest(
    "github_admins?on_conflict=github_id" + "&select=id,github_id,github_login",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        github_id: githubId,
        github_login: profile.login,
      }),
    },
  );

  return adminRecordSchema.parse(created[0]);
}

async function getAdminFromSession(req) {
  const token = readCookie(req, SESSION_COOKIE);

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
        audience: "github-admin",
        algorithms: ["HS256"],
      },
    );

    if (payload.role !== "admin" || typeof payload.sub !== "string") {
      return null;
    }

    const admins = await supabaseRequest(
      `github_admins?id=eq.${encodeURIComponent(
        payload.sub,
      )}&select=id,github_id,github_login&limit=1`,
    );

    if (!admins[0]) {
      return null;
    }

    const admin = adminRecordSchema.parse(admins[0]);

    // Recheck the allowlist on every authenticated request.
    if (!isAllowedAdmin(admin.github_login)) {
      return null;
    }

    return admin;
  } catch {
    return null;
  }
}

export async function requireGithubAdmin(req, res, next) {
  try {
    const admin = await getAdminFromSession(req);

    if (!admin) {
      return res.status(401).json({
        error: "Administrator authentication required",
      });
    }

    res.locals.githubAdmin = admin;

    return next();
  } catch (error) {
    console.error("GitHub admin authentication failed:", error);

    return res.status(401).json({
      error: "Administrator authentication failed",
    });
  }
}

// GET /api/auth/github
// Begin GitHub OAuth login.

router.get("/github", (req, res) => {
  try {
    const config = getConfig();

    const state = randomBytes(32).toString("base64url");

    res.cookie(STATE_COOKIE, state, cookieOptions(STATE_MAX_AGE));

    const githubUrl = new URL("https://github.com/login/oauth/authorize");

    githubUrl.searchParams.set("client_id", config.clientId);

    githubUrl.searchParams.set("redirect_uri", config.callbackUrl);

    githubUrl.searchParams.set("response_type", "code");

    githubUrl.searchParams.set("scope", "read:user");

    githubUrl.searchParams.set("state", state);

    return res.redirect(githubUrl.toString());
  } catch (error) {
    console.error("GitHub OAuth start failed:", error);

    return res.status(503).json({
      error: "GitHub login is currently unavailable",
    });
  }
});

// GET /api/auth/github/callback
// Validate state, exchange code, and establish session.

router.get("/github/callback", async (req, res) => {
  const expectedState = readCookie(req, STATE_COOKIE);

  res.clearCookie(STATE_COOKIE, cookieOptions(0));

  if (!matchesState(expectedState, req.query.state)) {
    return redirectWithError(res, "Invalid or expired GitHub login request");
  }

  if (req.query.error || typeof req.query.code !== "string") {
    return redirectWithError(res, "GitHub login was cancelled");
  }

  try {
    const config = getConfig();

    // Exchange the authorization code on the server.
    // GitHub access tokens never reach React.
    const tokenData = githubTokenSchema.parse(
      await githubRequest("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: req.query.code,
          redirect_uri: config.callbackUrl,
        }),
      }),
    );

    const profile = githubProfileSchema.parse(
      await githubRequest("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }),
    );

    // Only explicitly authorized GitHub users can
    // become administrators.
    if (!isAllowedAdmin(profile.login)) {
      return redirectWithError(
        res,
        "This GitHub account is not authorized as an administrator",
      );
    }

    // Store the stable GitHub numeric ID, not just login.
    const admin = await findOrCreateAdmin(profile);

    // Sign our own short-lived administrator JWT.
    // Do not store the GitHub access token in the browser.
    const sessionToken = await new SignJWT({
      role: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(admin.id)
      .setIssuer("priamos-shop")
      .setAudience("github-admin")
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(new TextEncoder().encode(config.sessionSecret));

    res.cookie(SESSION_COOKIE, sessionToken, cookieOptions(SESSION_MAX_AGE));

    return res.redirect(new URL("/admin", config.frontendUrl).toString());
  } catch (error) {
    console.error("[GITHUB OAUTH CALLBACK ERROR]", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    return redirectWithError(res, "Could not sign in with GitHub");
  }
});

// GET /api/auth/github/me
// Return the current authenticated GitHub admin.

router.get("/github/me", requireGithubAdmin, (req, res) => {
  const admin = res.locals.githubAdmin;

  return res.json({
    id: admin.id,
    githubId: admin.github_id,
    login: admin.github_login,
    role: "admin",
  });
});

// POST /api/auth/github/logout
// End the GitHub administrator session.

router.post("/github/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions(0));

  return res.status(204).end();
});

export default router;
