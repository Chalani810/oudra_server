const mongoose = require('mongoose');

const iotRawSchema = new mongoose.Schema({
    deviceId: { type: String, default: 'ESP32_MAIN', unique: true },
    temperature: Number,
    humidity: Number,
    soil_moisture: Number,
    soil_raw: Number,
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IotRawData', iotRawSchema);