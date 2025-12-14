//path: oudra-server(same backend for web & mobile apps)/app/models/AutoIncrementTreeIdCount.js
const mongoose = require('mongoose');

const AutoIncrementTreeIdCountSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { collection: 'counters' });

module.exports = mongoose.model('AutoIncrementTreeIdCount', AutoIncrementTreeIdCountSchema);