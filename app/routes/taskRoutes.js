// oudra-server/app/routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksForEmployee,
  updateTaskStatus,
  getTaskStats,
  createSensorTasks,
  getSensorTasksForTree,
} = require("../controllers/taskController");

// ── Standard task routes ───────────────────────────────────────────────────────
router.post("/", createTask);
router.get("/", getAllTasks);
router.get("/stats", getTaskStats);
router.get("/employee/:employeeId", getTasksForEmployee);

// ── System-generated sensor task routes ───────────────────────────────────────
// POST /api/tasks/sensor-tasks  — called from mobile after sensor sync
router.post("/sensor-tasks", createSensorTasks);
// GET  /api/tasks/sensor-tasks/:treeId  — get open system tasks for a tree
router.get("/sensor-tasks/:treeId", getSensorTasksForTree);

// ── Single task routes (keep :id last to avoid catching named routes above) ────
router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.put("/:id/status", updateTaskStatus);

module.exports = router;