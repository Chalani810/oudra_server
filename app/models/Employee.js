const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    profileImg: {
      type: String,
      required: false,
    },
    availability: {
      type: Boolean,
      default: true,
    },
    occupation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role", 
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Employee", employeeSchema);
