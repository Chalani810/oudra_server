const express = require("express");
const multer = require("multer");
const {
  addCheckout,
  getAll,
  updateOrderStatus,
  deleteCheckout,
  assignEmployees, 
} = require("../controllers/checkout_controller");
const authMiddleware = require("../middleware/authMiddleware");
const Checkout = require("../models/Checkout");
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "app/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.post("/add", upload.single("slip"), addCheckout);
router.get("/getAll", getAll);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/assign-employees", assignEmployees);
router.delete("/delete/:checkoutId", deleteCheckout);

module.exports = router;
