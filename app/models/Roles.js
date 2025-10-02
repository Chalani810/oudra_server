const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: [
        "Setup Supervisor",
        "Setup Assistant",
        "Sales & Marketing Executive",
        "Customer Support Executive"
      ],
    },
    basicSalary: {
      type: Number,
      required: true,
    },
    eventBonus: {
      type: Number,
      required: true,
    },
    feedbackBonus: {
      type: Number,
      required: true,
    },

  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Role", roleSchema);
