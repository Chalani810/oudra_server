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
        trees = []; // Keep it empty if no trees found
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
      assignedBy: null, // Will be set when auth is implemented
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

    // Apply filters
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    if (block) query.block = block;
    if (priority) query.priority = priority;
    if (taskType) query.taskType = taskType;

    // Search functionality
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
// Alternative simpler approach - always clear trees when block changes
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating taskId or assignedBy
    if (updates.taskId || updates.assignedBy) {
      delete updates.taskId;
      delete updates.assignedBy;
    }

    // Get current task to check if block is changing
    const currentTask = await Task.findById(id);
    
    if (currentTask && updates.block && currentTask.block !== updates.block) {
      console.log(`🔄 Block changed from ${currentTask.block} to ${updates.block}. Clearing trees.`);
      
      // Clear trees when block changes (let frontend/user reselect)
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

    // Marking as viewed in mobile app
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

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksForEmployee,
  updateTaskStatus,
  getTaskStats
};