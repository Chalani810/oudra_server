// oudra-server/app/routes/authRoutes.js
// CHANGES FROM GLIMMER:
//  1. Removed /register route (no public sign-up)
//  2. Added POST /create-account route (manager creates accounts for others)
//  3. Imported roleMiddleware and platformMiddleware from updated middleware file

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

const {
  login,
  createManagedAccount,
  getCurrentUser,
  getAllUsers,
  toggleUserStatus,
  requestPasswordReset,
  resetPassword,
  updateInvestorProfile,
} = require("../controllers/auth_controller");

const authMiddleware = require("../middleware/authMiddleware");
const platformMiddleware = authMiddleware.platformMiddleware;
const roleMiddleware = authMiddleware.roleMiddleware;
const router = express.Router();

// Multer setup (kept for profile picture uploads if needed later)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "app/uploads/";
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ─── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
// Handles login for all roles. Platform is sent in body: "web" or "mobile"
router.post("/login", login);

// Forgot & Reset password (web and mobile both use these)
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password",  resetPassword);

// ─── PROTECTED ROUTES ──────────────────────────────────────────────────────────
// Apply auth middleware to all routes below
router.use(authMiddleware);

// Get current logged-in user profile
router.get("/me", getCurrentUser);
router.put("/update-profile", updateInvestorProfile);

// Create a login account for an investor or field worker
// Only managers (web) can do this
router.post(
  "/create-account",
  platformMiddleware("web"),
  roleMiddleware("manager"),
  createManagedAccount
);

// Get all users list (manager only, web only)
router.get(
  "/users",
  platformMiddleware("web"),
  roleMiddleware("manager"),
  getAllUsers
);

// Toggle user active/inactive (manager only)
router.patch(
  "/users/:id/toggle-status",
  platformMiddleware("web"),
  roleMiddleware("manager"),
  toggleUserStatus
);



module.exports = router;