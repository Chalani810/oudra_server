// app/models/TreeHistory.js - ENHANCED WITH BLOCKCHAIN
const mongoose = require('mongoose');

const TreeHistorySchema = new mongoose.Schema({
  treeId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  actionType: { 
    type: String, 
    enum: ['StatusChange', 'Inoculated', 'Inspection', 'LifecycleUpdate', 'NoteAdded', 'ManualEdit', 'Created', 'Deleted'],
    required: true
  },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  changedBy: { type: String, required: true },
  notes: { type: String },
  device: { type: String, enum: ['mobile', 'web', 'offline-sync', 'system'], default: 'mobile' },
  
  // 🔐 BLOCKCHAIN FIELDS (NEW)
  recordHash: {
    type: String,
    index: true,
    sparse: true // Allow null for legacy records
  },
  previousHash: {
    type: String,
    default: '0'
  },
  blockNumber: {
    type: Number,
    index: true,
    sparse: true
  },
  isVerified: {
    type: Boolean,
    default: true
  }
});

// Indexes for blockchain verification
TreeHistorySchema.index({ treeId: 1, timestamp: -1 });
TreeHistorySchema.index({ blockNumber: 1 });
TreeHistorySchema.index({ recordHash: 1 }, { sparse: true });

// Static method to get last block
TreeHistorySchema.statics.getLastBlock = async function() {
  return await this.findOne({ blockNumber: { $exists: true } })
    .sort({ blockNumber: -1 })
    .select('recordHash blockNumber timestamp')
    .lean();
};

// Static method to verify chain integrity
TreeHistorySchema.statics.verifyChainIntegrity = async function(treeId = null) {
  const query = treeId ? { treeId, blockNumber: { $exists: true } } : { blockNumber: { $exists: true } };
  const records = await this.find(query).sort({ blockNumber: 1 });
  
  if (records.length === 0) {
    return { isValid: true, totalBlocks: 0 };
  }
  
  for (let i = 1; i < records.length; i++) {
    if (records[i].previousHash !== records[i - 1].recordHash) {
      return {
        isValid: false,
        brokenAt: records[i].blockNumber,
        details: `Hash chain broken at block ${records[i].blockNumber}`
      };
    }
  }
  
  return { 
    isValid: true, 
    totalBlocks: records.length,
    firstBlock: records[0].blockNumber,
    lastBlock: records[records.length - 1].blockNumber
  };
};

module.exports = mongoose.model('TreeHistory', TreeHistorySchema);