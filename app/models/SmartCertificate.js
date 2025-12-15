// models/SmartCertificate.js - NEW
const mongoose = require('mongoose');

const smartCertificateSchema = new mongoose.Schema({
  certificateId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Certificate Type
  type: {
    type: String,
    enum: ['INVESTOR_AUTH', 'TREE_OWNERSHIP', 'RESIN_QUALITY', 'CARBON_CREDIT', 'HARVEST'],
    required: true
  },
  
  // Core Entities
  investorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investor', required: true },
  treeIds: [{ type: String }], // Can certify multiple trees
  
  // Blockchain References (NEW: Links to multiple blocks)
  blockchainAnchors: [{
    blockHash: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    entityType: { type: String, required: true },
    timestamp: { type: Date, required: true }
  }],
  
  // Certificate Data
  certificationData: {
    investorName: String,
    totalInvestment: Number,
    treesOwned: Number,
    certifiedResinGrade: String,
    carbonCredits: Number,
    certificationDate: Date,
    expiryDate: Date,
    certifiedBy: String
  },
  
  // NEW: Verification Metadata
  verificationMetadata: {
    totalBlocksVerified: Number,
    chainIntegrityScore: Number, // 0-100
    lastVerificationDate: Date,
    verificationType: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL', 'THIRD_PARTY']
    },
    verificationStatus: {
      type: String,
      enum: ['VALID', 'EXPIRED', 'REVOKED', 'PENDING'],
      default: 'VALID'
    }
  },
  
  // NEW: Dynamic Certificate Features
  smartFeatures: {
    autoRenewal: { type: Boolean, default: false },
    autoUpdate: { type: Boolean, default: true }, // Update when tree data changes
    notifyOnChanges: { type: Boolean, default: true },
    publiclyViewable: { type: Boolean, default: false }
  },
  
  // NEW: Certificate Evolution History
  versionHistory: [{
    version: Number,
    updatedAt: Date,
    reason: String,
    blockchainHash: String,
    changes: mongoose.Schema.Types.Mixed
  }],
  
  // QR Code Data
  qrCode: {
    data: String, // URL to verification page
    imageBase64: String, // Actual QR image
    generatedAt: Date
  },
  
  // NFT Metadata (for future marketplace)
  nftMetadata: {
    tokenId: String,
    contractAddress: String,
    network: String,
    minted: { type: Boolean, default: false },
    mintedAt: Date,
    owner: String
  },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastVerifiedAt: { type: Date }
});

// Indexes
smartCertificateSchema.index({ certificateId: 1 });
smartCertificateSchema.index({ investorId: 1, type: 1 });
smartCertificateSchema.index({ 'blockchainAnchors.blockHash': 1 });
smartCertificateSchema.index({ status: 1, 'certificationData.expiryDate': 1 });

// Methods
smartCertificateSchema.methods.verify = async function() {
  const UnifiedBlockchainRecord = require('./UnifiedBlockchainRecord');
  
  let validBlocks = 0;
  let totalBlocks = this.blockchainAnchors.length;
  
  for (const anchor of this.blockchainAnchors) {
    const block = await UnifiedBlockchainRecord.findOne({ 
      hash: anchor.blockHash,
      index: anchor.blockNumber
    });
    
    if (block && block.verified) {
      validBlocks++;
    }
  }
  
  const integrityScore = totalBlocks > 0 ? Math.round((validBlocks / totalBlocks) * 100) : 0;
  
  this.verificationMetadata.totalBlocksVerified = validBlocks;
  this.verificationMetadata.chainIntegrityScore = integrityScore;
  this.verificationMetadata.lastVerificationDate = new Date();
  this.lastVerifiedAt = new Date();
  
  if (integrityScore < 100) {
    this.verificationMetadata.verificationStatus = 'PENDING';
  }
  
  await this.save();
  
  return {
    isValid: integrityScore === 100,
    integrityScore,
    validBlocks,
    totalBlocks,
    status: this.verificationMetadata.verificationStatus
  };
};

smartCertificateSchema.methods.addVersion = function(reason, changes, blockchainHash) {
  const newVersion = {
    version: this.versionHistory.length + 1,
    updatedAt: new Date(),
    reason,
    changes,
    blockchainHash
  };
  
  this.versionHistory.push(newVersion);
  this.updatedAt = new Date();
};

module.exports = mongoose.model('SmartCertificate', smartCertificateSchema);