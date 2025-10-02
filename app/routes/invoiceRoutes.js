// server02/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();

router.get('/:id', (req, res) => {
  res.json({ message: `Invoice ID requested: ${req.params.id}` });
});

module.exports = router;
