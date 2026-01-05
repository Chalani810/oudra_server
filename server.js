// path: oudra-server(same backend for web & mobile apps)/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: "*", // Allow ALL origins during development
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware - helps debug
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  next();
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oudra-db';
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
    message: "OUDRA API is running...",
    version: "1.0.0",
    endpoints: {
      apiDocs: "/api/docs",
      health: "/api/health",
      investors: "/api/investors",
      trees: "/api/trees",
      blockchain: "/api/blockchain",
      certificates: "/api/certificates"
    }
  });
});

// API Documentation route
app.get("/api/docs", (req, res) => {
  res.json({
    message: "OUDRA API Documentation",
    endpoints: {
      // Investor Management
      "GET /api/investors": "Get all investors with their trees",
      "POST /api/investors": "Create investor with tree assignment",
      "GET /api/investors/available-trees": "Get available trees for assignment",
      "GET /api/investors/:id": "Get investor by ID with tree details",
      "PUT /api/investors/:id": "Update investor information",
      "DELETE /api/investors/:id": "Delete investor and release trees",
      "GET /api/investors/tree/:treeId": "Get investor for a specific tree",
      
      // Tree Management
      "GET /api/trees": "Get all trees",
      "POST /api/trees": "Create new tree",
      "GET /api/trees/:treeId": "Get tree by ID",
      "PUT /api/trees/:treeId": "Update tree",
      "DELETE /api/trees/:treeId": "Delete tree",
      "GET /api/trees/:treeId/observations": "Get tree observations",
      "POST /api/trees/:treeId/observations": "Add observation",
      "GET /api/trees/:treeId/history": "Get tree history",
      
      // Certificate Management
      "POST /api/certificates/generate": "Generate certificate",
      "POST /api/certificates/harvest": "Generate harvest certificate",
      "GET /api/certificates/investor/:investorId": "Get investor certificates",
      "GET /api/certificates/:certificateId": "Get certificate by ID",
      "GET /api/certificates/:certificateId/download": "Download certificate",
      "GET /api/certificates/:certificateId/preview": "Preview certificate",
      
      // Blockchain
      "GET /api/blockchain/chain": "Get blockchain",
      "GET /api/blockchain/verify": "Verify blockchain integrity",
      "GET /api/blockchain/audit/:investorId": "Get investor audit trail",
      "GET /api/blockchain/block/:index": "Get block by index"
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    memory: process.memoryUsage()
  });
});

// Static files
app.use("/uploads", express.static(path.join(__dirname, "app/uploads")));

// ========================================
// CORE APPLICATION ROUTES
// ========================================

// 1. BLOCKCHAIN & INVESTOR ROUTES
const investorRoutes = require("./app/routes/investorRoutes");
const blockchainRoutes = require("./app/routes/blockchainRoutes");
const certificateRoutes = require("./app/routes/certificateRoutes");

app.use("/api/investors", investorRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/certificates", certificateRoutes);

// 2. TREE MANAGEMENT ROUTES
const treeRoutes = require('./app/routes/treeRoutes');
app.use('/api', treeRoutes);

// 3. SYNC ROUTES (for mobile)
const syncRoutes = require('./app/routes/syncRoutes');
app.use('/api', syncRoutes);

// ========================================
// EXISTING E-COMMERCE ROUTES
// ========================================
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

// E-commerce routes with /api prefix for consistency
app.use("/api/auth", authRoutes);
app.use("/api/event", evenRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/contact", contactusRoutes);
app.use("/api/role", roleRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/order_report", order_reportRoutes);
app.use("/api/product_report", productreportRoutes);
app.use("/api/customer_report", customerReportRoutes);
app.use("/api/predict", predictionRoutes);

// ========================================
// 404 HANDLER - MUST BE LAST!
// ========================================
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.url);
  res.status(404).json({ 
    success: false, 
    error: `Route ${req.method} ${req.url} not found`,
    suggestion: 'Check /api/docs for available endpoints'
  });
});

// ========================================
// GLOBAL ERROR HANDLER - MUST BE LAST!
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({ 
    success: false, 
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 OUDRA Server running on http://localhost:${PORT}`);
  console.log(`\n📊 CORE ENDPOINTS:`);
  console.log(`   📋 API Docs:          http://localhost:${PORT}/api/docs`);
  console.log(`   🩺 Health Check:      http://localhost:${PORT}/api/health`);
  console.log(`\n👥 INVESTOR MANAGEMENT:`);
  console.log(`   📝 GET/POST Investors: http://localhost:${PORT}/api/investors`);
  console.log(`   🌳 Available Trees:    http://localhost:${PORT}/api/investors/available-trees`);
  console.log(`   🔗 Tree Investor:      http://localhost:${PORT}/api/investors/tree/:treeId`);
  console.log(`\n🌳 TREE MANAGEMENT:`);
  console.log(`   🌴 GET/POST Trees:     http://localhost:${PORT}/api/trees`);
  console.log(`   📝 Observations:       http://localhost:${PORT}/api/trees/:treeId/observations`);
  console.log(`   📜 History:            http://localhost:${PORT}/api/trees/:treeId/history`);
  console.log(`\n🏆 CERTIFICATES:`);
  console.log(`   📄 Generate:           http://localhost:${PORT}/api/certificates/generate`);
  console.log(`   🌾 Harvest Cert:       http://localhost:${PORT}/api/certificates/harvest`);
  console.log(`   👤 Investor Certs:     http://localhost:${PORT}/api/certificates/investor/:id`);
  console.log(`\n🔗 BLOCKCHAIN:`);
  console.log(`   ⛓️  Chain:              http://localhost:${PORT}/api/blockchain/chain`);
  console.log(`   ✅ Verify:             http://localhost:${PORT}/api/blockchain/verify`);
  console.log(`   📊 Audit Trail:        http://localhost:${PORT}/api/blockchain/audit/:id\n`);
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