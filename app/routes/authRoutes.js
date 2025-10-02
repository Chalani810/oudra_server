const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  register,
  login,
  getCurrentUser,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  checkExistingUser,
  toggleUserStatus,
  updateLoyaltyPoints,
  requestPasswordReset,
  resetPassword
} = require("../controllers/auth_controller");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const uploadPath = path.join(__dirname, "../../");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "app/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/register", upload.single("profilePicture"), register);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);

// Public routes
router.get("/check-user", checkExistingUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Protected routes (require authentication)
router.use(authMiddleware);

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", upload.single("profilePicture"), updateUser);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/toggle-status", toggleUserStatus);
router.patch("/users/:id/loyalty-points", updateLoyaltyPoints);

module.exports = router;