const Event = require("../models/Event");
const path = require("path");
const fs = require("fs");

const add = async (req, res) => {
  try {
    const { title, description, visibility } = req.body;
    const photoUrl = req.file ? `app/uploads/${req.file.filename}` : "";

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Title and Description are required" });
    }

    const newEvent = new Event({ title, description, photoUrl, visibility });
    await newEvent.save();

    res.status(201).json({ message: "Event created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const events = await Event.find();

    const eventsWithFullPath = events.map((event) => {
      return {
        ...event.toObject(),
        photoUrl: `${req.protocol}://${req.get("host")}/uploads/${
          event.photoUrl.split("uploads/")[1]
        }`,
      };
    });

    res.status(200).json(eventsWithFullPath);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to retrieve events", error: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.photoUrl) {
      const photoPath = path.join(__dirname, "../..", event.photoUrl);

      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await event.deleteOne();

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete event", error: err.message });
  }
};
const updateEvent = async (req, res) => {
  try {
    const { title, description, visibility } = req.body;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (req.file) {
      const newPhotoUrl = `app/uploads/${req.file.filename}`;

      if (event.photoUrl) {
        const oldPhotoPath = path.join(__dirname, "../..", event.photoUrl);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }

      event.photoUrl = newPhotoUrl;
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.visibility = visibility !== undefined ? visibility : event.visibility;

    await event.save();

    res.status(200).json({ message: "Event updated successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update event", error: err.message });
  }
};

module.exports = {
  add,
  getAll,
  deleteEvent,
  updateEvent,
};
