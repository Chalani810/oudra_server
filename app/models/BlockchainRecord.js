const mongoose = require('mongoose');

const blockchainRecordSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
    unique: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  data: {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investor',
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'ACCESS', 'GENESIS'],
      required: true,
    },
    dataHash: {
      type: String,
      required: true,
    },
  },
  previousHash: {
    type: String,
    required: true,
  },
  hash: {
    type: String,
    required: true,
    unique: true,
  },
  nonce: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('BlockchainRecord', blockchainRecordSchema);