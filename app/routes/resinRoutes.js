const express = require("express");
const router = express.Router();


const {
  addResinAnalysis,
  getAllResinAnalysis,
  getResinById,
  getResinByTreeId,
  updateResinStatus,
  addWorkflowLog,
  uploadResinImage, // This now contains the AI logic
  getLatestWorkflowLogByTreeId,
  deleteResinAnalysis,

} = require("../controllers/resin_controller");


// 1. Create initial record (POST /resin/)
router.post("/", addResinAnalysis);

const multer = require('multer');
// Use memoryStorage so imageFile.buffer is available for your AI server call
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// The string 'file' MUST match your React Native formData.append("file", ...)
router.post('/upload-image', upload.single('file'), uploadResinImage);

// --- DATA RETRIEVAL ---

// Get all records (GET /resin/)
router.get("/", getAllResinAnalysis);

// Get by DB ID (GET /resin/record/:id)
router.get("/record/:id", getResinById);

// Get by Tree ID (GET /resin/tree/:treeId)
router.get("/tree/:treeId", getResinByTreeId);

router.get('/tree/:treeId/latest-workflow', getLatestWorkflowLogByTreeId);


// Update status manually (PATCH /resin/:id/status)
router.patch("/:id/status", updateResinStatus);

// Add manual log entry (POST /resin/:id/workflow-log)
router.post("/:id/workflow-log", addWorkflowLog);

router.delete('/:id', deleteResinAnalysis);

module.exports = router;