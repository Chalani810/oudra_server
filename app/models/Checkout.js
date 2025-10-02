const mongoose = require("mongoose");

const CheckoutSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    telephone: { type: String },
    mobile: { type: String, required: true },
    contactMethod: {
      type: String,
      enum: ["call", "message", "email"],
      default: "call",
      required: true,
    },
    guestCount: {
      type: String,
      enum: ["less than 100", "100-200", "more than 200"],
      default: "less than 100",
    },
    eventDate: {
      type: Date,
      required: true, // Make required if event date is mandatory
    },
    comment: { type: String },
    cartTotal: { type: Number, required: true },
    advancePayment: { type: Number, required: true },
    duepayment: { type: Number, required: true },
    slipUrl: { type: String }, // file path or filename
    slipPreview: { type: String }, // file path or filename for preview
    status: { type: String, default: "pending" }, // file path or filename for preview
    cart: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Cart", 
      required: true,
    },
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee", 
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Checkout", CheckoutSchema);
