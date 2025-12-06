const express = require("express");
const router = express.Router();

const {
  addResinAnalysis,
  getAllResinAnalysis,
  getResinById,
  getResinByTreeId,
  updateResinStatus,
  addWorkflowLog
} = require("../controllers/resin_controller");

// Create resin analysis
router.post("/", addResinAnalysis);

// Get all resin records
router.get("/", getAllResinAnalysis);

// Get single resin record by DB ID
router.get("/record/:id", getResinById);

// Get resin analysis list by Tree ID
router.get("/tree/:treeId", getResinByTreeId);

// Update resin status
router.patch("/:id/status", updateResinStatus);

// Add workflow log entry
router.post("/:id/workflow-log", addWorkflowLog);

module.exports = router;