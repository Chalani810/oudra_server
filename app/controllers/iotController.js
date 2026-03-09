const axios = require('axios');
const SensorData = require('../models/SensorData');

const ESP32_IP = 'http://192.168.8.116'; 

const calculateStatus = (ph, temp, moisture, humidity) => {
    // 1. Check CRITICAL conditions
    // (Note: pH is only checked if it is > 0)
    if (
        (ph > 0 && (ph < 3.8 || ph > 6.5)) ||
        (temp < 20 || temp > 45) ||
        (moisture < 40 || moisture > 85) ||
        (humidity < 20 || humidity > 80)
    ) {
        return 'Critical';
    }

    // 2. Check WARNING conditions
    if (
        (ph > 0 && ((ph >= 3.8 && ph < 4.5) || (ph > 6.0 && ph <= 6.5))) ||
        (temp >= 20 && temp < 25) || (temp > 40 && temp <= 45) ||
        (moisture >= 40 && moisture < 50) || (moisture > 75 && moisture <= 85) ||
        (humidity >= 20 && humidity < 40) || (humidity > 65 && humidity <= 80)
    ) {
        return 'Warning';
    }

    return 'Normal';
};

const iotController = {
    async syncData(req, res) {
        try {
            const { treeId } = req.params;
            const { manualPh } = req.body; 

            const response = await axios.get(`${ESP32_IP}/data`, { timeout: 8000 });
            const iot = response.data;

            // Use 0 as default if no pH provided
            const currentPh = manualPh || 0; 
            const status = calculateStatus(currentPh, iot.temperature, iot.soil_moisture, iot.humidity);

            const newReading = new SensorData({
                treeId: treeId,
                temperature: iot.temperature,
                humidity: iot.humidity,
                soilMoisture: iot.soil_moisture, 
                soilPh: currentPh,
                overallStatus: status
            });

            console.log(newReading);

            const savedData = await newReading.save();
            res.status(200).json({ success: true, data: savedData });
        } catch (error) {
            res.status(500).json({ success: false, error: "IoT Device Offline" });
        }
    },

    async getAll(req, res) {
        try {
            const data = await SensorData.find().sort({ recordedAt: -1 });
            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async getLatest(req, res) {
        try {
            const { treeId } = req.params;
            const data = await SensorData.findOne({ treeId }).sort({ recordedAt: -1 });
            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = iotController;