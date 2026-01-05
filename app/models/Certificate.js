const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  // ========================================
  // CERTIFICATE IDENTIFICATION
  // ========================================
  certificateId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    index: true,
    default: () => `CERT${Date.now()}${Math.floor(Math.random() * 1000)}`
  },

  certificateNumber: {
    type: String,
    unique: true,
    sparse: true
  },

  // ========================================
  // REFERENCES
  // ========================================
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    required: true,
    index: true
  },

  tree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree',
    index: true
  },

  // ========================================
  // CERTIFICATE TYPE & STATUS
  // ========================================
  type: {
    type: String,
    enum: ['INVESTOR_AUTH', 'TREE_OWNERSHIP', 'HARVEST', 'PLANTATION', 'GROWTH', 'MAINTENANCE'],
    required: true,
    index: true
  },

  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'TRANSFERRED'],
    default: 'ACTIVE',
    index: true
  },

  // ========================================
  // BLOCKCHAIN INTEGRATION
  // ========================================
  blockchain: {
    ownerAddress: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'Invalid Ethereum address'
      }
    },
    transactionHash: { type: String, unique: true, sparse: true },
    blockNumber: Number,
    gasUsed: String,
    metadataURI: String,
    network: { type: String, enum: ['mainnet', 'sepolia', 'goerli', 'localhost'], default: process.env.BLOCKCHAIN_NETWORK || 'sepolia' },
    onChain: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false },
    revokedAt: Date,
    transferHistory: [{
      fromAddress: { type: String, lowercase: true },
      toAddress: { type: String, lowercase: true },
      transactionHash: String,
      transferredAt: { type: Date, default: Date.now }
    }],
    verificationCount: { type: Number, default: 0 },
    lastVerifiedAt: Date
  },

  // ========================================
  // DATES
  // ========================================
  issueDate: { type: Date, default: Date.now, index: true },
  expiryDate: Date,
  issuedBy: { type: String, trim: true },

  // ========================================
  // CERTIFICATE DATA
  // ========================================
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
      age: String,
      location: { latitude: Number, longitude: Number, address: String },
      plantedDate: Date,
      height: Number,
      diameter: Number,
      healthStatus: String
    },
    investorDetails: {
      name: String,
      email: String,
      phone: String,
      investment: Number,
      walletAddress: String
    }
  },

  // ========================================
  // VISUAL ASSETS
  // ========================================
  qrCodeUrl: String,
  pdfUrl: String,

  // ========================================
  // ADDITIONAL METADATA
  // ========================================
  metadata: mongoose.Schema.Types.Mixed,
  notes: String,
  tags: [String]
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ========================================
// VIRTUALS
// ========================================
certificateSchema.virtual('blockchainExplorerUrl').get(function() {
  if (!this.blockchain?.transactionHash) return null;
  const explorers = {
    mainnet: 'https://etherscan.io',
    sepolia: 'https://sepolia.etherscan.io',
    goerli: 'https://goerli.etherscan.io',
    localhost: 'http://localhost:8545'
  };
  const network = this.blockchain.network || 'sepolia';
  return `${explorers[network]}/tx/${this.blockchain.transactionHash}`;
});

certificateSchema.virtual('ageInDays').get(function() {
  return Math.ceil((new Date() - new Date(this.issueDate)) / (1000 * 60 * 60 * 24));
});

certificateSchema.virtual('isExpired').get(function() {
  return this.expiryDate ? new Date() > new Date(this.expiryDate) : false;
});

// ========================================
// INSTANCE METHODS
// ========================================
certificateSchema.methods.markOnChain = function(transactionHash, blockNumber, ownerAddress, gasUsed) {
  this.blockchain = this.blockchain || {};
  this.blockchain.onChain = true;
  this.blockchain.transactionHash = transactionHash;
  this.blockchain.blockNumber = blockNumber;
  this.blockchain.ownerAddress = ownerAddress.toLowerCase();
  this.blockchain.gasUsed = gasUsed;
  this.status = 'ACTIVE';
  return this.save();
};

certificateSchema.methods.revoke = function(reason) {
  this.status = 'REVOKED';
  if (this.blockchain) {
    this.blockchain.isRevoked = true;
    this.blockchain.revokedAt = new Date();
  }
  if (reason) this.notes = (this.notes ? this.notes + '\n' : '') + `Revoked: ${reason}`;
  return this.save();
};

certificateSchema.methods.recordTransfer = function(fromAddress, toAddress, txHash) {
  this.blockchain = this.blockchain || {};
  this.blockchain.transferHistory = this.blockchain.transferHistory || [];
  this.blockchain.transferHistory.push({ fromAddress: fromAddress.toLowerCase(), toAddress: toAddress.toLowerCase(), transactionHash: txHash });
  this.blockchain.ownerAddress = toAddress.toLowerCase();
  this.status = 'TRANSFERRED';
  return this.save();
};

certificateSchema.methods.recordVerification = function() {
  this.blockchain = this.blockchain || {};
  this.blockchain.verificationCount = (this.blockchain.verificationCount || 0) + 1;
  this.blockchain.lastVerifiedAt = new Date();
  return this.save();
};

// ========================================
// STATIC METHODS
// ========================================
certificateSchema.statics.findByInvestor = function(investorId) {
  return this.find({ investor: investorId, status: { $ne: 'REVOKED' } })
    .populate('investor').populate('tree').sort({ issueDate: -1 });
};

certificateSchema.statics.findByOwnerAddress = function(ownerAddress) {
  return this.find({ 'blockchain.ownerAddress': ownerAddress.toLowerCase(), status: { $ne: 'REVOKED' } })
    .populate('investor').populate('tree').sort({ issueDate: -1 });
};

certificateSchema.statics.findOnChain = function() {
  return this.find({ 'blockchain.onChain': true, status: 'ACTIVE' })
    .populate('investor').populate('tree').sort({ issueDate: -1 });
};

certificateSchema.statics.findByTree = function(treeId) {
  return this.find({ tree: treeId }).populate('investor').populate('tree').sort({ issueDate: -1 });
};

certificateSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const active = await this.countDocuments({ status: 'ACTIVE' });
  const onChain = await this.countDocuments({ 'blockchain.onChain': true });
  const revoked = await this.countDocuments({ status: 'REVOKED' });
  const expired = await this.countDocuments({ expiryDate: { $lt: new Date() }, status: 'ACTIVE' });
  return {
    total, active, onChain, revoked, expired,
    onChainPercentage: total ? ((onChain / total) * 100).toFixed(2) : 0,
    activePercentage: total ? ((active / total) * 100).toFixed(2) : 0
  };
};

// Generate certificate number
certificateSchema.statics.generateCertificateNumber = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments();
  return `CERT-${year}-${String(count + 1).padStart(6, '0')}`;
};

// ========================================
// MIDDLEWARE
// ========================================
certificateSchema.pre('save', async function(next) {
  if (this.isNew && !this.certificateNumber) {
    this.certificateNumber = await this.constructor.generateCertificateNumber();
  }
  next();
});

certificateSchema.pre('save', function(next) {
  if (this.blockchain?.ownerAddress) {
    if (!this.blockchain.ownerAddress.startsWith('0x')) {
      this.blockchain.ownerAddress = '0x' + this.blockchain.ownerAddress;
    }
    this.blockchain.ownerAddress = this.blockchain.ownerAddress.toLowerCase();
  }
  next();
});

const Certificate = mongoose.model('Certificate', certificateSchema);
module.exports = Certificate;
