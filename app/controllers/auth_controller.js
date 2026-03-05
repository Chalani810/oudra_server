// oudra-server/app/controllers/auth_controller.js
const User     = require("../models/User");
const Employee = require("../models/Employee");
const Investor = require("../models/Investor");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const nodemailer = require("nodemailer");

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Generate a secure random temporary password: 8 chars alphanum
const generateTempPassword = () => {
  return crypto.randomBytes(4).toString("hex"); // e.g. "a3f7c2d1"
};

// Reusable nodemailer transporter
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

// ─── 1. LOGIN ─────────────────────────────────────────────────────────────────
// Works for all 3 roles. Platform validation enforced here.
// Body: { email, password, platform }  ("web" | "mobile")
const login = async (req, res) => {
  try {
    const { email, password, platform } = req.body;

    // ── Validation ──────────────────────────────────────────────
    if (!email || !password || !platform) {
      return res.status(400).json({
        message: "Email, password, and platform are required.",
      });
    }

    if (!["web", "mobile"].includes(platform)) {
      return res.status(400).json({ message: "Invalid platform. Must be 'web' or 'mobile'." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // ── Find user ────────────────────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // ── Account active check ─────────────────────────────────────
    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been deactivated. Please contact the manager.",
      });
    }

    // ── Password check ────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // ── Platform vs Role enforcement ──────────────────────────────
    // Rule: fieldworkers → mobile only | manager & investor → web only
    if (user.role === "fieldworker" && platform !== "mobile") {
      return res.status(403).json({
        message: "Field workers must log in via the mobile app.",
      });
    }
    if ((user.role === "manager" || user.role === "investor") && platform !== "web") {
      return res.status(403).json({
        message: "Managers and investors must log in via the web app.",
      });
    }

    // ── Sign JWT ──────────────────────────────────────────────────
    const token = jwt.sign(
      {
        userId:    user._id,
        role:      user.role,
        email:     user.email,
        platform:  platform,
        firstName: user.firstName,
        lastName:  user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      user: {
        id:             user._id,
        firstName:      user.firstName,
        lastName:       user.lastName,
        email:          user.email,
        role:           user.role,
        linkedRecordId: user.linkedRecordId,
        photoUrl: user.profilePicture
          ? `${req.protocol}://${req.get("host")}/uploads/${user.profilePicture}`
          : null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── 2. CREATE MANAGED ACCOUNT ───────────────────────────────────────────────
// Only managers can call this endpoint (protected by authMiddleware + roleMiddleware("manager"))
// Creates a User record linked to an existing Employee OR Investor record.
// Body: { linkedRecordId, role }  role must be "investor" or "fieldworker"
// The email is pulled from the linked record (Employee / Investor)
const createManagedAccount = async (req, res) => {
  try {
    const { linkedRecordId, role } = req.body;

    if (!linkedRecordId || !role) {
      return res.status(400).json({ message: "linkedRecordId and role are required." });
    }

    if (!["investor", "fieldworker"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'investor' or 'fieldworker'." });
    }

    // ── Fetch the linked record ───────────────────────────────────────────────
    let linkedRecord;
    if (role === "fieldworker") {
      linkedRecord = await Employee.findById(linkedRecordId);
      if (!linkedRecord) {
        return res.status(404).json({ message: "Employee record not found." });
      }
    } else {
      linkedRecord = await Investor.findById(linkedRecordId);
      if (!linkedRecord) {
        return res.status(404).json({ message: "Investor record not found." });
      }
    }

    // ── Check if login account already exists ─────────────────────────────────
    const existingUser = await User.findOne({ email: linkedRecord.email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        message: "A login account already exists for this email address.",
      });
    }

    // ── Split name into first/last ────────────────────────────────────────────
    const nameParts = (linkedRecord.name || "").trim().split(" ");
    const firstName = nameParts[0] || linkedRecord.name;
    const lastName  = nameParts.slice(1).join(" ") || "-";

    // ── Generate temp password ────────────────────────────────────────────────
    const tempPassword = generateTempPassword();

    // ── Create user ───────────────────────────────────────────────────────────
    const newUser = new User({
      firstName,
      lastName,
      email:          linkedRecord.email.toLowerCase().trim(),
      password:       tempPassword,       // pre-save hook hashes it
      phone:          linkedRecord.phone  || "",
      role,
      linkedRecordId: linkedRecord._id,
      isActive:       true,
    });

    await newUser.save();

    // ── Send credentials email (non-critical — account is created regardless) ─
    try {
      const platformText = role === "fieldworker" ? "mobile app" : "web app";
      const transporter  = createTransporter();

      await transporter.sendMail({
        to:      newUser.email,
        from:    process.env.EMAIL_FROM,
        subject: "Your Oudra Login Credentials",
        html: `
          <p>Dear ${linkedRecord.name},</p>
          <p>Your login account has been created for the Oudra ${platformText}.</p>
          <p><strong>Email:</strong> ${newUser.email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>Please log in and change your password using the 
          <strong>Forgot Password</strong> option.</p>
          <p>— Oudra Management Team</p>
        `,
      });
      console.log(`✅ Credentials email sent to ${newUser.email}`);
    } catch (emailErr) {
      // Email failed but account was created successfully — log and continue
      console.warn(`⚠️ Email failed (account still created):`, emailErr.message);
    }

    // ── Return success with credentials ──────────────────────────────────────
    return res.status(201).json({
      message: `Login account created successfully for ${linkedRecord.name}.`,
      credentials: {
        email:        newUser.email,
        tempPassword, // Returned so manager can share manually if email fails
        role,
      },
    });
  } catch (err) {
    console.error("createManagedAccount error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── 3. GET CURRENT USER ─────────────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 4. FORGOT PASSWORD ──────────────────────────────────────────────────────
// Sends a reset link to the user's registered email
// Works for all roles (manager resets via web, fieldworker via mobile deep link)
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Always return the same message whether found or not (security)
    const genericMessage =
      "If this email is registered, a password reset link will be sent shortly.";

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+resetPasswordToken +resetPasswordExpires"
    );

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    if (!user.isActive) {
      return res.status(200).json({ message: genericMessage });
    }

    // Generate reset token
    const resetToken       = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken   = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Build reset URL based on role/platform
    const clientUrl =
      user.role === "fieldworker"
        ? process.env.MOBILE_APP_SCHEME || process.env.CLIENT_URL // deep link for mobile
        : process.env.CLIENT_URL;

    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const transporter = createTransporter();
    await transporter.sendMail({
      to:      user.email,
      from:    process.env.EMAIL_FROM,
      subject: "Oudra – Password Reset Request",
      html: `
        <p>Dear ${user.firstName},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>— Oudra Management Team</p>
      `,
    });

    return res.status(200).json({ message: genericMessage });
  } catch (err) {
    console.error("requestPasswordReset error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── 5. RESET PASSWORD ───────────────────────────────────────────────────────
// Body: { token, password, confirmPassword }
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Token, password, and confirmPassword are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res
        .status(400)
        .json({ message: "Password reset link is invalid or has expired." });
    }

    user.password             = password; // pre-save hook hashes it
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Confirmation email
    const transporter = createTransporter();
    await transporter.sendMail({
      to:      user.email,
      from:    process.env.EMAIL_FROM,
      subject: "Oudra – Password Updated Successfully",
      html: `
        <p>Dear ${user.firstName},</p>
        <p>Your Oudra account password has been updated successfully.</p>
        <p>If you did not make this change, contact your manager immediately.</p>
        <p>— Oudra Management Team</p>
      `,
    });

    return res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── 6. GET ALL USERS (Manager only) ─────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName:  { $regex: search, $options: "i" } },
        { lastName:   { $regex: search, $options: "i" } },
        { email:      { $regex: search, $options: "i" } },
        { userId:     { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query).select("-password").skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return res.json({
      users,
      pagination: {
        total,
        pages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── 7. TOGGLE USER STATUS (Manager only) ────────────────────────────────────
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isActive = !user.isActive;
    await user.save();

    return res.json({
      message: `Account ${user.isActive ? "activated" : "deactivated"} successfully.`,
      user: { id: user._id, email: user.email, isActive: user.isActive },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  createManagedAccount,
  getCurrentUser,
  getAllUsers,
  toggleUserStatus,
  requestPasswordReset,
  resetPassword,
};