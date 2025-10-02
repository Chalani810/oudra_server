const express = require("express");
const multer = require("multer");
const { add, getAll,deleteEvent,updateEvent } = require("../controllers/event_controller");
const authMiddleware = require("../middleware/authMiddleware");
const Event = require("../models/Event");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "app/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/add", upload.single("eventImage"), add);

router.get("/", getAll);
router.delete("/:eventId", deleteEvent);
router.put('/:eventId', upload.single('eventImage'), updateEvent);

module.exports = router;
