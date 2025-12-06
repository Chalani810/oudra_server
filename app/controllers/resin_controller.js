// controllers/resin_controller.js
const Resin = require("../models/Resin");
const Tree = require("../models/TreeModel");

// Add Resin Analysis
const addResinAnalysis = async (req, res) => {
  try {
    const {
      treeId,
      resinScore,
      riskLevel,
      status,
      workerName
    } = req.body;

    if (!treeId || !workerName) {
      return res.status(400).json({
        message: "Tree ID and Worker Name are required",
      });
    }

    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: "Tree not found" });
    }

    const record = new Resin({
      treeId,
      resinScore,
      riskLevel,
      block: tree.block,
      status: status || "Pending",
      workerName
    });

    await record.save();

    res.status(201).json({
      message: "Resin analysis record saved",
      data: record,
    });

  } catch (err) {
    console.error("Error in addResinAnalysis:", err);
    res.status(500).json({ error: err.message });
  }
};

// controllers/resin_controller.js - IMPROVED VERSION
const updateResinStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, performedBy } = req.body;

    console.log("Update status request:", { id, status, notes, performedBy });

    if (!status || !performedBy) {
      return res.status(400).json({
        message: "Status and performedBy are required"
      });
    }

    // Validate status value
    const validStatuses = ["Ready", "Medium", "Not Ready", "Pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value"
      });
    }

    const record = await Resin.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    const previousStatus = record.status;

    // Add to workflow log
    const workflowEntry = {
      action: "Status Updated",
      performedBy,
      notes: notes || `Status changed from ${previousStatus} to ${status}`,
      timestamp: new Date()
    };

    // Only add status fields if they are different
    if (previousStatus !== status) {
      workflowEntry.fromStatus = previousStatus;
      workflowEntry.toStatus = status;
    }

    record.workflowLog.push(workflowEntry);

    // Update main record
    record.status = status;
    record.timestamp = new Date();

    await record.save();

    // Populate treeId before sending response
    const updatedRecord = await Resin.findById(id).populate('treeId');

    console.log("Status update successful:", updatedRecord.status);

    res.status(200).json({
      message: "Status updated successfully",
      data: updatedRecord
    });

  } catch (err) {
    console.error("Error in updateResinStatus:", err);
    res.status(500).json({ 
      error: err.message,
      details: "Server error occurred while updating status"
    });
  }
};

// Add manual log entry - FIXED VERSION
const addWorkflowLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, performedBy, notes } = req.body;

    if (!action || !performedBy) {
      return res.status(400).json({
        message: "Action and performedBy are required"
      });
    }

    const record = await Resin.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    const workflowEntry = {
      action,
      performedBy,
      notes: notes || `${action} performed`,
      timestamp: new Date()
    };

    record.workflowLog.push(workflowEntry);
    await record.save();

    // Populate treeId before sending response
    await record.populate('treeId');

    res.status(200).json({
      message: "Workflow log added successfully",
      data: record
    });

  } catch (err) {
    console.error("Error in addWorkflowLog:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get all records
const getAllResinAnalysis = async (req, res) => {
  try {
    const records = await Resin.find()
      .populate('treeId')
      .sort({ timestamp: -1 });
    
    res.status(200).json({ data: records });
  } catch (err) {
    console.error("Error in getAllResinAnalysis:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Resin by Record ID
const getResinById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Resin.findById(id).populate('treeId');

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({ data: record });
  } catch (err) {
    console.error("Error in getResinById:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Resin Analysis by Tree ID
const getResinByTreeId = async (req, res) => {
  try {
    const { treeId } = req.params;

    const records = await Resin.find({ treeId })
      .populate('treeId')
      .sort({ timestamp: -1 });

    if (!records.length) {
      return res.status(404).json({ message: "No analysis found for this tree" });
    }

    res.status(200).json({ data: records });
  } catch (err) {
    console.error("Error in getResinByTreeId:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addResinAnalysis,
  getAllResinAnalysis,
  getResinById,
  getResinByTreeId,
  updateResinStatus,
  addWorkflowLog
};