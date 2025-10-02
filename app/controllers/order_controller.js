const Checkout = require("../models/Checkout");
const Employee = require("../models/Employee");
const Cart = require("../models/Cart");
const Feedback = require("../models/Feedback");
const nodemailer = require("nodemailer");

// Get all orders (already partially implemented in your OrderHistory fetch)
const getAllOrders = async (req, res) => {
  try {
    const orders = await Checkout.find()
      .populate("employees", "name")
      .populate("eventId", "title date")
      .populate("items.productId", "name price photoUrl");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedEmployees } = req.body;
    if (!["Pending", "Completed", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (assignedEmployees && assignedEmployees.length > 0) {
      const validEmployees = await Employee.find({
        _id: { $in: assignedEmployees },
      });
      if (validEmployees.length !== assignedEmployees.length) {
        return res
          .status(400)
          .json({ message: "One or more employee IDs are invalid" });
      }
    }

    const updateFields = { status };
    if (assignedEmployees) {
      updateFields.assignedEmployees = assignedEmployees;
    }

    const order = await Checkout.findByIdAndUpdate(
      id,
      { status, assignedEmployees }, // Update both fields
      { new: true }
    ).populate({
      path: "employees",
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const assignedEmployees = async (req, res) => {
  let empIds;

  try {
    const { id } = req.params;
    empIds = req.body.empIds;

    if (!Array.isArray(empIds)) {
      return res
        .status(400)
        .json({ message: "Employee IDs must be provided as an array" });
    }

    const existingOrder = await Checkout.findById(id);
    const employees = await Employee.find({ _id: { $in: empIds } });

    if (employees.length !== empIds.length) {
      const missingIds = empIds.filter(
        (id) => !employees.some((emp) => emp._id.equals(id))
      );
      return res.status(400).json({
        message: "Some employees don't exist",
        missingIds,
      });
    }

    await Employee.updateMany(
      { _id: { $in: empIds } },
      { $set: { availability: false } }
    );

    if (existingOrder?.employees?.length > 0) {
      const previousEmpIds = existingOrder.employees.map(
        (emp) => emp._id || emp
      );
      const employeesToRelease = previousEmpIds.filter(
        (id) => !empIds.includes(id.toString())
      );

      if (employeesToRelease.length > 0) {
        await Employee.updateMany(
          { _id: { $in: employeesToRelease } },
          { $set: { availability: true } }
        );
      }
    }

    const order = await Checkout.findByIdAndUpdate(
      id,
      { $set: { employees: empIds } },
      { new: true }
    ).populate({
      path: "employees",
      populate: { path: "occupation" },
    });

    if (!order) {
      await Employee.updateMany(
        { _id: { $in: empIds } },
        { $set: { availability: true } }
      );
      return res.status(404).json({ message: "Order not found" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const eventDate = new Date(order.eventDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailPromises = employees.map((employee) => {
      const mailOptions = {
        to: employee.email,
        from: `Glimmer <${process.env.EMAIL_FROM}>`,
        subject: `🎉 New Assignment: ${order.cart.eventId.title} (${order.orderId})`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
            <!-- Header with Glimmer branding -->
            <div style="background-color: #d10000; padding: 20px; text-align: center; border-top-left-radius: 5px; border-top-right-radius: 5px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                <strong>GLIMMER</strong>
              </h1>
              <p style="color: white; margin: 5px 0 0; font-size: 16px;">Event Staff Assignment</p>
            </div>
            
            <!-- Main content -->
            <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-bottom: none;">
              <h2 style="color: #d10000; margin-top: 0;">Hello ${
                employee.name
              },</h2>
              
              <p>You've been assigned to an upcoming event. Here are the details:</p>
              
              <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #d10000; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #000000;">📅 Event Details</h3>
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Event Type:</strong> ${order.cart.eventId.title}</p>
                <p><strong>Date & Time:</strong> ${eventDate}</p>
                <p><strong>Location:</strong> ${order.address}</p>
                <p><strong>Client:</strong> ${order.firstName} ${
          order.lastName
        }</p>
                <p><strong>Contact:</strong> ${
                  order.mobile || order.telephone
                } (prefers ${order.contactMethod})</p>
                <p><strong>Guests:</strong> ${order.guestCount}</p>
              </div>
              
              <div style="margin: 20px 0;">
                <h3 style="color: #000000; border-bottom: 2px solid #d10000; padding-bottom: 5px;">👥 Your Team</h3>
                <ul style="padding-left: 20px;">
                  ${order.employees
                    .map(
                      (emp) =>
                        `<li style="margin-bottom: 5px;">
                      <strong>${emp.name}</strong> 
                      <span style="color: #666;">(${emp.phone})</span>
                      ${
                        emp._id.toString() === employee._id.toString()
                          ? '<span style="background: #d10000; color: white; padding: 2px 5px; border-radius: 3px; font-size: 12px; margin-left: 5px;">YOU</span>'
                          : ""
                      }
                    </li>`
                    )
                    .join("")}
                </ul>
              </div>
              
              <div style="background: #fff8f8; border: 1px solid #ffdddd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #d10000;">ℹ️ Important Notes</h3>
                <p>• Please arrive 30 minutes before the scheduled time</p>
                <p>• Wear your Glimmer Events uniform (black pants, red polo)</p>
                <p>• Contact the event manager if you have any questions</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #000000; color: white; padding: 15px; text-align: center; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px; font-size: 14px;">
              <p style="margin: 0;">© 2025 Glimmer Events. All rights reserved.</p>
              <p style="margin: 5px 0 0; color: #d10000;">
                Creating memorable experiences
              </p>
            </div>
          </div>
        `,
      };
      return transporter.sendMail(mailOptions);
    });

    await Promise.all(emailPromises);

    res.json({
      message: "Employees assigned successfully and notified via email",
      order,
    });
  } catch (err) {
    if (empIds) {
      await Employee.updateMany(
        { _id: { $in: empIds } },
        { $set: { availability: true } }
      ).catch(console.error);
    }

    res.status(500).json({
      error: err.message,
      message: "Error assigning employees to order",
    });
  }
};

const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Checkout.find({ userId })
      .populate({
        path: "employees",
        populate: {
          path: "occupation",
        },
      })
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    // For each order, check if there's a feedback entry
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const feedbackExists = await Feedback.exists({ orderId: order._id });
        return {
          ...order.toObject(),
          hasFeedback: !!feedbackExists,
        };
      })
    );

    res.json(enrichedOrders);
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({
      error: "Failed to fetch orders",
      details: err.message,
    });
  }
};
module.exports = {
  getAllOrders,
  updateOrderStatus,
  assignedEmployees,
  getOrdersByUser,
};
