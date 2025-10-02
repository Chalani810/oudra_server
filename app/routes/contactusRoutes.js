const express = require("express");
const {
  addContactMessage,
  getAllContactMessages,
} = require("../controllers/contactController");

const router = express.Router();

// POST - Submit contact form
router.post("/", addContactMessage);

// GET - Get all contact form submissions
router.get("/", getAllContactMessages);

module.exports = router;
