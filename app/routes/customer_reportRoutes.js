const express = require("express");
const { generateCustomerReport } = require("../controllers/customer_report_controller");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, generateCustomerReport);

module.exports = router;