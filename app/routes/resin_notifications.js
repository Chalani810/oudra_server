const express = require("express");
const router = express.Router();
const { 
  getUnreadNotifications, 
  markNotificationAsRead 
} = require("../controllers/resin_notification_controller");

// GET /api/resin-notifications/unread
router.get("/unread", getUnreadNotifications);

// PATCH /api/resin-notifications/:id/read
router.patch("/:id/read", markNotificationAsRead);

module.exports = router;