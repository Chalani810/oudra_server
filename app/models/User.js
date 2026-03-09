// oudra-server/app/models/User.js
// CHANGES FROM GLIMMER:
//  1. role enum updated: "user" → "investor", "fieldworker" added, "admin" → "manager"
//  2. Removed loyaltyPoints (not needed for Oudra)
//  3. address made optional (not needed for all roles)
//  4. Added linkedRecordId to link users → investors/employees collections

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: false,
      unique: true,
      default: () => `UID-${Math.floor(100000 + Math.random() * 900000)}`,
    },
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true },
    phone:     { type: String },
    address: {
      street:     { type: String },
      city:       { type: String },
      postalCode: { type: String },
      country:    { type: String },
    },
    profilePicture: { type: String },

    // CHANGED: roles updated for Oudra system
    role: {
      type: String,
      enum: ["manager", "investor", "fieldworker"],
      default: "fieldworker",
    },

    isActive: { type: Boolean, default: true },

        // ✅ NEW: Forces investor/fieldworker to change their temp password on first login
    mustChangePassword: { type: Boolean, default: false },

    // Links this auth user to the investors OR employees collection
    linkedRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    // Password reset fields
    resetPasswordToken:   { type: String, select: false },
    resetPasswordExpires: { type: Date,   select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);