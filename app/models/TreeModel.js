// path: models/TreeModel.js
const mongoose = require('mongoose');

const TreeSchema = new mongoose.Schema({
  treeId: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  
  // Investor reference and info
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    default: null
  },
  investorId: {
    type: String,
    trim: true,
    default: null
  },
  investorName: {
    type: String,
    trim: true,
    default: null
  },
  
  // Tree identification
  nfcTagId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  
  // Location and planting info
  block: {
    type: String,
    required: true,
    enum: ['Block-A', 'Block-B', 'Block-C', 'Block-D', 'Block-E', 'Block-F']
  },
  plantedDate: {
    type: Date,
    default: Date.now
  },
  gps: {
    lat: {
      type: Number,
      default: 0
    },
    lng: {
      type: Number,
      default: 0
    }
  },
  
  // Status and lifecycle
  healthStatus: {
    type: String,
    enum: ['Healthy', 'Warning', 'Damaged', 'Dead', 'Harvested'],
    default: 'Healthy'
  },
  lifecycleStatus: {
    type: String,
    enum: [
      'Growing', 
      'Ready for 1st Inoculation', 
      'Inoculated Once', 
      'Ready for 2nd Inoculation', 
      'Inoculated Twice', 
      'Ready for Harvest', 
      'Harvested'
    ],
    default: 'Growing'
  },
  
  // Inoculation data
  inoculationCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 2
  },
  inoculationHistory: [{
    inoculationNumber: Number,
    inoculatedAt: Date,
    inoculatedBy: String,
    notes: String,
    _id: false
  }],
  
  // Inspection data
  lastInspection: Date,
  inspectedBy: String,
  
  // Flags for field workers
  readyForInoculation: {
    type: Boolean,
    default: false
  },
  readyForHarvest: {
    type: Boolean,
    default: false
  },
  
  // Harvest data
  harvestData: {
    harvestedAt: Date,
    harvestNotes: String,
    resinYield: Number,
    qualityGrade: {
      type: String,
      enum: ['Grade-A', 'Grade-B', 'Grade-C', 'Unassigned'],
      default: 'Unassigned'
    },
    certificateGenerated: {
      type: Boolean,
      default: false
    },
    certificateId: String
  },
  
  // System tracking
  offlineUpdated: {
    type: Boolean,
    default: false
  },
  lastUpdatedBy: String,
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for age calculation
TreeSchema.virtual('age').get(function() {
  if (!this.plantedDate) return 0;
  
  const planted = new Date(this.plantedDate);
  const now = new Date();
  
  let years = now.getFullYear() - planted.getFullYear();
  let months = now.getMonth() - planted.getMonth();
  let days = now.getDate() - planted.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, days };
});

// Virtual for formatted age
TreeSchema.virtual('formattedAge').get(function() {
  const age = this.age;
  if (!age) return 'N/A';
  return `${age.years} years ${age.months} months`;
});

// Virtual for next action
TreeSchema.virtual('nextAction').get(function() {
  if (this.healthStatus === 'Dead' || this.lifecycleStatus === 'Harvested') {
    return 'No further actions';
  }
  
  if (this.inoculationCount === 0 && this.age.years >= 4) {
    return 'Ready for 1st inoculation';
  }
  
  if (this.inoculationCount === 1 && this.age.totalMonths >= 52) {
    return 'Ready for 2nd inoculation';
  }
  
  if (this.inoculationCount === 2 && this.age.years >= 8) {
    return 'Ready for harvest';
  }
  
  return 'Monitoring';
});

// Pre-save middleware to generate tree ID
TreeSchema.pre('save', async function(next) {
  if (this.isNew && !this.treeId) {
    const lastTree = await this.constructor.findOne(
      { treeId: /^TR-/ },
      { treeId: 1 },
      { sort: { treeId: -1 } }
    ).exec();
    
    let nextNumber = 1;
    if (lastTree && lastTree.treeId) {
      const lastNum = parseInt(lastTree.treeId.split('-')[1]);
      nextNumber = isNaN(lastNum) ? 1 : lastNum + 1;
    }
    
    this.treeId = `TR-${nextNumber.toString().padStart(4, '0')}`;
  }
  
  // Update lifecycle based on age and health
  if (this.isModified('plantedDate') || this.isModified('healthStatus') || this.isModified('inoculationCount')) {
    const age = this.age;
    
    if (this.healthStatus === 'Dead') {
      this.lifecycleStatus = 'Dead - Lifecycle Stopped';
    } else if (this.lifecycleStatus === 'Harvested') {
      // Keep as harvested if already harvested
    } else if (this.inoculationCount === 0) {
      if (age.years >= 4 && this.healthStatus === 'Healthy') {
        this.lifecycleStatus = 'Ready for 1st Inoculation';
        this.readyForInoculation = true;
      } else {
        this.lifecycleStatus = 'Growing';
      }
    } else if (this.inoculationCount === 1) {
      if (age.totalMonths >= 52 && this.healthStatus === 'Healthy') {
        this.lifecycleStatus = 'Ready for 2nd Inoculation';
        this.readyForInoculation = true;
      } else {
        this.lifecycleStatus = 'Inoculated Once';
      }
    } else if (this.inoculationCount === 2) {
      if (age.years >= 8 && this.healthStatus === 'Healthy') {
        this.lifecycleStatus = 'Ready for Harvest';
        this.readyForHarvest = true;
      } else {
        this.lifecycleStatus = 'Inoculated Twice';
      }
    }
  }
  
  next();
});

// Indexes for better performance
TreeSchema.index({ treeId: 1 }, { unique: true });
TreeSchema.index({ nfcTagId: 1 }, { unique: true, sparse: true });
TreeSchema.index({ block: 1 });
TreeSchema.index({ investor: 1 });
TreeSchema.index({ investorId: 1 });
TreeSchema.index({ healthStatus: 1 });
TreeSchema.index({ lifecycleStatus: 1 });
TreeSchema.index({ plantedDate: -1 });
TreeSchema.index({ 'gps.lat': 1, 'gps.lng': 1 });
TreeSchema.index({ readyForInoculation: 1 });
TreeSchema.index({ readyForHarvest: 1 });

// Static method to find available trees (not assigned to any investor)
TreeSchema.statics.findAvailableTrees = async function() {
  return this.find({
    $or: [
      { investor: { $exists: false } },
      { investor: null },
      { investorId: null }
    ],
    healthStatus: { $nin: ['Dead', 'Harvested'] }
  }).sort({ treeId: 1 });
};

// Static method to find trees by investor
TreeSchema.statics.findByInvestor = function(investorId) {
  return this.find({
    $or: [
      { investor: investorId },
      { investorId: investorId }
    ],
    healthStatus: { $nin: ['Dead', 'Harvested'] }
  });
};

// Instance method to assign investor
TreeSchema.methods.assignInvestor = async function(investorData) {
  this.investor = investorData._id || investorData.investor;
  this.investorId = investorData.investorId || investorData._id?.toString();
  this.investorName = investorData.name;
  return this.save();
};

// Instance method to unassign investor
TreeSchema.methods.unassignInvestor = async function() {
  this.investor = null;
  this.investorId = null;
  this.investorName = null;
  return this.save();
};

// Instance method to add inoculation
TreeSchema.methods.addInoculation = async function(inoculationData) {
  if (this.inoculationCount >= 2) {
    throw new Error('Maximum inoculations (2) already reached');
  }
  
  this.inoculationCount += 1;
  this.inoculationHistory.push({
    inoculationNumber: this.inoculationCount,
    inoculatedAt: new Date(),
    inoculatedBy: inoculationData.inoculatedBy || 'Unknown',
    notes: inoculationData.notes || ''
  });
  
  // Update lifecycle status
  if (this.inoculationCount === 1) {
    this.lifecycleStatus = 'Inoculated Once';
    this.readyForInoculation = false;
  } else if (this.inoculationCount === 2) {
    this.lifecycleStatus = 'Inoculated Twice';
    this.readyForInoculation = false;
  }
  
  return this.save();
};

// Instance method to mark as harvested
TreeSchema.methods.markAsHarvested = async function(harvestData) {
  this.healthStatus = 'Harvested';
  this.lifecycleStatus = 'Harvested';
  this.harvestData = {
    harvestedAt: new Date(),
    harvestNotes: harvestData.notes || '',
    resinYield: harvestData.resinYield || 0,
    qualityGrade: harvestData.qualityGrade || 'Unassigned',
    certificateGenerated: false,
    certificateId: null
  };
  
  return this.save();
};

module.exports = mongoose.model('Tree', TreeSchema);