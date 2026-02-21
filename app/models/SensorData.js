const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
  treeId: { type: String, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  soilMoisture: { type: Number, required: true },
  soilPh: { type: Number, default: null },
  overallStatus: { type: String, default: 'Normal' },
  recordedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);