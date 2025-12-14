//path:oudra-server(same backend for web & mobile apps)/app/models/Observations.js
const mongoose = require('mongoose');

const ObservationsSchema = new mongoose.Schema({
  observationId: { type: String, unique: true, required: true },
  treeId: { type: String, required: true, index: true },
  observedBy: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Routine', 'Disease', 'Pest', 'Fertilizer', 'Harvest', 'Other'],
    default: 'Routine'
  },
  notes: { type: String, required: true },
  images: [{ type: String }],
  healthStatus: { 
    type: String, 
    enum: ['Healthy', 'Warning', 'Damaged', 'Dead', 'Harvested'],
    default: 'Healthy'
  },
  timestamp: { type: Date, default: Date.now },
  canEdit: { type: Boolean, default: true },
  lastUpdatedBy: { type: String },
  lastUpdatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Observations', ObservationsSchema);