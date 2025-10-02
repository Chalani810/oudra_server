const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Event = require("../models/Event");

const updateCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, quantity, eventId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    let cart = await Cart.findOne({ userId })
      .populate("items.productId", "name price eventId")
      .populate("eventId", "title");

    if (cart) {

      const existingItem = cart.items.find(
        (item) => item.productId._id.toString() === productId
      );

      if (existingItem) {
        return res.status(400).json({
          message: "Product already exists in cart",
          existingItem: {
            productId: existingItem.productId._id,
            quantity: existingItem.quantity,
          },
        });
      }
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: `Product ${productId} not found`,
      });
    }

    if (cart && cart.eventId) {
      const belongsToEvent = product.events.some((eventObjId) =>
        eventObjId.equals(cart.eventId._id)
      );

      const cartEvent = await Event.findById(cart.eventId._id);

      if (!belongsToEvent) {
        return res.status(400).json({
          message: `Product ${product.pname} doesn't belong to the cart's current event ${cartEvent.title}`,
          currentEventId: cart.eventId._id,
        });
      }

      if (eventId && !(eventId == cart.eventId._id)) {
        return res.status(400).json({
          message: `Cannot add products from different events. Cart is already associated with event ${cartEvent.title}`,
          currentEventId: cart.eventId._id,
          attemptedEventId: eventId,
        });
      }
    } else if (eventId) {
      const belongsToEvent = product.events.some((eventObjId) =>
        eventObjId.equals(eventId)
      );

      if (!belongsToEvent) {
        return res.status(400).json({
          message: `Product ${product._id} doesn't belong to event ${eventId}`,
        });
      }
    }

    const itemTotal = product.pprice * quantity;

    const advancePayment = Math.round(itemTotal * 0.5 * 100) / 100;
    const totalDue = Math.max(0, itemTotal - advancePayment);

    if (!cart) {
      cart = new Cart({
        userId,
        eventId: eventId || null,
        items: [
          {
            productId: product._id,
            quantity,
            price: product.pprice,
          },
        ],
        cartTotal: itemTotal,
        advancePayment: advancePayment,
        totalDue: totalDue,
      });
    } else {
      cart.items.push({
        productId: product._id,
        quantity,
        price: product.pprice,
      });

      cart.cartTotal += itemTotal;
      cart.advancePayment = Math.round(cart.cartTotal * 0.5 * 100) / 100;
      cart.totalDue = Math.max(0, cart.cartTotal - cart.advancePayment);

      if (eventId && !cart.eventId) {
        cart.eventId = eventId;
      }
    }

    const savedCart = await cart.save();

    res.status(200).json({
      message: "Item added to cart successfully",
      data: savedCart,
    });
  } catch (err) {
    console.error("Error in updateCart:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("eventId");

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found",
      });
    }

    for (item of cart.items) {
      if (!item.productId.photoUrl) {
        continue;
      }
      const cleanPath = item.productId.photoUrl.split("uploads/")[1] || "";

      item.productId.photoUrl = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${cleanPath}`;
    }

    res.status(200).json({
      data: cart,
    });
  } catch (err) {
    console.error("Error in getCart:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};
const removeFromCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID must be provided",
      });
    }

    let cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("eventId");

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId._id.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        message: "Product not found in cart",
      });
    }

    // Remove the item
    cart.items.splice(itemIndex, 1);

    if (cart.items.length === 0) {
      cart.eventId = null;
      cart.cartTotal = 0;
      cart.advancePayment = 0;
      cart.totalDue = 0;
    } else {
      let cartTotal = 0;

      const itemsWithProducts = await Promise.all(
        cart.items.map(async (item) => {
          const product = await Product.findById(item.productId);
          return {
            productId: product._id,
            quantity: item.quantity,
            price: product.pprice,
          };
        })
      );

      // Calculate new totals
      itemsWithProducts.forEach((item) => {
        cartTotal += item.price * item.quantity;
      });

      // Recalculate advance payment (50% of new total)
      const advancePayment = Math.round(cartTotal * 0.5 * 100) / 100;
      
      cart.items = itemsWithProducts;
      cart.cartTotal = cartTotal;
      cart.advancePayment = advancePayment;
      cart.totalDue = Math.max(0, cartTotal - advancePayment);
    }

    const savedCart = await cart.save();

    res.status(200).json({
      message: "Product removed from cart successfully",
      data: savedCart,
    });
  } catch (err) {
    console.error("Error in removeFromCart:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};

const updateCartItemQuantity = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "name price eventId")
      .populate("eventId", "name");

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId._id.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        message: "Product not found in cart",
      });
    }

    // Calculate old and new item totals
    const oldItemTotal = cart.items[itemIndex].price * cart.items[itemIndex].quantity;
    cart.items[itemIndex].quantity = quantity;
    const newItemTotal = cart.items[itemIndex].price * quantity;

    // Update cart totals
    cart.cartTotal = cart.cartTotal - oldItemTotal + newItemTotal;
    
    // Recalculate advance payment (50% of new total)
    cart.advancePayment = Math.round(cart.cartTotal * 0.5 * 100) / 100;
    cart.totalDue = Math.max(0, cart.cartTotal - cart.advancePayment);

    const savedCart = await cart.save();

    res.status(200).json({
      message: "Product quantity updated successfully",
      data: savedCart,
    });
  } catch (err) {
    console.error("Error in updateCartItemQuantity:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};

module.exports = {
  updateCart,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
};
