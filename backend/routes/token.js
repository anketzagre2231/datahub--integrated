const express = require("express");
const axios = require("axios");
const {
  getQBConfig,
  updateTokens,
  setQBConfig,
  disconnectConfig,
} = require("../qbconfig");

const router = express.Router();

function getAppBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${proto}://${host}`;
  return (process.env.CORS_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
}

// ────────────────────────────────────────────────────────────
// GET /refresh-token — Refresh access token using refresh token
// ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /refresh-token:
 *   get:
 *     summary: Refresh QuickBooks Token
 *     responses:
 *       200:
 *         description: Token refreshed
 */
router.get("/refresh-token", async (req, res) => {
  const qb = getQBConfig();

  // Validate required config
  if (!qb.refreshToken || !qb.basicToken) {
    return res.status(400).json({
      error:
        "Missing refresh token or basic token. Please check configuration.",
    });
  }

  try {
    const response = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: qb.refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${qb.basicToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      },
    );

    // Update tokens with expiry tracking
    updateTokens(
      response.data.access_token,
      response.data.refresh_token,
      response.data.expires_in,
    );

    // Do not return raw tokens to the caller to maintain security
    return res.json({
      success: true,
      message: "Tokens refreshed successfully",
      expiresIn: response.data.expires_in,
      lastSynced: new Date().toISOString()
    });
  } catch (error) {
    console.error(
      "❌ Token refresh failed:",
      error.response?.data || error.message,
    );

    // Return the original error response from QuickBooks
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    // Fallback error response
    return res.status(500).json({
      error: "Failed to refresh token",
      details: error.message,
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/auth/quickbooks — Start OAuth flow
// ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/quickbooks:
 *   get:
 *     summary: Start QuickBooks OAuth flow
 */
router.get("/api/auth/quickbooks", (req, res) => {
  const qb = getQBConfig();
  const clientId = qb.clientId || process.env.QB_CLIENT_ID;
  const appBaseUrl = getAppBaseUrl(req);
  const redirectUri = process.env.QB_REDIRECT_URI || `${appBaseUrl}/api/backend/api/auth/callback`;
  const scope = "com.intuit.quickbooks.accounting";

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=init-oauth`;

  console.log("🔗 Redirecting to QuickBooks OAuth...");
  res.redirect(authUrl);
});

// ────────────────────────────────────────────────────────────
// GET /api/auth/callback — Handle OAuth redirect
// ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/callback:
 *   get:
 *     summary: QuickBooks OAuth callback
 */
router.get("/api/auth/callback", async (req, res) => {
  const { code, realmId } = req.query;
  const appBaseUrl = getAppBaseUrl(req);
  const frontendUrl = appBaseUrl;

  if (!code || !realmId) {
    console.error("❌ Callback missing code or realmId");
    return res.redirect(
      `${frontendUrl}/connections?status=error&message=Missing+code+or+realmId`,
    );
  }

  const qb = getQBConfig();
  const clientId = qb.clientId || process.env.QB_CLIENT_ID;
  const clientSecret = qb.clientSecret || process.env.QB_CLIENT_SECRET;
  const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const redirectUri = process.env.QB_REDIRECT_URI || `${appBaseUrl}/api/backend/api/auth/callback`;

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${basicToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      },
    );

    const now = new Date().toISOString();
    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.data.expires_in || 3600) * 1000,
    ).toISOString();

    // 2. Store tokens + connection metadata
    setQBConfig({
      realmId: realmId,
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      basicToken: basicToken,
      companyId: realmId,
      connectedAt: now,
      lastSynced: now,
      tokenExpiresAt: tokenExpiresAt,
      environment: qb.baseUrl?.includes("sandbox") ? "sandbox" : "production",
      syncedEntities: [
        "Customers",
        "Invoices",
        "Balance Sheet",
        "General Ledger",
        "Profit and Loss",
      ],
    });

    // 3. Fetch company info (non-blocking — connection is valid even if this fails)
    try {
      const companyRes = await axios.get(
        `${qb.baseUrl}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=75`,
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.data.access_token}`,
            Accept: "application/json",
          },
        },
      );

      const info = companyRes.data.CompanyInfo;
      if (info) {
        setQBConfig({ companyName: info.CompanyName });
        console.log(`🏢 Company: ${info.CompanyName}`);
      }
    } catch (companyErr) {
      console.warn("⚠️ Could not fetch company info:", companyErr.message);
      setQBConfig({ companyName: `Company ${realmId}` });
    }

    console.log("✅ QuickBooks authentication successful.");

    // 4. Redirect to frontend connections page
    return res.redirect(`${frontendUrl}/connections?status=success`);
  } catch (error) {
    console.error(
      "❌ QuickBooks Callback Error:",
      error.response?.data || error.message,
    );
    return res.redirect(
      `${frontendUrl}/connections?status=error&message=OAuth+exchange+failed`,
    );
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/auth/status — Connection status + metadata
// ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Get QuickBooks connection status and metadata
 *     responses:
 *       200:
 *         description: Connection status with full details
 */
router.get("/api/auth/status", (req, res) => {
  const qb = getQBConfig();
  const isConnected = !!(qb.accessToken && qb.realmId);

  if (!isConnected) {
    return res.json({
      success: true,
      isConnected: false,
      syncedEntities: [],
    });
  }

  return res.json({
    success: true,
    isConnected: true,
    companyName: qb.companyName || null,
    companyId: qb.companyId || qb.realmId,
    environment: qb.environment || "production",
    connectedAt: qb.connectedAt || null,
    lastSynced: qb.lastSynced || null,
    tokenExpiresAt: qb.tokenExpiresAt || null,
    syncedEntities: qb.syncedEntities || [],
  });
});

// ────────────────────────────────────────────────────────────
// GET /api/auth/disconnect — Fully disconnect integration
// ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/disconnect:
 *   get:
 *     summary: Disconnect from QuickBooks and clear all stored data
 */
router.get("/api/auth/disconnect", (req, res) => {
  disconnectConfig();

  return res.json({
    success: true,
    message: "Disconnected successfully",
  });
});

module.exports = router;
