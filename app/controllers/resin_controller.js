// controllers/resin_controller.js
const Resin = require("../models/Resin");
const Tree = require("../models/TreeModel");
const axios = require("axios");
const FormData = require("form-data");
const mongoose = require("mongoose");

// Add Resin Analysis
const addResinAnalysis = async (req, res) => {
  try {
    const { treeId, resinScore, riskLevel, status, workerName } = req.body;

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
      workerName,
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
        message: "Status and performedBy are required",
      });
    }

    // Validate status value
    const validStatuses = ["Ready", "Medium", "Not Ready", "Pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value",
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
      timestamp: new Date(),
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
    const updatedRecord = await Resin.findById(id).populate("treeId");

    console.log("Status update successful:", updatedRecord.status);

    res.status(200).json({
      message: "Status updated successfully",
      data: updatedRecord,
    });
  } catch (err) {
    console.error("Error in updateResinStatus:", err);
    res.status(500).json({
      error: err.message,
      details: "Server error occurred while updating status",
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
        message: "Action and performedBy are required",
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
      timestamp: new Date(),
    };

    record.workflowLog.push(workflowEntry);
    await record.save();

    // Populate treeId before sending response
    await record.populate("treeId");

    res.status(200).json({
      message: "Workflow log added successfully",
      data: record,
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
      .populate("treeId")
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
    const record = await Resin.findById(id).populate("treeId");

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({ data: record });
  } catch (err) {
    console.error("Error in getResinById:", err);
    res.status(500).json({ error: err.message });
  }
};

// path: server/controllers/resin_controller.js

const getResinByTreeId = async (req, res) => {
  try {
    const { treeId } = req.params; // This is "T-000013"

    console.log("Searching resin records for Tree ID:", treeId);
    // 1. Find the actual tree document using the custom "T-000013" string
    const tree = await Tree.findOne({
      $or: [
        { treeId: treeId }, // Matches "T-000013"
        { _id: mongoose.Types.ObjectId.isValid(treeId) ? treeId : null },
      ],
    });

    if (!tree) {
      return res.status(404).json({ message: "Tree document not found" });
    }

    // 2. Now search for Resin records linked to that Tree's internal _id
    const records = await Resin.find({ treeId: tree._id })
      .populate("treeId")
      .sort({ timestamp: -1 });

    if (!records || records.length === 0) {
      return res
        .status(404)
        .json({ message: "No analysis records found for this tree" });
    }

    res.status(200).json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLatestWorkflowLogByTreeId = async (req, res) => {
  try {
    const { treeId } = req.params;

    // 1. Find the tree document (handling both custom string ID and MongoDB ObjectId)
    const tree = await Tree.findOne({
      $or: [
        { treeId: treeId },
        { _id: mongoose.Types.ObjectId.isValid(treeId) ? treeId : null },
      ],
    });

    if (!tree) {
      return res.status(404).json({ message: "Tree document not found" });
    }

    // 2. Get the total count of resin records for this tree (for history UI)
    const historyCount = await Resin.countDocuments({ treeId: tree._id });

    // 3. Find the most recent Resin record and slice the workflowLog array
    const latestRecord = await Resin.findOne(
      { treeId: tree._id },
      {
        workflowLog: { $slice: -1 },
        // Include other top-level fields needed
        resinScore: 1,
        riskLevel: 1,
        status: 1,
        workerName: 1,
        timestamp: 1,
      }
    ).sort({ timestamp: -1 });

    if (!latestRecord) {
      return res
        .status(404)
        .json({ message: "No analysis records found for this tree" });
    }

    // 4. Return the combined data
    res.status(200).json({
      treeId: tree.treeId,
      historyCount: historyCount,
      latestLog: latestRecord.workflowLog[0] || null,
      // Fallback to top-level fields if workflowLog is empty
      summary: {
        resinScore: latestRecord.resinScore,
        riskLevel: latestRecord.riskLevel,
        status: latestRecord.status,
        workerName: latestRecord.workerName,
        timestamp: latestRecord.timestamp,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const uploadResinImage = async (req, res) => {

  console.log("Received image upload request for resin analysis");
  try {
    const searchId = req.body.recordId || req.body.treeId;
    const imageFile = req.file;

    if (!searchId) {
      return res
        .status(400)
        .json({ message: "No Record ID or Tree ID provided in request body" });
    }

    if (!imageFile) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // 1. Try to find an existing record
    let record = await Resin.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(searchId) ? searchId : null },
        { treeId: searchId },
      ],
    }).sort({ createdAt: -1 });

    // 2. If no record exists, create a new one
    if (!record) {
      console.log(`Creating new resin record for Tree ID: ${searchId}`);

      // We need to find the tree to get the 'block' information required by the schema
      const tree = await Tree.findOne({
        $or: [
          { treeId: searchId },
          { _id: mongoose.Types.ObjectId.isValid(searchId) ? searchId : null },
        ],
      });

      if (!tree) {
        return res
          .status(404)
          .json({ message: "Tree not found. Cannot create resin record." });
      }

      record = new Resin({
        treeId: tree._id, // Use the internal MongoDB ID
        block: tree.block,
        workerName: req.body.workerName || "AI_System_Auto",
        status: "Pending",
      });
    }

    // 3. Prepare AI Request
    const formData = new FormData();
    formData.append("image", imageFile.buffer, {
      filename: imageFile.originalname,
      contentType: imageFile.mimetype,
    });

    let aiResponse;
    try {
      aiResponse = await axios.post("http://127.0.0.1:5001/predict", formData, {
        headers: { ...formData.getHeaders() },
        timeout: 20000,
      });
      console.log("✅ AI Server responded successfully");
    } catch (aiError) {
      if (aiError.response) {
        console.error("AI Server Data:", aiError.response.data);
        return res.status(aiError.response.status).json({
          error: "AI Processing Failed",
          details:
            aiError.response.data.message ||
            "The AI model could not process this image.",
        });
      } else if (aiError.request) {
        return res.status(503).json({
          error: "AI Server Unavailable",
          details: "The AI analysis service is currently offline.",
        });
      } else {
        return res.status(500).json({
          error: "Request Setup Error",
          details: aiError.message,
        });
      }
    }

    // 4. Update the record with AI results
    const { grade, confidence } = aiResponse.data;

    record.originalImageUrl = `data:${
      imageFile.mimetype
    };base64,${imageFile.buffer.toString("base64")}`;
    record.resinScore = parseFloat(confidence);

    // Map AI grade to DB status
    if (grade === "high_resin") record.status = "Ready";
    else if (grade === "medium_resin") record.status = "Medium";
    else record.status = "Not Ready";

    // Update riskLevel based on grade (Optional logic based on your mapping)
    const riskMapping = {
      high_resin: "Low",
      medium_resin: "Moderate",
      no_resin: "High",
    };
    record.riskLevel = riskMapping[grade] || "Pending";

    // 5. Add to Workflow Log
    record.workflowLog.push({
      action: "AI Analysis Completed",
      performedBy: "AI_System",
      notes: `Model detected ${grade} with ${confidence}% confidence.`,
      toStatus: record.status,
      resinScore: record.resinScore,
      riskLevel: record.riskLevel,
      timestamp: new Date(),
    });

    await record.save();
    await record.populate("treeId");

    res.status(200).json({
      message: "Analysis successful",
      ai_prediction: { grade, confidence },
      data: record,
    });
  } catch (err) {
    console.error("Integration Error:", err.message);
    res.status(500).json({
      error: "Analysis failed",
      details: err.message,
    });
  }
};

module.exports = {
  addResinAnalysis,
  getAllResinAnalysis,
  getResinById,
  getResinByTreeId,
  updateResinStatus,
  addWorkflowLog,
  uploadResinImage,
  getLatestWorkflowLogByTreeId,
};
