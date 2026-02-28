// oudra-server/app/controllers/employee_controller.js
const Employee = require("../models/Employee");
const path = require("path");
const fs = require("fs");

const addEmployee = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const profileImg = req.file ? `app/uploads/${req.file.filename}` : "";

    const generateEmpCode = () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `FW-${now.getFullYear()}${month}${day}-${Math.floor(100 + Math.random() * 900)}`;
    };

    if (!name || !phone || !email) {
      return res.status(400).json({
        message: "Name, Phone, and Email are required",
      });
    }

    const employee = new Employee({
      empId: generateEmpCode(),
      name,
      email,
      phone,
      profileImg,
      isActive: true,
    });

    await employee.save();

    res.status(201).json({
      message: "Field worker created successfully",
      data: employee,
    });
  } catch (err) {
    console.error("Error in addEmployee:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });

    const formattedEmployees = employees.map((employee) => ({
      ...employee.toObject(),
      profileImg: employee.profileImg
        ? `${req.protocol}://${req.get("host")}/uploads/${
            employee.profileImg.split("uploads/")[1]
          }`
        : null,
    }));

    res.status(200).json({ data: formattedEmployees });
  } catch (err) {
    console.error("Error in getAllEmployees:", err);
    res.status(500).json({ error: err.message });
  }
};

// NEW: Get single employee by ID — used by mobile profile screen
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    const formattedEmployee = {
      ...employee.toObject(),
      profileImg: employee.profileImg
        ? `${req.protocol}://${req.get("host")}/uploads/${
            employee.profileImg.split("uploads/")[1]
          }`
        : null,
    };
    res.status(200).json({ data: formattedEmployee });
  } catch (err) {
    console.error("Error in getEmployeeById:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, isActive } = req.body;

    let updateData = { name, email, phone, isActive };

    if (req.file) {
      updateData.profileImg = `app/uploads/${req.file.filename}`;

      const employee = await Employee.findById(id);
      if (employee.profileImg) {
        const oldImagePath = path.join(__dirname, "../", employee.profileImg);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Field worker updated successfully",
      data: updatedEmployee,
    });
  } catch (err) {
    console.error("Error in updateEmployee:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.profileImg) {
      const imagePath = path.join(__dirname, "../", employee.profileImg);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.status(200).json({ message: "Field worker deleted successfully" });
  } catch (err) {
    console.error("Error in deleteEmployee:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};