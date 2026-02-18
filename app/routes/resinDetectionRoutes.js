const express = require('express');
const router = express.Router();
const multer = require('multer');
const tf = require('@tensorflow/tfjs');
const { Jimp } = require('jimp'); 
const path = require('path');
const fs = require('fs');
const url = require('url');
const { y } = require('pdfkit');

// Ensure the temp directory exists
const tempDir = path.join(__dirname, '../../app/uploads/temp');
if (!fs.existsSync(tempDir)){
    fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({ dest: 'app/uploads/temp/' });

let model;
// Ensure these match your folder names from training
const classLabels = ["high_resin", "medium_resin", "no_resin"];

async function loadModel() {
    try {
        const modelPath = path.resolve(__dirname, '../../model/model.json');
        const modelDir = path.dirname(modelPath);

        console.log("🛠️ Processing Keras 3 Model Metadata...");

        const customIOHandler = {
            load: async () => {
                const modelJsonContent = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

                // FIX: Keras 3 uses 'batch_shape' inside the config. 
                // TFJS Layers loader expects 'batch_input_shape' at the top level of the layer config.
                if (modelJsonContent.modelTopology?.model_config?.config?.layers) {
                    const layers = modelJsonContent.modelTopology.model_config.config.layers;
                    
                    layers.forEach(layer => {
                        if (layer.config && layer.config.batch_shape) {
                            // Inject the property the loader is looking for
                            layer.config.batch_input_shape = layer.config.batch_shape;
                        }
                    });
                }

                const weightSpecs = modelJsonContent.weightsManifest[0];
                const weightData = [];
                for (const pathName of weightSpecs.paths) {
                    const fullWeightPath = path.join(modelDir, pathName);
                    weightData.push(fs.readFileSync(fullWeightPath));
                }

                const combinedWeights = Buffer.concat(weightData);

                return {
                    modelTopology: modelJsonContent.modelTopology,
                    weightSpecs: weightSpecs.weights,
                    weightData: combinedWeights.buffer.slice(
                        combinedWeights.byteOffset, 
                        combinedWeights.byteOffset + combinedWeights.byteLength
                    ),
                };
            }
        };

        // We still use loadLayersModel because the JSON format is 'layers-model'
        model = await tf.loadLayersModel(customIOHandler);
        
        console.log("✅ SUCCESS: Keras 3 Agarwood Model Loaded Successfully");
    } catch (err) {
        console.error("❌ Model Loading Error:", err.message);
    }
}
// loadModel();

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        // 1. Process Image
        const image = await Jimp.read(req.file.path);
        image.cover({ w: 224, h: 224 }); // Resize to match model input

        // 2. Convert to RGB Tensor
        const { data, width, height } = image.bitmap;
        const buffer = new Float32Array(width * height * 3);
        
        for (let i = 0; i < width * height; i++) {
            buffer[i * 3 + 0] = data[i * 4 + 0] / 255; // Red
            buffer[i * 3 + 1] = data[i * 4 + 1] / 255; // Green
            buffer[i * 3 + 2] = data[i * 4 + 2] / 255; // Blue
        }

        const tensor = tf.tensor3d(buffer, [224, 224, 3]).expandDims(0);

        // 3. Predict
        const prediction = model.predict(tensor);
        const results = await prediction.data();
        const maxIdx = results.indexOf(Math.max(...results));

        // 4. Cleanup
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            grade: classLabels[maxIdx],
            confidence: (results[maxIdx] * 100).toFixed(2) + "%",
            details: {
                high: (results[0] * 100).toFixed(2) + "%",
                medium: (results[1] * 100).toFixed(2) + "%",
                none: (results[2] * 100).toFixed(2) + "%"
            }
        });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to process image" });
    }
});

module.exports = router;