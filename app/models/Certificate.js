const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    unique: true,
    default: () => `CERT${Date.now()}${Math.floor(Math.random() * 1000)}`
  },
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    required: true
  },
  tree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree'
  },
  type: {
    type: String,
    enum: ['INVESTOR_AUTH', 'TREE_OWNERSHIP', 'HARVEST'],
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
    default: 'ACTIVE'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  data: {
    harvestDetails: {
      resinYield: Number,
      qualityGrade: String,
      harvestedBy: String,
      harvestDate: Date,
      notes: String
    },
    treeDetails: {
      treeId: String,
      block: String,
      species: String,
      age: String
    },
    investorDetails: {
      name: String,
      email: String,
      investment: Number
    }
  },
  qrCodeUrl: String,
  pdfUrl: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
certificateSchema.index({ investor: 1, type: 1 });
certificateSchema.index({ certificateId: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);