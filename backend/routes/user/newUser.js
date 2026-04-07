const express = require("express");
const { setQBConfig, getQBConfig } = require("../../qbconfig");
const axios = require("axios");
const tokenManager = require("../../tokenManager");

const router = express.Router();

/**
 * @swagger
 * /new-user:
 *   post:
 *     summary: Register a new QuickBooks user
 *     description: Accepts QuickBooks credentials, generates basic token, and saves to global configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - client_secret
 *               - refresh_token
 *               - access_token
 *               - realm_id
 *             properties:
 *               client_id:
 *                 type: string
 *                 description: QuickBooks OAuth client ID
 *               client_secret:
 *                 type: string
 *                 description: QuickBooks OAuth client secret
 *               refresh_token:
 *                 type: string
 *                 description: QuickBooks OAuth refresh token
 *               access_token:
 *                 type: string
 *                 description: QuickBooks OAuth access token
 *               realm_id:
 *                 type: string
 *                 description: QuickBooks company ID (realm ID)
 *               base_url:
 *                 type: string
 *                 description: QuickBooks API URL (defaults to sandbox if not specified)
 *                 enum: [sandbox, production]
 *     responses:
 *       200:
 *         description: User configuration saved successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post("/new-user", async (req, res) => {
  try {
    const {
      client_id,
      client_secret,
      refresh_token,
      access_token,
      realm_id,
      base_url = "sandbox", // Default to sandbox
    } = req.body;

    // Validate required fields
    if (
      !client_id ||
      !client_secret ||
      !refresh_token ||
      !access_token ||
      !realm_id
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "client_id",
          "client_secret",
          "refresh_token",
          "access_token",
          "realm_id",
        ],
        received: {
          client_id: !!client_id,
          client_secret: !!client_secret,
          refresh_token: !!refresh_token,
          access_token: !!access_token,
          realm_id: !!realm_id,
        },
      });
    }

    // Generate Basic Token from client_id and client_secret
    const basicTokenString = `${client_id}:${client_secret}`;
    const basicToken = Buffer.from(basicTokenString).toString("base64");

    // Determine base URL based on environment
    const qbBaseUrl =
      base_url === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    // Prepare configuration object for global storage
    const newUserConfig = {
      realmId: realm_id,
      accessToken: access_token,
      refreshToken: refresh_token,
      basicToken: basicToken,
      baseUrl: qbBaseUrl,
      // Also store raw credentials if needed for future use
      clientId: client_id,
      clientSecret: client_secret,
    };

    // Save to global configuration
    setQBConfig(newUserConfig);

    console.log("✅ New user configuration saved successfully");
    console.log(`   Realm ID: ${realm_id}`);
    console.log(`   Base URL: ${qbBaseUrl}`);
    console.log(`   Client ID: ${client_id.substring(0, 10)}...`);
    console.log(`   Basic Token Generated: ${basicToken.substring(0, 20)}...`);

    // Return success response (mask sensitive data)
    res.json({
      success: true,
      message: "User configuration saved successfully",
      data: {
        realmId: realm_id,
        baseUrl: qbBaseUrl,
        clientId: `${client_id.substring(0, 10)}...`,
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        basicTokenGenerated: true,
      },
    });
  } catch (error) {
    console.error("❌ Failed to save user configuration:", error.message);
    res.status(500).json({
      error: "Failed to save user configuration",
      details: error.message,
    });
  }
});

/**
 * @swagger
 * /new-user/validate:
 *   post:
 *     summary: Validate QuickBooks credentials without saving
 *     description: Tests if the provided credentials work with QuickBooks API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - access_token
 *               - realm_id
 *             properties:
 *               access_token:
 *                 type: string
 *               realm_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credentials are valid
 *       401:
 *         description: Invalid credentials
 */
router.post("/new-user/validate", async (req, res) => {
  const axios = require("axios");

  try {
    const { access_token, realm_id } = req.body;

    if (!access_token || !realm_id) {
      return res.status(400).json({
        error: "Missing required fields: access_token and realm_id",
      });
    }

    // Test the credentials by making a simple API call
    const testUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/companyinfo/${realm_id}?minorversion=75`;

    const response = await axios.get(testUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
      timeout: 5000,
    });

    if (response.data && response.data.CompanyInfo) {
      res.json({
        success: true,
        message: "Credentials are valid",
        companyName: response.data.CompanyInfo.CompanyName,
        companyAddress: response.data.CompanyInfo.CompanyAddr,
      });
    } else {
      res.status(401).json({
        error: "Invalid credentials",
        message: "Could not validate with QuickBooks",
      });
    }
  } catch (error) {
    console.error(
      "❌ Validation failed:",
      error.response?.data || error.message,
    );
    res.status(401).json({
      error: "Invalid credentials",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
