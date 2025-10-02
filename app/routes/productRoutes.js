const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  addProduct,
  getAllProducts,
  deleteProduct,
  getProductsByEventId,
  getProductsByEventIdAndCategory,
  updateProduct,
} = require('../controllers/product_controller');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'app/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.post('/', upload.single('productImage'), addProduct);
router.get('/', getAllProducts);
router.delete('/:productId', deleteProduct);
router.get('/by-event/:eventId', getProductsByEventId);
router.get('/by-event-category/:eventId', getProductsByEventIdAndCategory);
router.put('/:productId', upload.single('productImage'), updateProduct);

module.exports = router;