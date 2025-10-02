const Contact = require("../models/Contact");

// Add Contact Message
const addContactMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message, services } = req.body;

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({
        message: "First Name, Last Name, Email, and Message are required",
      });
    }

    const contact = new Contact({
      firstName,
      lastName,
      email,
      phone,
      message,
      services,
    });

    await contact.save();

    res.status(201).json({
      message: "Contact message submitted successfully",
      data: contact,
    });
  } catch (err) {
    console.error("Error in addContactMessage:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Contact Messages
const getAllContactMessages = async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });

    res.status(200).json({ data: messages });
  } catch (err) {
    console.error("Error in getAllContactMessages:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addContactMessage,
  getAllContactMessages,
};
