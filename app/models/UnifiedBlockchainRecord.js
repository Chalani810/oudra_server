// models/UnifiedBlockchainRecord.js - REDESIGNED
const mongoose = require('mongoose');

const unifiedBlockchainRecordSchema = new mongoose.Schema({
  index: { type: Number, required: true, unique: true, index: true },
  timestamp: { type: Number, required: true },
  
  // NEW: Multi-entity support
  entityType: { 
    type: String, 
    enum: ['INVESTOR', 'TREE', 'IOT_DATA', 'AI_GRADE', 'CERTIFICATE', 'GENESIS'],
    required: true,
    index: true
  },
  entityId: { type: String, required: true, index: true },
  
  // Entity-specific data
  entityData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // NEW: Cross-references
  references: {
    investorBlockHash: { type: String, default: null },
    investorBlockNumber: { type: Number, default: null },
    treeBlockHash: { type: String, default: null },
    treeBlockNumber: { type: Number, default: null },
    iotBlockHash: { type: String, default: null },
    iotBlockNumber: { type: Number, default: null },
    aiGradeBlockHash: { type: String, default: null },
    aiGradeBlockNumber: { type: Number, default: null }
  },
  
  // Blockchain core
  previousHash: { type: String, required: true },
  hash: { type: String, required: true, unique: true, index: true },
  merkleRoot: { type: String, required: true },
  nonce: { type: Number, default: 0 },
  difficulty: { type: Number, default: 2 },
  
  // Verification status
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
  
  // Audit trail
  createdBy: { type: String, default: 'SYSTEM' },
  ipAddress: { type: String },
  userAgent: { type: String }
});

// Compound indexes for efficient queries
unifiedBlockchainRecordSchema.index({ entityType: 1, entityId: 1 });
unifiedBlockchainRecordSchema.index({ 'references.investorBlockHash': 1 }, { sparse: true });
unifiedBlockchainRecordSchema.index({ 'references.treeBlockHash': 1 }, { sparse: true });
unifiedBlockchainRecordSchema.index({ timestamp: -1 });

module.exports = mongoose.model('UnifiedBlockchainRecord', unifiedBlockchainRecordSchema);