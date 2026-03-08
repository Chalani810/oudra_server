const mongoose = require("mongoose");

const resinNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "HARVEST_READY" }, 
  treeId: { type: mongoose.Schema.Types.ObjectId, ref: "Tree" },
  
  // Resin-specific data
  resinScore: { type: Number },
  riskLevel: { type: String },
  
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ResinNotification", resinNotificationSchema);