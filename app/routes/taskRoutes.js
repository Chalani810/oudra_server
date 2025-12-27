// oudra-server/app/routes/taskRoutes.js
const express = require("express");
const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksForEmployee,
  updateTaskStatus,
  getTaskStats
} = require("../controllers/taskController");

const router = express.Router();

// Public routes (will add auth middleware later)
router.post("/", createTask);
router.get("/", getAllTasks);
router.get("/stats", getTaskStats);
router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

// Mobile app specific routes
router.get("/employee/:employeeId", getTasksForEmployee);
router.put("/:id/status", updateTaskStatus);

module.exports = router;