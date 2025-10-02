const express = require("express");
const multer = require("multer");
const {
  addFeedback,
  getAllFeedbacks,
  updateFeedback,
  deleteFeedback,
  getFeedbacksByUser,
} = require("../controllers/feedback_controller");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "app/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^image/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.get("/", getAllFeedbacks);
router.post("/:id", upload.single("photo"), addFeedback);
router.get("/:id", getFeedbacksByUser);
router.put("/:id", upload.single("photo"), updateFeedback);
router.delete("/:id", deleteFeedback);

module.exports = router;