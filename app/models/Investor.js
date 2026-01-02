// path: models/Investor.js
const mongoose = require('mongoose');

const InvestorTreeInvestmentSchema = new mongoose.Schema({
  tree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree',
    required: true
  },
  treeId: {
    type: String,
    required: true
  },
  investmentDate: {
    type: Date,
    default: Date.now
  },
  amountAllocated: {
    type: Number,
    default: 0,
    min: [0, 'Amount allocated cannot be negative']
  },
  investmentType: {
    type: String,
    enum: ['full', 'partial', 'shared'],
    default: 'full'
  },
  ownershipPercentage: {
    type: Number,
    default: 100,
    min: [0, 'Ownership percentage cannot be negative'],
    max: [100, 'Ownership percentage cannot exceed 100']
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'transferred', 'inactive'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  _id: true,
  timestamps: true
});

const InvestorCertificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true
  },
  certificateNumber: {
    type: String,
    required: true,
    unique: true
  },
  treeId: {
    type: String,
    required: true
  },
  treeObjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  type: {
    type: String,
    enum: ['INVESTOR_AUTH', 'TREE_OWNERSHIP', 'HARVEST', 'RESIN_QUALITY', 'CARBON_CREDIT'],
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING'],
    default: 'ACTIVE'
  },
  verificationHash: {
    type: String
  },
  metadata: {
    chainIntegrityScore: { type: Number, min: 0, max: 100 },
    lastVerified: Date,
    verifiedBy: String,
    blockchainTxId: String
  },
  documentUrl: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  _id: true,
  timestamps: true
});

const InvestorSchema = new mongoose.Schema({
  investorId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Investor name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  nationality: {
    type: String,
    trim: true
  },
  idNumber: {
    type: String,
    trim: true
  },
  idType: {
    type: String,
    enum: ['passport', 'national_id', 'driver_license', 'other']
  },
  taxId: {
    type: String,
    trim: true
  },
  investment: {
    totalInvestment: {
      type: Number,
      required: [true, 'Total investment amount is required'],
      min: [0, 'Total investment cannot be negative'],
      default: 0
    },
    availableBalance: {
      type: Number,
      min: [0, 'Available balance cannot be negative'],
      default: 0
    },
    investedAmount: {
      type: Number,
      min: [0, 'Invested amount cannot be negative'],
      default: 0
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_verification', 'suspended'],
    default: 'active'
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  investedTrees: [InvestorTreeInvestmentSchema],
  certificates: [InvestorCertificateSchema],
  
  // Contact person (if different from investor)
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    relationship: String
  },
  
  // Bank details for payments
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    branch: String,
    swiftCode: String,
    iban: String
  },
  
  // Investment preferences
  preferences: {
    preferredTreeTypes: [String],
    minimumROI: Number,
    riskTolerance: String,
    investmentHorizon: String, // short, medium, long
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  },
  
  // Performance tracking
  performance: {
    totalROI: { type: Number, default: 0 },
    annualROI: { type: Number, default: 0 },
    lastDividendPayment: Date,
    totalDividendsPaid: { type: Number, default: 0 }
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for tree count
InvestorSchema.virtual('treeCount').get(function() {
  return this.investedTrees ? this.investedTrees.length : 0;
});

// Virtual for active trees count
InvestorSchema.virtual('activeTreeCount').get(function() {
  if (!this.investedTrees) return 0;
  return this.investedTrees.filter(tree => tree.status === 'active').length;
});

// Virtual for certificate count
InvestorSchema.virtual('certificateCount').get(function() {
  return this.certificates ? this.certificates.length : 0;
});

// Virtual for active certificates count
InvestorSchema.virtual('activeCertificateCount').get(function() {
  if (!this.certificates) return 0;
  return this.certificates.filter(cert => cert.status === 'ACTIVE').length;
});

// Virtual for total tree value
InvestorSchema.virtual('totalTreeValue').get(function() {
  if (!this.investedTrees) return 0;
  return this.investedTrees.reduce((total, tree) => total + (tree.amountAllocated || 0), 0);
});

// Pre-save middleware to generate investor ID
InvestorSchema.pre('save', async function(next) {
  if (this.isNew && !this.investorId) {
    const lastInvestor = await this.constructor.findOne(
      { investorId: /^INV-/ },
      { investorId: 1 },
      { sort: { investorId: -1 } }
    ).exec();
    
    let nextNumber = 1;
    if (lastInvestor && lastInvestor.investorId) {
      const lastNum = parseInt(lastInvestor.investorId.split('-')[1]);
      nextNumber = isNaN(lastNum) ? 1 : lastNum + 1;
    }
    
    this.investorId = `INV-${nextNumber.toString().padStart(5, '0')}`;
  }
  
  // Update investment totals
  if (this.investedTrees && this.isModified('investedTrees')) {
    this.investment.investedAmount = this.investedTrees.reduce(
      (sum, tree) => sum + (tree.amountAllocated || 0), 0
    );
    this.investment.availableBalance = this.investment.totalInvestment - this.investment.investedAmount;
  }
  
  next();
});

// Indexes for better query performance
InvestorSchema.index({ investorId: 1 }, { unique: true, sparse: true });
InvestorSchema.index({ email: 1 }, { unique: true });
InvestorSchema.index({ phone: 1 });
InvestorSchema.index({ status: 1 });
InvestorSchema.index({ 'investedTrees.tree': 1 });
InvestorSchema.index({ 'investedTrees.treeId': 1 });
InvestorSchema.index({ 'certificates.certificateId': 1 }, { unique: true, sparse: true });
InvestorSchema.index({ 'certificates.treeId': 1 });
InvestorSchema.index({ 'certificates.status': 1 });
InvestorSchema.index({ createdAt: -1 });

// Static method to find investors by tree
InvestorSchema.statics.findByTreeId = function(treeId) {
  return this.find({
    'investedTrees.treeId': treeId,
    'investedTrees.status': 'active'
  });
};

// Static method to find investors with active certificates
InvestorSchema.statics.findWithActiveCertificates = function() {
  return this.find({
    'certificates.status': 'ACTIVE'
  });
};

// Instance method to add tree investment
InvestorSchema.methods.addTreeInvestment = function(treeData) {
  const existingInvestment = this.investedTrees.find(
    investment => investment.treeId === treeData.treeId
  );
  
  if (existingInvestment) {
    throw new Error(`Tree ${treeData.treeId} is already invested by this investor`);
  }
  
  // Check if there's enough available balance
  const allocationAmount = treeData.amountAllocated || 0;
  if (allocationAmount > this.investment.availableBalance) {
    throw new Error(`Insufficient balance. Available: ${this.investment.availableBalance}, Required: ${allocationAmount}`);
  }
  
  this.investedTrees.push(treeData);
  return this.save();
};

// Instance method to remove tree investment
InvestorSchema.methods.removeTreeInvestment = function(treeId) {
  const investmentIndex = this.investedTrees.findIndex(
    investment => investment.treeId === treeId
  );
  
  if (investmentIndex === -1) {
    throw new Error(`No investment found for tree ${treeId}`);
  }
  
  const removedInvestment = this.investedTrees[investmentIndex];
  this.investedTrees.splice(investmentIndex, 1);
  
  // Restore available balance
  this.investment.availableBalance += removedInvestment.amountAllocated || 0;
  this.investment.investedAmount -= removedInvestment.amountAllocated || 0;
  
  return this.save();
};

// Instance method to update tree investment
InvestorSchema.methods.updateTreeInvestment = function(treeId, updates) {
  const investment = this.investedTrees.find(inv => inv.treeId === treeId);
  
  if (!investment) {
    throw new Error(`No investment found for tree ${treeId}`);
  }
  
  // If amount is being updated, adjust balances
  if (updates.amountAllocated !== undefined) {
    const amountDifference = updates.amountAllocated - investment.amountAllocated;
    
    if (amountDifference > this.investment.availableBalance) {
      throw new Error(`Insufficient balance. Available: ${this.investment.availableBalance}, Required: ${amountDifference}`);
    }
    
    this.investment.availableBalance -= amountDifference;
    this.investment.investedAmount += amountDifference;
  }
  
  Object.assign(investment, updates);
  return this.save();
};

// Instance method to add certificate
InvestorSchema.methods.addCertificate = function(certificateData) {
  const existingCertificate = this.certificates.find(
    cert => cert.certificateId === certificateData.certificateId
  );
  
  if (existingCertificate) {
    throw new Error(`Certificate ${certificateData.certificateId} already exists`);
  }
  
  this.certificates.push(certificateData);
  return this.save();
};

// Instance method to update certificate
InvestorSchema.methods.updateCertificate = function(certificateId, updates) {
  const certificate = this.certificates.find(cert => cert.certificateId === certificateId);
  
  if (!certificate) {
    throw new Error(`Certificate ${certificateId} not found`);
  }
  
  Object.assign(certificate, updates);
  return this.save();
};

module.exports = mongoose.model('Investor', InvestorSchema);