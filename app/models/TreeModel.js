const mongoose = require('mongoose');

const TreeSchema = new mongoose.Schema({
  treeId: {
    type: String,
    unique: true,
    required: true
  },

  // ===============================
  // INVESTOR LINK (ONE TREE → ONE INVESTOR)
  // ===============================
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    default: null
  },
  investorName: {
    type: String,
    default: null
  },
  // ===============================
  // ✅ FIX #3: ADD INVESTOR ID FIELD
  // ===============================
  investorId: {
    type: String,
    default: null
  },

  // ===============================
  // BASIC TREE INFO
  // ===============================
  block: {
    type: String,
    required: true,
    enum: ['Block-A', 'Block-B', 'Block-C', 'Block-D', 'Block-E', 'Block-F']
  },

  plantedDate: {
    type: Date,
    default: Date.now
  },

  healthStatus: {
    type: String,
    enum: ['Healthy', 'Warning', 'Damaged', 'Dead', 'Harvested'],
    default: 'Healthy'
  },

  lifecycleStatus: {
    type: String,
    enum: ['Growing', 'Inoculated', 'ReadyForHarvest', 'Harvested'],
    default: 'Growing'
  },

  // ===============================
  // HARVEST DATA
  // ===============================
  harvestData: {
    resinYield: { type: Number, default: 0 },
    qualityGrade: { type: String, default: 'N/A' },
    harvestedBy: { type: String, default: null },
    harvestedAt: { type: Date },
    harvestNotes: { type: String, default: '' }
  },

  // ===============================
  // GPS / LOCATION
  // ===============================
  gps: {
    lat: { type: Number },
    lng: { type: Number }
  },

  // ===============================
  // BLOCKCHAIN STATUS (FULL)
  // ===============================
  blockchain: {
    registered: { type: Boolean, default: false },   // Has tree/certificate been registered
    txHash: String,                                  // Blockchain transaction hash
    registeredAt: Date,                              // Timestamp of registration
    ownerAddress: String,                            // Ethereum address of investor
    metadataURI: String,                             // URI for blockchain metadata
    network: { type: String, default: 'sepolia' }   // Blockchain network
  }
}, { timestamps: true });

/* ======================================
   AUTO TREE ID GENERATION
====================================== */
TreeSchema.pre('save', async function (next) {
  if (this.isNew && !this.treeId) {
    const lastTree = await this.constructor.findOne().sort({ createdAt: -1 });
    const nextNum = lastTree ? parseInt(lastTree.treeId.split('-')[1]) + 1 : 1;
    this.treeId = `TR-${nextNum.toString().padStart(4, '0')}`;
  }
  next();
});

/* ======================================
   ✅ FIX #3 & #4: UPDATE INVESTOR ID WHEN ASSIGNING
====================================== */
TreeSchema.methods.assignInvestor = async function (investor) {
  if (this.investor) {
    throw new Error('Tree already invested');
  }

  this.investor = investor._id;
  this.investorName = investor.name;
  // ✅ Store investor ID for easy display in tables
  this.investorId = investor.investorId;
  await this.save();
};

/* ======================================
   METHOD: REMOVE INVESTOR
====================================== */
TreeSchema.methods.removeInvestor = async function () {
  this.investor = null;
  this.investorName = null;
  this.investorId = null;
  await this.save();
};

/* ======================================
   STATIC: GET AVAILABLE TREES
====================================== */
TreeSchema.statics.getAvailableTrees = function () {
  return this.find({ investor: null });
};

/* ======================================
   ✅ NEW STATIC: FIND BY INVESTOR
====================================== */
TreeSchema.statics.findByInvestor = function (investorId) {
  return this.find({ investor: investorId })
    .select('treeId investor investorId investorName block healthStatus lifecycleStatus')
    .sort({ treeId: 1 });
};

/* ======================================
   ✅ NEW STATIC: POPULATE INVESTOR DETAILS
====================================== */
TreeSchema.statics.populateInvestorInfo = function (trees) {
  return this.populate(trees, {
    path: 'investor',
    select: 'investorId name email phone'
  });
};

/* ======================================
   ✅ NEW STATIC: GET TREE WITH INVESTOR DETAILS
   For Tree Profile Screen (FIX #4)
====================================== */
TreeSchema.statics.getTreeWithInvestor = function (treeId) {
  return this.findOne({ treeId: treeId })
    .populate({
      path: 'investor',
      select: 'investorId name -_id' // Only get ID and name for display
    });
};

/* ======================================
   ✅ NEW METHOD: GET INVESTOR INFO FOR DISPLAY
====================================== */
TreeSchema.methods.getInvestorInfo = function () {
  return {
    investorId: this.investorId,
    investorName: this.investorName,
    hasInvestor: !!this.investor
  };
};

/* ======================================
   ✅ VIRTUAL: DISPLAY INFO FOR TREE PROFILES
====================================== */
TreeSchema.virtual('displayInvestor').get(function() {
  if (!this.investorId || !this.investorName) {
    return 'Not Invested';
  }
  return `${this.investorName} (${this.investorId})`;
});

module.exports = mongoose.model('Tree', TreeSchema);