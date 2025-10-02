const Product = require("../models/Product");
const path = require("path");
const fs = require("fs");

const addProduct = async (req, res) => {
  try {
    const { pname, events, stock, pprice, category } = req.body;

    // Validate required fields
    if (!pname || !events || !pprice || !category) {
      return res.status(400).json({
        message: "Missing required fields",
        details: {
          pname: !pname ? "Product name is required" : undefined,
          events: !events ? "At least one event ID is required" : undefined,
          pprice: !pprice ? "Price is required" : undefined,
          category: !category ? "Category is required" : undefined,
        },
      });
    }

    // Validate events
    const eventIds = Array.isArray(events)
      ? events.filter((id) => id)
      : events.split(",").map((id) => id.trim()).filter((id) => id);
    if (eventIds.length === 0) {
      return res.status(400).json({ message: "At least one valid event ID is required" });
    }

    const photoUrl = req.file ? `app/uploads/${req.file.filename}` : "";

    const newProduct = new Product({
      pname,
      events: eventIds,
      stockqut: stock || 0,
      pprice: parseFloat(pprice),
      category,
      photoUrl,
    });

    await newProduct.save();
    res.status(201).json({ message: "Product added successfully", product: newProduct });
  } catch (err) {
    console.error("Error in addProduct:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate({
      path: "events",
      select: "title",
    });

    const productsWithFullPath = products.map((product) => {
      const cleanPath = product.photoUrl?.split("uploads/")[1] || "";
      return {
        ...product.toObject(),
        photoUrl: cleanPath
          ? `${req.protocol}://${req.get("host")}/uploads/${cleanPath}`
          : "",
      };
    });

    res.status(200).json(productsWithFullPath);
  } catch (err) {
    console.error("Error in getAllProducts:", err);
    res.status(500).json({ message: "Failed to retrieve products", error: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { pname, events, stock, pprice, category } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!pname || !events || !pprice || !category) {
      return res.status(400).json({
        message: "Missing required fields",
        details: {
          pname: !pname ? "Product name is required" : undefined,
          events: !events ? "At least one event ID is required" : undefined,
          pprice: !pprice ? "Price is required" : undefined,
          category: !category ? "Category is required" : undefined,
        },
      });
    }

    const eventIds = Array.isArray(events)
      ? events.filter((id) => id)
      : events.split(",").map((id) => id.trim()).filter((id) => id);
    if (eventIds.length === 0) {
      return res.status(400).json({ message: "At least one valid event ID is required" });
    }

    product.pname = pname;
    product.events = eventIds;
    product.stockqut = stock || product.stockqut;
    product.pprice = parseFloat(pprice);
    product.category = category;

    if (req.file) {
      if (product.photoUrl) {
        const oldPhotoPath = path.join(__dirname, "../..", product.photoUrl);
        try {
          if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
          }
        } catch (fsErr) {
          console.warn("Warning: Could not delete old photo:", fsErr.message);
        }
      }
      product.photoUrl = `app/uploads/${req.file.filename}`;
    }

    const updatedProduct = await product.save();

    await updatedProduct.populate({
      path: "events",
      select: "title",
    });

    const cleanPath = updatedProduct.photoUrl?.split("uploads/")[1] || "";
    const productWithFullPath = {
      ...updatedProduct.toObject(),
      photoUrl: cleanPath
        ? `${req.protocol}://${req.get("host")}/uploads/${cleanPath}`
        : "",
    };

    res.status(200).json({
      message: "Product updated successfully",
      product: productWithFullPath,
    });
  } catch (err) {
    console.error("Error in updateProduct:", err);
    res.status(500).json({
      message: "Failed to update product",
      error: err.message,
    });
  }
};

const getProductsByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;

    const products = await Product.find({ events: eventId }).populate({
      path: "events",
      select: "title",
    });

    const productsWithFullPath = products.map((product) => {
      const cleanPath = product.photoUrl?.split("uploads/")[1] || "";
      return {
        ...product.toObject(),
        photoUrl: cleanPath
          ? `${req.protocol}://${req.get("host")}/uploads/${cleanPath}`
          : "",
      };
    });

    res.status(200).json(productsWithFullPath);
  } catch (err) {
    console.error("Error in getProductsByEventId:", err);
    res.status(500).json({
      message: "Failed to retrieve products by event ID",
      error: err.message,
    });
  }
};

const getProductsByEventIdAndCategory = async (req, res) => {
  try {
    const { eventId } = req.params;

    const products = await Product.find({ events: eventId }).populate({
      path: "events",
      select: "title",
    });

    const productsWithFullPath = products.map((product) => {
      const cleanPath = product.photoUrl?.split("uploads/")[1] || "";
      return {
        ...product.toObject(),
        photoUrl: cleanPath
          ? `${req.protocol}://${req.get("host")}/uploads/${cleanPath}`
          : "",
      };
    });

    const groupedProducts = productsWithFullPath.reduce((acc, product) => {
      const { category } = product;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {});

    res.status(200).json(groupedProducts);
  } catch (err) {
    console.error("Error in getProductsByEventIdAndCategory:", err);
    res.status(500).json({
      message: "Failed to retrieve products by event ID and category",
      error: err.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.photoUrl) {
      const photoPath = path.join(__dirname, "../..", product.photoUrl);
      try {
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      } catch (fsErr) {
        console.warn("Warning: Could not delete photo:", fsErr.message);
      }
    }

    await product.deleteOne();
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error in deleteProduct:", err);
    res.status(500).json({
      message: "Failed to delete product",
      error: err.message,
    });
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  deleteProduct,
  getProductsByEventId,
  getProductsByEventIdAndCategory,
  updateProduct,
};