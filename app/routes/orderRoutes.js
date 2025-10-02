const express = require("express");
const router = express.Router();
const { getAllOrders, updateOrderStatus, assignedEmployees, getOrdersByUser } = require("../controllers/order_controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/bills", authMiddleware, roleMiddleware("admin"), getAllOrders);
router.put("/bills/:id/status", updateOrderStatus);
router.put("/bills/:id/assign", assignedEmployees);
router.get("/user/:userId", authMiddleware, getOrdersByUser);

module.exports = router;