const Checkout = require("../models/Checkout");
const Product = require("../models/Product");
const User = require("../models/User");
const Cart = require("../models/Cart");
const Employee = require("../models/Employee");
const path = require("path");
const fs = require("fs");
const { log } = require("console");

const mongoose = require("mongoose");

const addCheckout = async (req, res) => {
  try {
    const {
      userId = null, // Assuming you have user ID from the token
      firstName,
      lastName,
      email,
      address,
      telephone,
      mobile,
      contactMethod,
      guestCount,
      eventDate,
      comment,
      cartTotal,
      advancePayment,
      duepayment,
      cart,
    } = req.body;

    const slipUrl = req.file ? `app/uploads/${req.file.filename}` : "";

    const generateOrderCode = () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = String(now.getMinutes()).padStart(2, "0");
      const second = String(now.getSeconds()).padStart(2, "0");
      return `OID-${month}${day}${hour}${minute}${second}`;
    };

    log("Received file:", req.file); // Log the received file for debugging

    // Validation - check important fields
    if (!firstName || !lastName || !email || !mobile || !eventDate) {
      return res.status(400).json({
        message:
          "firstName, lastName, email , mobile and eventDate are required",
      });
    }

    // Validate eventDate
    const parsedEventDate = new Date(eventDate);
    if (isNaN(parsedEventDate)) {
      return res.status(400).json({ message: "Invalid eventDate format" });
    }

    // Ensure eventDate is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedEventDate < today) {
      return res
        .status(400)
        .json({ message: "Event date must be today or in the future" });
    }

    const user = await User.findById(userId).select(
      "firstName lastName email "
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { firstname, lastname, email: userEmail } = user;

    // Create a new checkout entry
    const newCheckout = new Checkout({
      orderId: generateOrderCode(),
      userId: userId || null, // Use the user ID from the token or null if not logged in
      firstName,
      lastName,
      email,
      address,
      telephone,
      mobile,
      contactMethod,
      guestCount,
      eventDate: parsedEventDate,
      comment,
      cartTotal,
      advancePayment,
      duepayment,
      slipPreview: req.file?.path,
      status: "Pending", // Default status
      slipUrl,
      cart: typeof cart === "string" ? JSON.parse(cart) : cart,
    });

    await newCheckout.save();

    const parsedCart = typeof cart === "string" ? JSON.parse(cart) : cart;

    // Validate product quantities before proceeding
    for (const item of parsedCart.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${item.productId} not found` });
      }
      if (product.stockqut < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ${product.pname}. Available: ${product.stockqut}, Requested: ${item.quantity}`,
        });
      }
    }

    // Deduct quantities from products
    for (const item of parsedCart.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockqut: -item.quantity } },
        { new: true }
      );
    }

    let userCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("eventId");

    userCart.eventId = null;
    userCart.cartTotal = 0;
    userCart.advancePayment = 0;
    userCart.totalDue = 0;
    userCart.items = [];

    await userCart.save();
    res
      .status(201)
      .json({ message: "Checkout created successfully", data: newCheckout });
  } catch (err) {
    console.error("Error in addCheckout:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const checkouts = await Checkout.find().populate({
      path: "employees",
      populate: {
        path: "occupation",
      },
    });

    const checkoutsWithFullPath = checkouts.map((checkout) => {
      const result = {
        ...checkout.toObject(),
      };

      if (checkout.slipUrl) {
        try {
          const splitUrl = checkout.slipUrl.split("uploads/");
          if (splitUrl.length > 1) {
            result.slipUrl = `${req.protocol}://${req.get("host")}/uploads/${
              splitUrl[1]
            }`;
          } else {
            result.slipUrl = checkout.slipUrl;
          }
        } catch (error) {
          result.slipUrl = checkout.slipUrl;
        }
      }

      return result;
    });

    res.status(200).json(checkoutsWithFullPath);
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve checkouts",
      error: err.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    const currentOrder = await Checkout.findById(id);

    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Restock products if status is changing to "Completed"
    if (status === "Completed" && currentOrder.status !== "Completed") {
      if (currentOrder.cart?.items) {
        for (const item of currentOrder.cart.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stockqut: item.quantity },
          });
        }
      }

      if (currentOrder.employees && currentOrder.employees.length > 0) {
        await Employee.updateMany(
          { _id: { $in: currentOrder.employees } },
          { $set: { availability: true } }
        );
      }

      const pointsToAdd = Math.floor(currentOrder.cartTotal / 1000);
      await User.findByIdAndUpdate(currentOrder.userId, {
        $inc: { loyaltyPoints: pointsToAdd },
      });
    }

    const updatedOrder = await Checkout.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.status(200).json({
      message: "Order status updated",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({
      message: "Failed to update order status",
      error: err.message,
    });
  }
};

const assignEmployees = async (req, res) => {
  try {
    const { id } = req.params; // checkout ID
    const { employeeIds } = req.body; // array of employee ObjectIds

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one employee ID is required" });
    }

    const updatedCheckout = await Checkout.findByIdAndUpdate(
      id,
      { assignedEmployees: employeeIds },
      { new: true }
    ).populate("assignedEmployees");

    if (!updatedCheckout) {
      return res.status(404).json({ message: "Checkout not found" });
    }

    res.status(200).json({
      message: "Employees assigned successfully",
      data: updatedCheckout,
    });
  } catch (err) {
    console.error("Error assigning employees:", err);
    res
      .status(500)
      .json({ message: "Failed to assign employees", error: err.message });
  }
};

const deleteCheckout = async (req, res) => {
  try {
    const { checkoutId } = req.params;

    const checkout = await Checkout.findById(checkoutId);
    if (!checkout) {
      return res.status(404).json({ message: "Checkout not found" });
    }

    if (checkout.employees && checkout.employees.length > 0) {
      await Employee.updateMany(
        { _id: { $in: checkout.employees } },
        { $set: { availability: true } }
      );
    }

    if (checkout.slipUrl) {
      const filePath = path.join(__dirname, "../..", checkout.slipUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Checkout.findByIdAndDelete(checkoutId);

    res.status(200).json({ message: "Checkout deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete checkout", error: err.message });
  }
};

module.exports = {
  addCheckout,
  getAll,
  updateOrderStatus,
  deleteCheckout,
  assignEmployees,
};
