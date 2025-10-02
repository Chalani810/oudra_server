const express = require("express");
const multer = require("multer");
const {
  addEmployee,
  deleteEmployee,
  getAllEmployees,
  updateEmployee,
} = require("../controllers/employee_controller");
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

router.post("/", upload.single("profileImg"), addEmployee);
router.get("/", getAllEmployees);
router.put("/:id", upload.single("profileImg"), updateEmployee);
router.delete("/:id", deleteEmployee);

module.exports = router;