const Employee = require("../models/Employee");
const Checkout = require("../models/Checkout");
const Salary = require('../models/SalaryRecord');
const path = require("path");
const fs = require("fs");
const { log } = require("console");

const addEmployee = async (req, res) => {
  try {
    const { name, email, phone, occupation } = req.body;

    const profileImg = req.file ? `app/uploads/${req.file.filename}` : "";

    const generateEmpCode = () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = String(now.getMinutes()).padStart(2, "0");
      const second = String(now.getSeconds()).padStart(2, "0");

      return `EMP-${month}${day}${hour}${minute}${second}`;
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
      occupation,
      profileImg,
    });

    await employee.save();

    res
      .status(201)
      .json({ message: "Employee created successfully", data: employee });
  } catch (err) {
    console.error("Error in addEmployee:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // Months are 1-12
    
    // Get first and last day of current month for event counting
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all employees with their occupation data
    const employees = await Employee.find().sort({ createdAt: -1 }).populate({
      path: "occupation",
      model: "Role",
    });

    // Get completed checkouts for the current month
    const checkouts = await Checkout.find({
      createdAt: { $gte: firstDay, $lte: lastDay },
      status: "Completed",
    });

    // Count events per employee
    const eventCountMap = {};
    checkouts.forEach((checkout) => { 
      checkout.employees.forEach((empId) => {

        const idStr = empId.toString();
        eventCountMap[idStr] = (eventCountMap[idStr] || 0) + 1;
      });
    });

    // Get all salary records for current month
    const currentMonthSalaries = await Salary.find({
      year: currentYear,
      month: currentMonth
    });

    // Create a map of paid employees { employeeId: salaryRecord }
    const paidEmployeesMap = {};
    currentMonthSalaries.forEach(salary => {
      paidEmployeesMap[salary.employeeId.toString()] = salary;
    });

    // Prepare final employee data
    const employeesWithEvents = employees.map((employee) => {
      const employeeIdStr = employee._id.toString();
      const salaryRecord = paidEmployeesMap[employeeIdStr];
      
      return {
        ...employee.toObject(),
        eventsCount: eventCountMap[employeeIdStr] || 0,
        salaryPaid: !!salaryRecord, // true if salary record exists
        lastPaymentDate: salaryRecord?.createdAt || null,
        profileImg: employee.profileImg
          ? `${req.protocol}://${req.get("host")}/uploads/${
              employee.profileImg.split("uploads/")[1]
            }`
          : null,
      };
    });

    res.status(200).json({ data: employeesWithEvents });
  } catch (err) {
    console.error("Error in getAllEmployees:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, occupation } = req.body;

    let updateData = { name, email, phone, occupation };

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
      message: "Employee updated successfully",
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

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Error in deleteEmployee:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addEmployee,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
};
