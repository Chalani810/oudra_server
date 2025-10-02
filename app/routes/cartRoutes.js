const express = require("express");
const router = express.Router();
const { updateCart, getCart, removeFromCart,updateCartItemQuantity } = require("../controllers/cart_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.put("/:userId", updateCart);
// Get user's cart
router.get("/:userId", getCart);

router.delete("/:userId/items", removeFromCart);

router.patch('/:userId/items/:productId', updateCartItemQuantity);


module.exports = router;