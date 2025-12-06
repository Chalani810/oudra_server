//path: oudra-server(same backend for web & mobile apps)/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
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
const reportRoutes  = require("./app/routes/reportRoutes");
const productreportRoutes = require("./app/routes/productreportRoutes");
const customerReportRoutes = require("./app/routes/customer_reportRoutes");
const predictionRoutes = require('./app/routes/predictionRoutes');

const treeRoutes = require('./app/routes/treeRoutes');
const syncRoutes = require('./app/routes/syncRoutes');

// Blockchain routes
const investorRoutes = require("./app/routes/investorRoutes");
const blockchainRoutes = require("./app/routes/blockchainRoutes");

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:8081"], // Web & Mobile
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/blockchain-investors';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📁 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
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
      verify: "/api/blockchain/verify"
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use("/uploads", express.static(path.join(__dirname, "app/uploads")));

app.use("/auth", authRoutes);
app.use("/event", evenRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/cart", cartRoutes);
app.use("/api", productRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/employee", employeeRoutes);
app.use("/contact", contactusRoutes);
app.use("/role", roleRoutes);
app.use("/salary", salaryRoutes);
app.use("/product", productRoutes);
app.use("/orders", orderRoutes);
app.use("/feedback", feedbackRoutes);
app.use('/reports', reportRoutes);
app.use("/order_report", order_reportRoutes);
app.use("/product_report", productreportRoutes);
app.use("/customer_report", customerReportRoutes);
app.use("/predict", predictionRoutes);
app.use('/api', treeRoutes);
app.use('/api', syncRoutes); 

// Optional catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Blockchain routes - IMPORTANT: These must be defined
app.use("/api/investors", investorRoutes);
app.use("/api/blockchain", blockchainRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: `Route ${req.url} not found` 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({ 
    success: false, 
    error: err.message || 'Something went wrong!',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📊 Blockchain API Endpoints:`);
  console.log(`   GET    http://localhost:${PORT}/api/investors`);
  console.log(`   POST   http://localhost:${PORT}/api/investors`);
  console.log(`   GET    http://localhost:${PORT}/api/investors/:id`);
  console.log(`   PUT    http://localhost:${PORT}/api/investors/:id`);
  console.log(`   DELETE http://localhost:${PORT}/api/investors/:id`);
  console.log(`   GET    http://localhost:${PORT}/api/blockchain/chain`);
  console.log(`   GET    http://localhost:${PORT}/api/blockchain/verify`);
  console.log(`   GET    http://localhost:${PORT}/api/blockchain/audit/:investorId`);
  console.log(`   GET    http://localhost:${PORT}/api/blockchain/block/:index\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

module.exports = app;
