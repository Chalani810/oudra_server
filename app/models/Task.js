// oudra-server/app/models/Task.js
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  taskId: {
    type: String,
    required: true,
    unique: true,
    default: () => `TASK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
  },
  title: {
    type: String,
    required: [true, "Task title is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  taskType: {
  type: String,
  enum: [
    "inspection",
    "weeding", 
    "fertilizing",
    "land clearing",
    "planting",
    "special treatments",
    "road maintenance",
    "pruning",
    "inoculation",
    "fence maintenance",
    "take measurements",
    "harvesting",
    "other"
  ],
  default: "inspection",
},
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["pending", "assigned", "in_progress", "completed", "cancelled", "overdue"],
    default: "pending",
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: [true, "Employee assignment is required"],
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Will be set when auth is implemented
  },
  
  // Location & Trees
  block: {
    type: String,
    required: [true, "Block is required"],
  },
  trees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tree",
  }],
  specificTree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tree",
  },
  
  // Dates
  createdAt: {
    type: Date,
    default: Date.now,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: [true, "Due date is required"],
  },
  completedAt: {
    type: Date,
  },
  
  // Tracking
  notes: {
    type: String,
    trim: true,
  },
  completionNotes: {
    type: String,
    trim: true,
  },
  fieldWorkerNotes: {
    type: String,
    trim: true,
  },
  
  // Mobile app sync
  lastSyncAt: {
    type: Date,
  },
  mobileAppViewed: {
    type: Boolean,
    default: false,
  },
  mobileNotificationSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for faster queries
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ block: 1, status: 1 });
taskSchema.index({ taskId: 1 });

module.exports = mongoose.model("Task", taskSchema);