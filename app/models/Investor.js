// models/Investor.js
const mongoose = require('mongoose');

const investorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
  },
  investment: {
    type: Number,
    required: [true, 'Investment amount is required'],
    min: 0,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active',
  },
  
  // Blockchain Integration Fields
  blockchainHash: {
    type: String,
    sparse: true,
    index: true
  },
  blockchainBlockIndex: {
    type: Number,
    default: -1
  },
  lastBlockchainVerification: {
    type: Date
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

investorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for blockchain verification status
investorSchema.virtual('isBlockchainVerified').get(function() {
  return !!this.blockchainHash && this.lastBlockchainVerification;
});

// Static method to get investors with blockchain status
investorSchema.statics.getWithBlockchainStatus = async function() {
  const investors = await this.find().lean();
  return investors.map(investor => ({
    ...investor,
    blockchainStatus: investor.blockchainHash ? 'VERIFIED' : 'PENDING',
    verificationTimestamp: investor.lastBlockchainVerification
  }));
};

module.exports = mongoose.model('Investor', investorSchema);