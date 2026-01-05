const axios = require('axios');
const SensorData = require('../models/SensorData');

// Ensure this IP matches your Arduino Serial Monitor output
const ESP32_IP = 'http://10.140.243.52'; 

const iotController = {
    async syncData(req, res) {
        try {
            const { treeId } = req.params;
            const { manualPh } = req.body; // Received from Mobile App

            console.log(`📡 Contacting ESP32 for tree ${treeId}...`);

            // 1. Get data from ESP32
            const response = await axios.get(`${ESP32_IP}/data`, { timeout: 8000 });
            const iot = response.data;

            // 2. Map Arduino names to MongoDB names
            // Arduino sends "soil_moisture", but we store as "soilMoisture"
            const newReading = new SensorData({
                treeId: treeId,
                temperature: iot.temperature,
                humidity: iot.humidity,
                soilMoisture: iot.soil_moisture, 
                soilPh: manualPh || null,
                overallStatus: 'Normal'
            });

            // 3. Save to MongoDB
            const savedData = await newReading.save();
            console.log("✅ Data saved to MongoDB:", savedData);

            res.status(200).json({
                success: true,
                message: "Data synced and stored successfully",
                data: savedData
            });

        } catch (error) {
            console.error("❌ Sync Error:", error.message);
            res.status(500).json({ 
                success: false, 
                error: "Failed to connect to IoT device or Database." 
            });
        }
    },

    async getLatest(req, res) {
        try {
            const { treeId } = req.params;
            const data = await SensorData.findOne({ treeId }).sort({ recordedAt: -1 });
            
            if (!data) {
                return res.json({ success: true, hasData: false });
            }

            res.json({ success: true, hasData: true, data });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = iotController;