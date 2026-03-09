// app/models/Investor.js
const mongoose = require('mongoose');

// ===============================
// INVESTED TREE SCHEMA
// ===============================
const InvestorTreeSchema = new mongoose.Schema({
  tree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree',
    required: true
  },
  treeId: {
    type: String,
    required: true
  },
  investedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// ===============================
// CERTIFICATE REFERENCE SCHEMA
// ===============================
const CertificateRefSchema = new mongoose.Schema({
  certificate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate',
    required: true
  },
  certificateId: {
    type: String,
    required: true
  },
  certificateNumber: {
    type: String
  },
  type: {
    type: String,
    enum: ['HARVEST', 'TREE_OWNERSHIP', 'PLANTATION', 'GROWTH'],
    default: 'HARVEST'
  },
  issuedDate: {
    type: Date,
    default: Date.now
  },
  treeCount: {
    type: Number,
    default: 0
  },
  totalResinYield: {
    type: Number,
    default: 0
  },
  blockchainTxHash: {
    type: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
    default: 'ACTIVE'
  }
}, { _id: false });

// ===============================
// INVESTOR SCHEMA
// ===============================
const InvestorSchema = new mongoose.Schema({
  investorId: {
    type: String,
    unique: true
  },

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  phone: {
    type: String,
    required: true
  },

  investment: {
    type: Number,
    default: 0,
    min: 0
  },

  // ===============================
  // INVESTED TREES LIST
  // ===============================
  investedTrees: [InvestorTreeSchema],

  // ===============================
  // CERTIFICATES LIST
  // ===============================
  certificates: [CertificateRefSchema],

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  // ===============================
  // BLOCKCHAIN FIELDS
  // ===============================
  blockchainTxHash: {
    type: String,
    default: null
  },
  blockchainHash: {
    type: String,
    default: null
  },
  blockchainRecorded: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

/* ======================================
   AUTO INVESTOR ID
====================================== */
InvestorSchema.pre('save', async function (next) {
  if (this.isNew && !this.investorId) {
    const last = await this.constructor.findOne().sort({ createdAt: -1 });
    const nextNum = last ? parseInt(last.investorId.split('-')[1]) + 1 : 1;
    this.investorId = `INV-${nextNum.toString().padStart(4, '0')}`;
  }
  next();
});

/* ======================================
   VIRTUAL: HARVESTED TREES COUNT
====================================== */
InvestorSchema.virtual('harvestedTreesCount').get(function() {
  return this.certificates.reduce((sum, cert) => sum + cert.treeCount, 0);
});

/* ======================================
   VIRTUAL: TOTAL RESIN YIELD
====================================== */
InvestorSchema.virtual('totalResinYield').get(function() {
  return this.certificates.reduce((sum, cert) => sum + cert.totalResinYield, 0);
});

/* ======================================
   METHOD: ADD TREE
====================================== */
InvestorSchema.methods.addTree = async function (tree) {
  const exists = this.investedTrees.find(t => t.tree.toString() === tree._id.toString());
  if (exists) {
    throw new Error('Tree already added to investor');
  }
  this.investedTrees.push({ tree: tree._id, treeId: tree.treeId });
  await this.save();
};

/* ======================================
   METHOD: REMOVE TREE
====================================== */
InvestorSchema.methods.removeTree = async function (treeId) {
  this.investedTrees = this.investedTrees.filter(t => t.treeId !== treeId);
  await this.save();
};

/* ======================================
   METHOD: ADD CERTIFICATE
====================================== */
InvestorSchema.methods.addCertificate = async function (certificate, treeCount, totalResinYield) {
  const exists = this.certificates.find(
    c => c.certificate.toString() === certificate._id.toString()
  );
  if (exists) throw new Error('Certificate already added to investor');

  this.certificates.push({
    certificate:       certificate._id,
    certificateId:     certificate.certificateId,
    certificateNumber: certificate.certificateNumber,
    type:              certificate.type,
    issuedDate:        certificate.issueDate,
    treeCount:         treeCount || 0,
    totalResinYield:   totalResinYield || 0,
    blockchainTxHash:  certificate.blockchain?.transactionHash,
    status:            certificate.status
  });

  await this.save();
};

/* ======================================
   STATIC: FIND WITH CERTIFICATES
====================================== */
InvestorSchema.statics.findWithCertificates = function(investorId) {
  return this.findById(investorId)
    .populate('investedTrees.tree')
    .populate('certificates.certificate');
};

module.exports = mongoose.model('Investor', InvestorSchema);