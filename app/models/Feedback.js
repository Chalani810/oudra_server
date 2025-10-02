const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Checkout",
    required: true
  },
  message: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  photoUrl: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  }
});

module.exports = mongoose.model("Feedback", FeedbackSchema);