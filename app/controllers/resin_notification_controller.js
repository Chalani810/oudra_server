const ResinNotification = require("../models/ResinNotification");

// Get all unread resin notifications for the admin dashboard
const getUnreadNotifications = async (req, res) => {
  try {
    const notifications = await ResinNotification.find({ isRead: false })
      .populate("treeId", "treeId block") // Pulls the tree string ID and block
      .sort({ createdAt: -1 });
      
    res.status(200).json({ data: notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: err.message });
  }
};

// Mark a specific notification as read when the admin dismisses it
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await ResinNotification.findByIdAndUpdate(id, { isRead: true });
    
    res.status(200).json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUnreadNotifications,
  markNotificationAsRead
};