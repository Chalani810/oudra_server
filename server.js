//server.js code:
//server.js code:
const dotenv = require("dotenv");
dotenv.config();  // ← move this here, BEFORE all requires

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Existing routes
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
const resinRoutes = require("./app/routes/resinRoutes");
const treeRoutes = require("./app/routes/treeRoutes");
const syncRoutes = require("./app/routes/syncRoutes");
const iotRoutes = require('./app/routes/iotRoutes');

// Blockchain routes
const investorRoutes = require("./app/routes/investorRoutes");
const blockchainRoutes = require("./app/routes/blockchainRoutes");
const certificateRoutes = require("./app/routes/certificateRoutes");

// Task Management routes
const taskRoutes = require("./app/routes/taskRoutes");

// Load environment variables FIRST before anything else

const app = express();

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ FIXED: Now correctly reads MONGO_URI from your .env
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error("❌ FATAL: No MongoDB URI found. Set MONGO_URI in your .env file.");
  process.exit(1);
}

console.log(`🔗 Connecting to MongoDB...`);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📁 Database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "API is running...",
    endpoints: {
      investors: "/api/investors",
      blockchain: "/api/blockchain/chain",
      verify: "/api/blockchain/verify",
      sensor: "/api/sensor"
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Debug endpoints
app.get("/api/debug", (req, res) => {
  res.json({
    message: "Debug endpoint",
    routes: {
      trees: "/api/trees",
      tasks: "/api/tasks",
      employees: "/employee",
    }
  });
});

app.get("/debug", (req, res) => {
  res.json({ message: "Root debug endpoint" });
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Static files
app.use("/uploads", express.static(path.join(__dirname, "app/uploads")));

// ===== ALL ROUTES =====

app.use("/auth", authRoutes);
app.use("/event", evenRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/cart", cartRoutes);
app.use("/api", productRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/contact", contactusRoutes);
app.use("/role", roleRoutes);
app.use("/salary", salaryRoutes);
app.use("/product", productRoutes);
app.use("/orders", orderRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/reports", reportRoutes);
app.use("/order_report", order_reportRoutes);
app.use("/product_report", productreportRoutes);
app.use("/customer_report", customerReportRoutes);
app.use("/resin", resinRoutes);

app.use('/api', treeRoutes);
app.use('/api', syncRoutes);
app.use('/api', iotRoutes);

// Blockchain routes
app.use("/api/investors", investorRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/certificates", certificateRoutes);

// Oudra project routes
app.use("/employee", employeeRoutes);

// Task routes
app.use("/api/tasks", taskRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.url} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Something went wrong!",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Start server
// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});

server.timeout = 900000; // 15 minutes — prevents Express cutting long Polygon sync requests

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM signal received: closing HTTP server");
  mongoose.connection.close(false, () => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});

module.exports = app;