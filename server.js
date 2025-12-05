//path: oudra-server(same backend for web & mobile apps)/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

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

dotenv.config();
const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:8081"], // Web & Mobile
  credentials: true
}));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Connection Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
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