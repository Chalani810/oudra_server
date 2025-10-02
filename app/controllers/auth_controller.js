const User = require("../models/User");
const Checkout = require("../models/Checkout");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Helper function to get paginated users
const getPaginatedUsers = async (
  page = 1,
  limit = 10,
  search = "",
  baseQuery = {}
) => {
  const skip = (page - 1) * limit;

  const query = { ...baseQuery };
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { userId: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).select("-password").skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
};

const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      street,
      city,
      postalCode,
      country,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Check for existing email or phone
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      let message = "User already exists";
      if (existingUser.email === email) {
        message =
          "It looks like you're already registered. Please sign in with your credentials.";
      } else if (existingUser.phone === phone) {
        message =
          "It looks like you're already registered. Please sign in with your credentials.";
      }
      return res.status(400).json({ message });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      address: { street, city, postalCode, country },
      profilePicture: req.file ? req.file.filename : null,
      isActive: true,
      loyaltyPoints: 0,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userId: user.userId,
        isActive: user.isActive,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Combined and improved getAllUsers function
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const baseQuery = { role: { $ne: "admin" } };

    // If no pagination parameters are provided, return all users (backwards compatible)
    if (!page && !limit) {
      const users = await User.find(baseQuery).select("-password");
      return res.json(users);
    }

    // Otherwise, return paginated results
    const result = await getPaginatedUsers(
      parseInt(page),
      parseInt(limit),
      search,
      baseQuery
    );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const usersWithStatus = await Promise.all(
      result.users.map(async (user) => {
        // Checking if account is less than 3 months old
        const isNewUser = user.createdAt >= threeMonthsAgo;

        // Only check for checkouts if not a new user
        let isActive = isNewUser;
        if (!isNewUser) {
          const recentCheckout = await Checkout.findOne({
            userId: user._id,
            eventDate: { $gte: threeMonthsAgo },
          });
          isActive = !!recentCheckout;
        }

        return {
          ...user.toObject(),
          isActive,
          isNewUser, 
        };
      })
    );

    res.json({
      users: usersWithStatus,
      pagination: {
        total: result.total,
        pages: result.pages,
        currentPage: result.currentPage,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateLoyaltyPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    if (typeof points !== "number") {
      return res.status(400).json({ message: "Invalid points value" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.loyaltyPoints = points;
    await user.save();

    res.json({
      message: "Loyalty points updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        photoUrl: `${req.protocol}://${req.get("host")}/uploads/${
          user.profilePicture
        }`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//Forgot password and reset password functions
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message:
          "We’ve sent a password reset link to the email provided.Please check your inbox or spam folder",
      });
    }

    // Generate the token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // Password reset token valid for 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: "Password Reset Request",
      text: `You are receiving this because you have requested a password reset.\n\n
        Please click on the following link, or paste it into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message:
        "We’ve sent a password reset link to the email provided.Please check your inbox or spam folder",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: "Your password has been updated successfully!",
      text: `Hello,\n\n
        This is a confirmation that the password for your account ${user.email} has just been changed.\n`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password has been updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.file) {
      // Delete old profile picture if it exists
      if (currentUser.profilePicture) {
        const oldImagePath = path.join(
          __dirname,
          "../../uploads",
          currentUser.profilePicture
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updates.profilePicture = req.file.filename;
    }

    if (
      updates.street ||
      updates.city ||
      updates.postalCode ||
      updates.country
    ) {
      updates.address = {
        street: updates.street || currentUser.address.street,
        city: updates.city || currentUser.address.city,
        postalCode: updates.postalCode || currentUser.address.postalCode,
        country: updates.country || currentUser.address.country,
      };
      delete updates.street;
      delete updates.city;
      delete updates.postalCode;
      delete updates.country;
    }

    if (updates.password) {
      return res
        .status(400)
        .json({ message: "Use the change password route to update password" });
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.userId; // ID of the user making the request

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete profile picture if exists
    if (user.profilePicture) {
      const imagePath = path.join(
        __dirname,
        "../../uploads",
        user.profilePicture
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await User.findByIdAndDelete(id);

    // Return different messages based on who is deleting
    if (id === requestingUserId) {
      return res.json({
        message: "User deleted successfully",
        isSelfDeletion: true,
      });
    } else {
      return res.json({
        message: "User deleted successfully",
        isSelfDeletion: false,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkExistingUser = async (req, res) => {
  try {
    const { email, phone } = req.query;

    const existingUser = await User.findOne({
      $or: [{ email: email }, { phone: phone }],
    });

    if (existingUser) {
      // Check if both email and phone are provided
      let message = "User with this ";
      if (existingUser.email === email && existingUser.phone === phone) {
        message += "email and phone number already exists";
      } else if (existingUser.email === email) {
        message += "email already exists";
      } else {
        message += "phone number already exists";
      }
      return res.status(200).json({ exists: true, message });
    }

    res.status(200).json({ exists: false });
  } catch (err) {
    console.error("Error checking existing user:", err);
    res.status(500).json({
      error: "Error checking user existence",
      details: err.message,
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  checkExistingUser,
  toggleUserStatus,
  updateLoyaltyPoints,
  getPaginatedUsers,
  requestPasswordReset,
  resetPassword,
};
