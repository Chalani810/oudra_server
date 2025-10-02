const Feedback = require("../models/Feedback");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

const addFeedback = async (req, res) => {
  try {
    const { orderId, message, rating } = req.body;
    const { id } = req.params;

    const photoUrl = req.file ? `app/uploads/${req.file.filename}` : "";

    if (!orderId || !message || !rating) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const newFeedback = new Feedback({
      userId: id,
      orderId: orderId,
      message,
      rating,
      photoUrl,
      date: new Date(),
    });

    await newFeedback.save();

    res.status(201).json({
      message: "Feedback submitted successfully",
      data: newFeedback,
    });
  } catch (err) {
    console.error("Error in addFeedback:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate([{ path: "userId" }, { path: "orderId" }])
      .sort({ date: -1 });

    const feedbacksWithFullPath = feedbacks.map((feedback) => {
      const result = feedback.toObject();

      if (feedback.photoUrl) {
        try {
          const splitUrl = feedback.photoUrl.split("uploads/");
          if (splitUrl.length > 1) {
            result.photoUrl = `${req.protocol}://${req.get("host")}/uploads/${
              splitUrl[1]
            }`;
          }
        } catch (error) {
          console.error("Error processing photo URL:", error);
        }
      }
      try {
        result.userId.profilePicture = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${feedback.userId.profilePicture}`;
      } catch (error) {
        console.error("Error processing photo URL:", error);
      }

      return result;
    });

    res.status(200).json(feedbacksWithFullPath);
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve feedbacks",
      error: err.message,
    });
  }
};
const getFeedbacksByUser = async (req, res) => {
  try {
    const { id } = req.params;
    const feedbacks = await Feedback.find({ userId: id })
      .populate([{ path: "userId" }, { path: "orderId" }])
      .sort({ date: -1 });

    const feedbacksWithFullPath = feedbacks.map((feedback) => {
      const result = feedback.toObject();

      if (feedback.photoUrl) {
        try {
          const splitUrl = feedback.photoUrl.split("uploads/");
          if (splitUrl.length > 1) {
            result.photoUrl = `${req.protocol}://${req.get("host")}/uploads/${
              splitUrl[1]
            }`;
          }
        } catch (error) {
          console.error("Error processing photo URL:", error);
        }
      }

      return result;
    });

    res.status(200).json(feedbacksWithFullPath);
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve feedbacks",
      error: err.message,
    });
  }
};

const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderId, message, rating } = req.body;

    const existingFeedback = await Feedback.findById(id);
    if (!existingFeedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    let photoUrl = existingFeedback.photoUrl;
    if (req.file) {
      if (existingFeedback.photoUrl) {
        const filePath = path.join(
          __dirname,
          "../..",
          existingFeedback.photoUrl
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      photoUrl = `app/uploads/${req.file.filename}`;
    }

    const updatedFeedback = await Feedback.findByIdAndUpdate(
      id,
      {
        orderId,
        message,
        rating,
        photoUrl,
      },
      { new: true }
    );

    res.status(200).json({
      message: "Feedback updated successfully",
      data: updatedFeedback,
    });
  } catch (err) {
    console.error("Error updating feedback:", err);
    res.status(500).json({
      message: "Failed to update feedback",
      error: err.message,
    });
  }
};

const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    if (feedback.photoUrl) {
      const filePath = path.join(__dirname, "../..", feedback.photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Feedback.findByIdAndDelete(id);

    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete feedback",
      error: err.message,
    });
  }
};

module.exports = {
  addFeedback,
  getAllFeedbacks,
  updateFeedback,
  deleteFeedback,
  getFeedbacksByUser,
};
