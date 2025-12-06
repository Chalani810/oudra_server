const mongoose = require("mongoose");

const WorkflowLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: String,
    required: true
  },
  fromStatus: {
    type: String,
    enum: ["Pending", "Ready", "Medium", "Not Ready"]
  },
  toStatus: {
    type: String,
    enum: ["Pending", "Ready", "Medium", "Not Ready"]
  },
  notes: {
    type: String,
    default: ""
  },
  resinScore: {
    type: Number,
    default: null
  },
  riskLevel: {
    type: String,
    enum: ["High", "Moderate", "Low", "Critical", "Pending"]
  }
}, { _id: false });

const ResinAnalysisSchema = new mongoose.Schema({
  treeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tree",
    required: true,
  },
  resinScore: {
    type: Number,
    default: null
  },
  riskLevel: {
    type: String,
    enum: ["High", "Moderate", "Low", "Critical", "Pending"],
    default: "Pending"
  },
  block: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Ready", "Medium", "Not Ready", "Pending"],
    default: "Pending"
  },
  originalImageUrl: {
    type: String,
    default: null
  },
  workerName: {
    type: String,
    default: ""
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Workflow audit log
  workflowLog: [WorkflowLogSchema]

});

// Auto-add initial log entry when created
ResinAnalysisSchema.pre('save', function(next) {
  if (this.isNew) {
    this.workflowLog.push({
      action: "Analysis Created",
      performedBy: this.workerName || "System",
      fromStatus: null,
      toStatus: this.status,
      notes: "Initial resin analysis record created",
      resinScore: this.resinScore,
      riskLevel: this.riskLevel
    });
  }
  next();
});

module.exports = mongoose.model("Resin", ResinAnalysisSchema);