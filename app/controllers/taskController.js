// oudra-server/app/controllers/taskController.js
const Task = require("../models/Task");
const Employee = require("../models/Employee");
const Tree = require("../models/TreeModel");
const User = require("../models/User");

// Create new task
const createTask = async (req, res) => {
  try {
    console.log("📝 Task creation request received:", req.body);
    
    let {
      title,
      description,
      taskType,
      priority,
      assignedTo,
      block,
      trees,
      specificTree,
      dueDate,
      notes
    } = req.body;

    console.log("🔍 Validating required fields...");
    console.log("Title:", title);
    console.log("assignedTo:", assignedTo);
    console.log("block:", block);
    console.log("dueDate:", dueDate);

    // Validate required fields
    if (!title || !assignedTo || !block || !dueDate) {
      console.error("❌ Missing required fields:", {
        title: !title,
        assignedTo: !assignedTo,
        block: !block,
        dueDate: !dueDate
      });
      
      return res.status(400).json({
        success: false,
        message: "Title, assignedTo, block, and dueDate are required"
      });
    }

    console.log("🔍 Validating employee:", assignedTo);
    // Validate assigned employee exists
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
      console.error("❌ Employee not found:", assignedTo);
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }
    console.log("✅ Employee found:", employee.name);

    // If no specific trees are selected, get ALL trees from the selected block
    if ((!trees || trees.length === 0) && !specificTree) {
      console.log("🌳 No specific trees selected. Getting ALL trees from block:", block);
      
      // Normalize block name for comparison (handle Block-A, Block A, etc.)
      const normalizeBlock = (blockName) => {
        if (!blockName) return "";
        return blockName.toString()
          .toUpperCase()
          .replace(/\s+/g, '')
          .replace(/-/g, '')
          .replace(/^BLOCK/, '');
      };
      
      const normalizedBlock = normalizeBlock(block);
      console.log("🔍 Looking for trees with normalized block:", normalizedBlock);
      
      // Get all trees and filter by normalized block name
      const allTreesInDatabase = await Tree.find({});
      const allTreesInBlock = allTreesInDatabase.filter(tree => {
        const treeBlock = tree.block || "";
        const normalizedTreeBlock = normalizeBlock(treeBlock);
        return normalizedTreeBlock === normalizedBlock;
      });
      
      if (allTreesInBlock.length > 0) {
        trees = allTreesInBlock.map(tree => tree._id);
        console.log(`✅ Added ${trees.length} trees from ${block}`);
      } else {
        console.log(`⚠️ No trees found in ${block}. Task will have empty trees array.`);
        trees = [];
      }
    }

    // Validate trees if provided
    if (trees && trees.length > 0) {
      console.log("🔍 Validating trees:", trees);
      const validTrees = await Tree.find({ _id: { $in: trees } });
      if (validTrees.length !== trees.length) {
        console.error("❌ Some trees not found. Valid:", validTrees.length, "Requested:", trees.length);
        return res.status(400).json({
          success: false,
          message: "One or more trees not found"
        });
      }
      console.log("✅ Trees validated:", validTrees.length);
    }

    // Validate specific tree if provided
    if (specificTree) {
      console.log("🔍 Validating specific tree:", specificTree);
      const tree = await Tree.findById(specificTree);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: "Specific tree not found"
        });
      }
      console.log("✅ Specific tree found:", tree.treeId);
    }

    console.log("🚀 Creating task...");
    // Create task
    const task = new Task({
      title,
      description: description || "",
      taskType: taskType || "inspection",
      priority: priority || "medium",
      assignedTo,
      assignedBy: null,
      block,
      trees: trees || [],
      specificTree: specificTree || null,
      dueDate: new Date(dueDate),
      notes: notes || "",
      assignedAt: new Date(),
      status: "assigned"
    });

    await task.save();
    console.log("✅ Task created with ID:", task.taskId);

    // Populate response data
    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email phone empId")
      .populate("trees", "treeId nfcTagId healthStatus")
      .populate("specificTree", "treeId nfcTagId block");

    console.log("📤 Sending response...");
    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask
    });
    
  } catch (error) {
    console.error("❌ Error creating task:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error creating task",
      error: error.message
    });
  }
};

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const {
      status,
      assignedTo,
      block,
      priority,
      taskType,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    if (block) query.block = block;
    if (priority) query.priority = priority;
    if (taskType) query.taskType = taskType;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { taskId: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate("assignedTo", "name email phone empId")
        .populate("trees", "treeId nfcTagId")
        .populate("specificTree", "treeId nfcTagId block")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tasks",
      error: error.message
    });
  }
};

// Get task by ID
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email phone empId profileImg")
      .populate("assignedBy", "firstName lastName email")
      .populate("trees", "treeId nfcTagId healthStatus lifecycleStatus block")
      .populate("specificTree", "treeId nfcTagId healthStatus lifecycleStatus block gps");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching task",
      error: error.message
    });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.taskId || updates.assignedBy) {
      delete updates.taskId;
      delete updates.assignedBy;
    }

    const currentTask = await Task.findById(id);
    
    if (currentTask && updates.block && currentTask.block !== updates.block) {
      console.log(`🔄 Block changed from ${currentTask.block} to ${updates.block}. Clearing trees.`);
      updates.trees = [];
      updates.specificTree = null;
      console.log(`✅ Cleared tree selections for block change`);
    }

    console.log(`📝 Updating task ${id} with:`, updates);
    
    const task = await Task.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name email phone empId")
      .populate("trees", "treeId nfcTagId")
      .populate("specificTree", "treeId nfcTagId block");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      data: task
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({
      success: false,
      message: "Error updating task",
      error: error.message
    });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    res.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting task",
      error: error.message
    });
  }
};

// Getting tasks for specific employee (for mobile app)
const getTasksForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status } = req.query;

    const query = { assignedTo: employeeId };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate("trees", "treeId nfcTagId block gps healthStatus")
      .populate("specificTree", "treeId nfcTagId block gps")
      .sort({ priority: -1, dueDate: 1 })
      .lean();

    await Task.updateMany(
      { _id: { $in: tasks.map(t => t._id) }, mobileAppViewed: false },
      { $set: { mobileAppViewed: true, lastSyncAt: new Date() } }
    );

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error("Error fetching employee tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employee tasks",
      error: error.message
    });
  }
};

// Updating task status (for mobile app)
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, fieldWorkerNotes, completionNotes } = req.body;

    const validStatuses = ["in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const updateData = { status };
    
    if (status === "completed") {
      updateData.completedAt = new Date();
      updateData.completionNotes = completionNotes || "Task completed";
    }
    
    if (fieldWorkerNotes) {
      updateData.fieldWorkerNotes = fieldWorkerNotes;
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name email phone empId")
      .populate("trees", "treeId nfcTagId");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    res.json({
      success: true,
      message: `Task marked as ${status}`,
      data: task
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating task status",
      error: error.message
    });
  }
};

// Get task statistics
const getTaskStats = async (req, res) => {
  try {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$count" },
          byStatus: { $push: { status: "$_id", count: "$count" } }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          byStatus: 1
        }
      }
    ]);

    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      }
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overdueTasks = await Task.countDocuments({
      dueDate: { $lt: today },
      status: { $nin: ["completed", "cancelled"] }
    });

    res.json({
      success: true,
      data: {
        summary: stats[0] || { total: 0, byStatus: [] },
        byPriority: priorityStats,
        overdue: overdueTasks
      }
    });
  } catch (error) {
    console.error("Error fetching task stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching task statistics",
      error: error.message
    });
  }
};

// ============================================================
// SYSTEM-GENERATED SENSOR TASKS
// ============================================================

// Sensor threshold rules — one task rule per parameter per severity level
const SENSOR_TASK_RULES = {
  temperature: {
    Critical: {
      title: "🌡️ Critical Temperature Alert",
      taskType: "inspection",
      priority: "urgent",
      description: "Sensor detected critical temperature levels. Immediate inspection required to assess tree health and take corrective action.\n\nChecklist:\n1. Inspect tree for heat/frost stress symptoms\n2. Check surrounding shade or frost protection\n3. Record current temperature and time\n4. Apply emergency treatment if required\n5. Update tree health status",
    },
    Warning: {
      title: "🌡️ Temperature Warning",
      taskType: "inspection",
      priority: "high",
      description: "Sensor detected abnormal temperature levels. Inspection recommended to monitor tree condition.\n\nChecklist:\n1. Inspect tree for stress symptoms\n2. Monitor temperature over next 24 hours\n3. Record observations",
    },
  },
  humidity: {
    Critical: {
      title: "💧 Critical Humidity Alert",
      taskType: "inspection",
      priority: "urgent",
      description: "Sensor detected critical humidity levels that may cause fungal disease or drought stress. Immediate action required.\n\nChecklist:\n1. Inspect tree for disease or drought symptoms\n2. Check irrigation or drainage systems\n3. Record humidity reading\n4. Apply appropriate treatment\n5. Update tree health status",
    },
    Warning: {
      title: "💧 Humidity Warning",
      taskType: "inspection",
      priority: "high",
      description: "Humidity levels are outside the optimal range. Monitor tree closely.\n\nChecklist:\n1. Inspect tree for early stress signs\n2. Check irrigation/drainage\n3. Record observations",
    },
  },
  soilMoisture: {
    Critical: {
      title: "🌱 Critical Soil Moisture Alert",
      taskType: "fertilizing",
      priority: "urgent",
      description: "Sensor detected critical soil moisture levels. Tree may be suffering from drought or waterlogging. Immediate intervention required.\n\nChecklist:\n1. Check soil moisture manually to confirm reading\n2. Inspect roots for drought or rot symptoms\n3. Adjust irrigation schedule immediately\n4. Record soil moisture level and actions taken\n5. Update tree health status",
    },
    Warning: {
      title: "🌱 Soil Moisture Warning",
      taskType: "fertilizing",
      priority: "high",
      description: "Soil moisture is outside the optimal range. Adjust irrigation if needed.\n\nChecklist:\n1. Check soil moisture manually\n2. Adjust irrigation if necessary\n3. Record observations",
    },
  },
  soilPh: {
    Critical: {
      title: "⚗️ Critical Soil pH Alert",
      taskType: "special treatments",
      priority: "urgent",
      description: "Sensor detected critical soil pH levels. Nutrient uptake may be severely impaired. Immediate soil treatment required.\n\nChecklist:\n1. Confirm pH with a manual soil test\n2. Apply lime (if pH too low) or sulfur (if pH too high)\n3. Inspect tree for nutrient deficiency symptoms\n4. Record pH value and treatment applied\n5. Schedule follow-up pH test in 2 weeks",
    },
    Warning: {
      title: "⚗️ Soil pH Warning",
      taskType: "special treatments",
      priority: "high",
      description: "Soil pH is slightly outside optimal range. Monitor and consider soil amendment.\n\nChecklist:\n1. Confirm pH with a manual soil test\n2. Consider soil amendment\n3. Record observations",
    },
  },
};

// Helper: determine sensor status level from raw value
function getSensorStatusLevel(value, type) {
  if (value === null || value === undefined) return "Unknown";
  const num = parseFloat(value);
  if (isNaN(num)) return "Unknown";

  switch (type) {
    case "temperature":
      if (num < 20 || num > 45) return "Critical";
      if ((num >= 20 && num < 25) || (num > 40 && num <= 45)) return "Warning";
      return "Normal";
    case "humidity":
      if (num < 20 || num > 80) return "Critical";
      if ((num >= 20 && num < 40) || (num > 65 && num <= 80)) return "Warning";
      return "Normal";
    case "soilMoisture":
      if (num < 40 || num > 85) return "Critical";
      if ((num >= 40 && num < 50) || (num > 75 && num <= 85)) return "Warning";
      return "Normal";
    case "soilPh":
      if (num < 3.8 || num > 6.5) return "Critical";
      if ((num >= 3.8 && num < 4.5) || (num > 6.0 && num <= 6.5)) return "Warning";
      return "Normal";
    default:
      return "Unknown";
  }
}

// POST /api/tasks/sensor-tasks
// Creates tasks automatically based on sensor readings from the mobile app.
// Called after a successful sensor sync when abnormal values are detected.
const createSensorTasks = async (req, res) => {
  try {
    const { treeId, treeObjectId, assignedTo, block, sensorReading } = req.body;

    if (!treeId || !assignedTo || !block || !sensorReading) {
      return res.status(400).json({
        success: false,
        message: "treeId, assignedTo, block, and sensorReading are required",
      });
    }

    // Validate the employee exists
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Resolve tree ObjectId from treeId string if not passed directly
    let treeRef = treeObjectId || null;
    if (!treeRef) {
      const treeDoc = await Tree.findOne({ treeId });
      if (treeDoc) treeRef = treeDoc._id;
    }

    const SENSOR_PARAMS = ["temperature", "humidity", "soilMoisture", "soilPh"];
    const createdTasks = [];
    const skippedTasks = [];

    for (const param of SENSOR_PARAMS) {
      const value = sensorReading[param];
      const statusLevel = getSensorStatusLevel(value, param);

      // Only create tasks for Critical or Warning readings
      if (statusLevel === "Normal" || statusLevel === "Unknown") continue;

      const rule = SENSOR_TASK_RULES[param]?.[statusLevel];
      if (!rule) continue;

      // De-duplicate: skip if an identical open task already exists for this tree
      const existing = await Task.findOne({
        title: rule.title,
        trees: treeRef,
        status: { $in: ["assigned", "in_progress", "pending"] },
      });

      if (existing) {
        skippedTasks.push({
          param,
          statusLevel,
          reason: "Duplicate open task already exists",
          existingTaskId: existing.taskId,
        });
        console.log(`⏭️  Skipped duplicate: "${rule.title}" for tree ${treeId}`);
        continue;
      }

      // Critical tasks due today, Warning tasks due tomorrow
      const dueDate = new Date();
      if (statusLevel === "Warning") dueDate.setDate(dueDate.getDate() + 1);
      dueDate.setHours(23, 59, 59, 0);

      const task = new Task({
        title: rule.title,
        description: rule.description,
        taskType: rule.taskType,
        priority: rule.priority,
        assignedTo,
        assignedBy: null,
        block,
        trees: treeRef ? [treeRef] : [],
        dueDate,
        // [SYSTEM] prefix is used to identify auto-generated tasks in the mobile app
        notes: `[SYSTEM] Auto-generated from sensor reading. ${param}: ${value} → ${statusLevel}. Synced at: ${new Date().toISOString()}`,
        status: "assigned",
        assignedAt: new Date(),
      });

      await task.save();
      console.log(`🤖 System task created: "${rule.title}" | Tree: ${treeId} | ${param}: ${value} → ${statusLevel}`);

      const populated = await Task.findById(task._id)
        .populate("assignedTo", "name email empId")
        .populate("trees", "treeId block healthStatus");

      createdTasks.push(populated);
    }

    res.status(201).json({
      success: true,
      message: `${createdTasks.length} system task(s) created, ${skippedTasks.length} skipped (duplicates)`,
      data: createdTasks,
      skipped: skippedTasks,
    });
  } catch (error) {
    console.error("❌ Error creating sensor tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error creating sensor tasks",
      error: error.message,
    });
  }
};

// GET /api/tasks/sensor-tasks/:treeId
// Returns all open system-generated tasks for a specific tree
const getSensorTasksForTree = async (req, res) => {
  try {
    const { treeId } = req.params;

    const treeDoc = await Tree.findOne({ treeId });
    if (!treeDoc) {
      return res.status(404).json({
        success: false,
        message: "Tree not found",
      });
    }

    const tasks = await Task.find({
      trees: treeDoc._id,
      notes: { $regex: /^\[SYSTEM\]/, $options: "i" },
      status: { $in: ["assigned", "in_progress", "pending"] },
    })
      .populate("assignedTo", "name empId")
      .sort({ priority: 1, dueDate: 1 });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("Error fetching sensor tasks for tree:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
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
};