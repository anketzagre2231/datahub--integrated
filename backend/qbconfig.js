const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");

const stateFile = process.env.QB_STATE_FILE || path.join(process.env.VERCEL ? "/tmp" : __dirname, "qb-state.json");

function loadState() {
  try {
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading qb-state.json:", error);
  }
  return {};
}

function saveState(state) {
  try {
    const stateToSave = {
      realmId: state.realmId,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      basicToken: state.basicToken,
      companyName: state.companyName,
      companyId: state.companyId,
      environment: state.environment,
      connectedAt: state.connectedAt,
      lastSynced: state.lastSynced,
      tokenExpiresAt: state.tokenExpiresAt,
      syncedEntities: state.syncedEntities,
      disconnected: state.disconnected || false,
    };
    fs.writeFileSync(stateFile, JSON.stringify(stateToSave, null, 2));
  } catch (error) {
    console.error("Error saving qb-state.json:", error);
  }
}

const savedState = loadState();
const disconnected = !!savedState.disconnected;

let qbConfig = {
  realmId: disconnected ? null : (savedState.realmId || process.env.QB_REALM_ID),
  accessToken: disconnected ? null : (savedState.accessToken || process.env.QB_ACCESS_TOKEN),
  refreshToken: disconnected ? null : (savedState.refreshToken || process.env.QB_REFRESH_TOKEN),
  basicToken: disconnected ? null : (savedState.basicToken || process.env.QB_BASIC_TOKEN),
  baseUrl: process.env.QB_BASE_URL || "https://quickbooks.api.intuit.com",
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  companyName: savedState.companyName || null,
  companyId: savedState.companyId || null,
  environment: savedState.environment || (process.env.QB_BASE_URL?.includes("sandbox") ? "sandbox" : "production"),
  connectedAt: savedState.connectedAt || null,
  lastSynced: savedState.lastSynced || null,
  tokenExpiresAt: savedState.tokenExpiresAt || null,
  syncedEntities: savedState.syncedEntities || [],
  disconnected,
};

function validateConfig() {
  const required = ["realmId", "accessToken", "refreshToken", "basicToken"];
  const missing = required.filter((key) => !qbConfig[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ Missing QuickBooks config: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

function getQBConfig() {
  return qbConfig;
}

function updateTokens(newAccessToken, newRefreshToken, expiresIn) {
  qbConfig.accessToken = newAccessToken;
  qbConfig.refreshToken = newRefreshToken || qbConfig.refreshToken;
  qbConfig.lastSynced = new Date().toISOString();
  qbConfig.disconnected = false;
  if (expiresIn) {
    qbConfig.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  }
  saveState(qbConfig);
  console.log("✅ Tokens updated successfully");
}

function setQBConfig(config) {
  qbConfig = { ...qbConfig, ...config, disconnected: false };
  saveState(qbConfig);
  console.log("✅ QuickBooks config updated");
  console.log(`   Realm ID: ${qbConfig.realmId}`);
  console.log(`   Base URL: ${qbConfig.baseUrl}`);
  console.log(`   Company: ${qbConfig.companyName || "Unknown"}`);
}

function disconnectConfig() {
  qbConfig.accessToken = null;
  qbConfig.refreshToken = null;
  qbConfig.realmId = null;
  qbConfig.basicToken = null;
  qbConfig.companyName = null;
  qbConfig.companyId = null;
  qbConfig.connectedAt = null;
  qbConfig.lastSynced = null;
  qbConfig.tokenExpiresAt = null;
  qbConfig.syncedEntities = [];
  qbConfig.disconnected = true;
  saveState(qbConfig);
  console.log("🛑 QuickBooks connection fully cleared");
}

function resetConfig() {
  qbConfig = {
    realmId: process.env.QB_REALM_ID,
    accessToken: process.env.QB_ACCESS_TOKEN,
    refreshToken: process.env.QB_REFRESH_TOKEN,
    basicToken: process.env.QB_BASIC_TOKEN,
    baseUrl: process.env.QB_BASE_URL || "https://quickbooks.api.intuit.com",
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    companyName: null,
    companyId: null,
    environment: process.env.QB_BASE_URL?.includes("sandbox") ? "sandbox" : "production",
    connectedAt: null,
    lastSynced: null,
    tokenExpiresAt: null,
    syncedEntities: [],
    disconnected: false,
  };
  saveState(qbConfig);
}

module.exports = {
  getQBConfig,
  updateTokens,
  setQBConfig,
  disconnectConfig,
  resetConfig,
  validateConfig,
};

validateConfig();
