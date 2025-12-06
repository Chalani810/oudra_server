// app/models/TreeModel.js :

const mongoose = require('mongoose');

const GpsSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const TreeSchema = new mongoose.Schema({
  treeId: { type: String, unique: true, index: true },
  nfcTagId: { type: String, default: null, index: true },
  plantedDate: { type: Date, default: null },
  
  // age can be calculated in the client-side or via a utility; optional stored number:
  age: { type: Number, default: null }, 
  investorId: { type: String, default: null },
  investorName: { type: String, default: null },
  block: { type: String, default: null },
  gps: { type: GpsSchema, required: true },
  healthStatus: { type: String, enum: ['Healthy', 'Warning', 'Damaged', 'Dead'], default: 'Healthy' },
  lastInspection: { type: Date, default: null },
  inspectedBy: { type: String, default: null },
  lastUpdatedAt: { type: Date, default: Date.now },
  lastUpdatedBy: { type: String, default: null },
  isArchived: { type: Boolean, default: false },
  treeImageUrl: { type: String, default: '' },
  offlineUpdated: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },

  // Lifecycle fields
  lifecycleStatus: {
    type: String,
    enum: [
      'Growing','Ready for 1st Inoculation','Inoculated Once',
      'Ready for 2nd Inoculation','Inoculated Twice','Ready for Harvest','Harvested'
    ],
    default: 'Growing'
  },
  inoculationCount: { type: Number, default: 0 }, // 0,1,2
  readyForInoculation: { type: Boolean, default: false },
  readyForHarvest: { type: Boolean, default: false }
});

// update timestamps
TreeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Tree', TreeSchema);