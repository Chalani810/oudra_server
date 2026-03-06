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
  getTaskStats,
} = require("../controllers/taskController");

const router = express.Router();

// ── Non-wildcard routes first ──────────────────────────────────────────────
router.post("/",      createTask);
router.get("/",       getAllTasks);
router.get("/stats",  getTaskStats);

// Mobile app: get all tasks assigned to a specific employee
// MUST be before /:id or Express will match "employee" as an id
router.get("/employee/:employeeId", getTasksForEmployee);

// ── Wildcard /:id routes last ──────────────────────────────────────────────

router.get("/:id",         getTaskById);
router.put("/:id",         updateTask);
router.delete("/:id",      deleteTask);
router.put("/:id/status",  updateTaskStatus);

module.exports = router;
