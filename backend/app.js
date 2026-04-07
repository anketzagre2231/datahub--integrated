const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const balanceSheetRoutes = require("./routes/balancesheet/balanceSheet");
const balanceSheetRoutesDetail = require("./routes/balancesheet/balanceSheetFullDetail");
const tokenRoutes = require("./routes/token");
const generalLedgerRoutes = require("./routes/account_detail/generalLedger");
const profitAndLoss = require("./routes/profit_and_loss/profitAndLoss");
const pnlStatement = require("./routes/profit_and_loss/profitAndLossStatement");
const customerRoutes = require("./routes/customers/customers");
const invoiceRoutes = require("./routes/invoices/invoices");
const cashflowRoutes = require("./routes/cash_flow/cash_flow");
const user = require("./routes/user/newUser");

const { validateConfig, getQBConfig } = require("./qbconfig");

const app = express();

validateConfig();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "QuickBooks API",
      version: "1.0.0",
      description: "API for QuickBooks integration",
    },
    servers: [
      {
        url: process.env.APP_URL || process.env.API_URL || "http://localhost:5000",
        description: "Application server",
      },
    ],
  },
  apis: ["./backend/routes/*.js", "./backend/routes/**/*.js", "./routes/*.js", "./routes/**/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get("/health", (_req, res) => {
  const qb = getQBConfig();
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    quickbooksConnected: !!(qb.accessToken && qb.realmId),
  });
});

function checkQBAuth(req, res, next) {
  const qb = getQBConfig();

  if (!qb || !qb.accessToken || !qb.realmId) {
    return res.status(401).json({
      success: false,
      message: "QuickBooks not connected",
    });
  }

  next();
}

app.use("/", tokenRoutes);
app.use("/", checkQBAuth, balanceSheetRoutes);
app.use("/", checkQBAuth, balanceSheetRoutesDetail);
app.use("/", checkQBAuth, generalLedgerRoutes);
app.use("/", checkQBAuth, profitAndLoss);
app.use("/", checkQBAuth, pnlStatement);
app.use("/", checkQBAuth, customerRoutes);
app.use("/", checkQBAuth, invoiceRoutes);
app.use("/", checkQBAuth, cashflowRoutes);
app.use("/", user);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  console.error("❌ Server error:", err.stack || err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    const qb = getQBConfig();
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📝 Swagger docs available at http://localhost:${PORT}/api-docs`);
    console.log(`❤️ Health check at http://localhost:${PORT}/health`);
    console.log(`🔌 Initial QuickBooks state: ${qb.accessToken && qb.realmId ? "CONNECTED" : "DISCONNECTED"}`);
  });
}

module.exports = app;
