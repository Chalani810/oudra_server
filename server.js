// path: oudra-server/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

// Load env variables
dotenv.config();

const app = express();

/* =======================
   Middleware
======================= */
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:8081"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================
   MongoDB Connection
======================= */
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/blockchain-investors";
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log(`📁 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =======================
   Static Files
======================= */
app.use("/uploads", express.static(path.join(__dirname, "app/uploads")));



/* =======================
   Routes Imports
======================= */
// Core system
const authRoutes = require("./app/routes/authRoutes");
const evenRoutes = require("./app/routes/evenRoutes");
const productRoutes = require("./app/routes/productRoutes");
const checkoutRoutes = require("./app/routes/checkoutRoutes");
const cartRoutes = require("./app/routes/cartRoutes");
const invoiceRoutes = require("./app/routes/invoiceRoutes");
const employeeRoutes = require("./app/routes/employeeRoutes");
const contactusRoutes = require("./app/routes/contactusRoutes");
const roleRoutes = require("./app/routes/roleRoutes");
const order_reportRoutes = require("./app/routes/order_reportRoutes");
const salaryRoutes = require("./app/routes/salaryRoutes");
const feedbackRoutes = require("./app/routes/feedbackRoutes");
const orderRoutes = require("./app/routes/orderRoutes");
const reportRoutes = require("./app/routes/reportRoutes");
const productreportRoutes = require("./app/routes/productreportRoutes");
const customerReportRoutes = require("./app/routes/customer_reportRoutes");
const predictionRoutes = require("./app/routes/predictionRoutes");
const treeRoutes = require("./app/routes/treeRoutes");
const syncRoutes = require("./app/routes/syncRoutes");


// Blockchain
const investorRoutes = require("./app/routes/investorRoutes");
const blockchainRoutes = require("./app/routes/blockchainRoutes");

/* =======================
   Root & Health
======================= */
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    endpoints: {
      investors: "/api/investors",
      blockchain: "/api/blockchain/chain",
      verify: "/api/blockchain/verify",
      health: "/api/health"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* =======================
   API Routes
======================= */
app.use("/auth", authRoutes);
app.use("/event", evenRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/cart", cartRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/employee", employeeRoutes);
app.use("/contact", contactusRoutes);
app.use("/role", roleRoutes);
app.use("/salary", salaryRoutes);
app.use("/orders", orderRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/reports", reportRoutes);
app.use("/order_report", order_reportRoutes);
app.use("/product_report", productreportRoutes);
app.use("/customer_report", customerReportRoutes);
app.use("/predict", predictionRoutes);

// shared /api routes
app.use("/api", productRoutes);
app.use("/api", treeRoutes);
app.use("/api", syncRoutes);

/* =======================
   🔗 Blockchain Routes (IMPORTANT)
======================= */
app.use("/api/investors", investorRoutes);
app.use("/api/blockchain", blockchainRoutes);

/* =======================
   404 Handler (LAST ROUTE)
======================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

/* =======================
   Global Error Handler
======================= */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

/* =======================
   Start Server
======================= */
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\n📌 Investor APIs`);
  console.log(`POST   /api/investors`);
  console.log(`GET    /api/investors`);
  console.log(`PUT    /api/investors/:id`);
  console.log(`DELETE /api/investors/:id`);
  console.log(`\n📌 Blockchain APIs`);
  console.log(`GET    /api/blockchain/chain`);
  console.log(`GET    /api/blockchain/verify`);
});

/* =======================
   Graceful Shutdown
======================= */
process.on("SIGTERM", () => {
  console.log("👋 Shutting down...");
  mongoose.connection.close(false, () => process.exit(0));
});

module.exports = app;
