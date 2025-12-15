// controllers/blockchainController.js - REDESIGNED (COMPLETE)
const UnifiedBlock = require('../blockchain/UnifiedBlock');
const UnifiedBlockchainRecord = require('../models/UnifiedBlockchainRecord');
const SmartCertificate = require('../models/SmartCertificate');
const ValidatorNetwork = require('../blockchain/ValidatorNetwork');
const Investor = require('../models/Investor');
const Tree = require('../models/TreeModel');

// Initialize validator network
const validatorNetwork = new ValidatorNetwork();

// Register system validators (in production, load from database)
validatorNetwork.registerValidator(
  '0xSYSTEM123', 
  'PUBLIC_KEY_1', 
  'SYSTEM',
  1000
);
validatorNetwork.registerValidator(
  '0xADMIN456',
  'PUBLIC_KEY_2',
  'ADMIN',
  950
);
validatorNetwork.registerValidator(
  '0xAUDITOR789',
  'PUBLIC_KEY_3',
  'AUDITOR',
  900
);

// Enhanced blockchain class
class EnhancedBlockchain {
  constructor() {
    this.chain = [];
    this.difficulty = 2;
    this.validators = validatorNetwork;
  }

  async initialize() {
    const blocks = await UnifiedBlockchainRecord.find().sort({ index: 1 });
    
    if (blocks.length === 0) {
      await this.createGenesisBlock();
    } else {
      this.chain = blocks.map(block => {
        const b = new UnifiedBlock(
          block.index,
          block.timestamp,
          block.entityType,
          block.entityData,
          block.references,
          block.previousHash
        );
        b.hash = block.hash;
        b.merkleRoot = block.merkleRoot;
        b.nonce = block.nonce;
        return b;
      });
    }
    
    console.log(`⛓️ Blockchain initialized: ${this.chain.length} blocks`);
  }

  async createGenesisBlock() {
    const genesisBlock = new UnifiedBlock(
      0,
      Date.now(),
      'GENESIS',
      { action: 'GENESIS_BLOCK', message: 'Agarwood Blockchain v2.0' },
      {},
      '0'
    );
    
    genesisBlock.mineBlock(this.difficulty);
    
    await UnifiedBlockchainRecord.create({
      index: genesisBlock.index,
      timestamp: genesisBlock.timestamp,
      entityType: genesisBlock.entityType,
      entityId: 'GENESIS',
      entityData: genesisBlock.entityData,
      references: genesisBlock.references,
      previousHash: genesisBlock.previousHash,
      hash: genesisBlock.hash,
      merkleRoot: genesisBlock.merkleRoot,
      nonce: genesisBlock.nonce,
      verified: true
    });
    
    this.chain.push(genesisBlock);
    console.log('🌱 Genesis block created');
  }

  // NEW: Add block with validator consensus
  async addBlockWithConsensus(entityType, entityData, references, proposerAddress = '0xSYSTEM123') {
    const newBlock = new UnifiedBlock(
      this.chain.length,
      Date.now(),
      entityType,
      entityData,
      references,
      this.getLatestBlock().hash
    );
    
    newBlock.mineBlock(this.difficulty);
    
    // Get validator consensus
    const proposal = await this.validators.proposeBlock(newBlock, proposerAddress);
    
    if (proposal.status !== 'APPROVED') {
      throw new Error(`Consensus failed: ${proposal.consensusResult.approvals}/${proposal.consensusResult.total} approved`);
    }
    
    // Save to database
    const savedBlock = await UnifiedBlockchainRecord.create({
      index: newBlock.index,
      timestamp: newBlock.timestamp,
      entityType: newBlock.entityType,
      entityId: newBlock.entityId,
      entityData: newBlock.entityData,
      references: newBlock.references,
      previousHash: newBlock.previousHash,
      hash: newBlock.hash,
      merkleRoot: newBlock.merkleRoot,
      nonce: newBlock.nonce,
      difficulty: this.difficulty,
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: proposal.consensusResult.total + ' validators'
    });
    
    this.chain.push(newBlock);
    
    console.log(`✅ Block #${newBlock.index} added with consensus (${proposal.consensusResult.approvals}/${proposal.consensusResult.total})`);
    
    return {
      block: savedBlock,
      consensus: proposal.consensusResult
    };
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async verifyChainIntegrity() {
    const issues = [];
    
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        issues.push({
          blockIndex: i,
          type: 'HASH_MISMATCH',
          message: 'Block hash does not match calculated hash'
        });
      }

      // Check chain link
      if (currentBlock.previousHash !== previousBlock.hash) {
        issues.push({
          blockIndex: i,
          type: 'CHAIN_BREAK',
          message: 'Previous hash does not match'
        });
      }

      // Check Merkle root
      if (currentBlock.merkleRoot !== currentBlock.calculateMerkleRoot()) {
        issues.push({
          blockIndex: i,
          type: 'MERKLE_INVALID',
          message: 'Merkle root mismatch'
        });
      }
    }
    
    return {
      isValid: issues.length === 0,
      totalBlocks: this.chain.length,
      issues
    };
  }

  async getBlockByEntityId(entityType, entityId) {
    const blockRecord = await UnifiedBlockchainRecord.findOne({
      entityType,
      entityId
    }).sort({ index: -1 });
    
    if (!blockRecord) return null;
    
    const block = new UnifiedBlock(
      blockRecord.index,
      blockRecord.timestamp,
      blockRecord.entityType,
      blockRecord.entityData,
      blockRecord.references,
      blockRecord.previousHash
    );
    block.hash = blockRecord.hash;
    block.merkleRoot = blockRecord.merkleRoot;
    block.nonce = blockRecord.nonce;
    
    return block;
  }

  async getChainHistory(entityType, entityId) {
    const blockRecords = await UnifiedBlockchainRecord.find({
      entityType,
      entityId
    }).sort({ index: 1 });
    
    return blockRecords.map(record => ({
      index: record.index,
      timestamp: record.timestamp,
      entityType: record.entityType,
      entityData: record.entityData,
      hash: record.hash,
      verified: record.verified
    }));
  }

  getChainData() {
    return this.chain.map(block => ({
      index: block.index,
      entityType: block.entityType,
      entityId: block.entityId,
      timestamp: block.timestamp,
      hash: block.hash,
      previousHash: block.previousHash
    }));
  }
}

// Create singleton
const blockchain = new EnhancedBlockchain();

// Initialize on startup
(async () => {
  try {
    await blockchain.initialize();
    console.log('🚀 Blockchain successfully initialized');
  } catch (error) {
    console.error('❌ Failed to initialize blockchain:', error.message);
  }
})();

// API Endpoints
const createInvestorBlock = async (req, res) => {
  try {
    const investor = req.body;
    
    const result = await blockchain.addBlockWithConsensus(
      'INVESTOR',
      {
        id: investor._id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investment: investor.investment,
        status: investor.status,
        action: req.body.action || 'CREATE'
      },
      {},
      req.body.proposerAddress || '0xSYSTEM123'
    );
    
    res.json({
      success: true,
      block: result.block,
      consensus: result.consensus
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createTreeBlock = async (req, res) => {
  try {
    const tree = req.body;
    
    // Find investor's latest block
    const investorBlock = await UnifiedBlockchainRecord.findOne({
      entityType: 'INVESTOR',
      entityId: tree.investorId
    }).sort({ index: -1 });
    
    const result = await blockchain.addBlockWithConsensus(
      'TREE',
      {
        id: tree.treeId,
        investorId: tree.investorId,
        investorName: tree.investorName,
        block: tree.block,
        healthStatus: tree.healthStatus,
        lifecycleStatus: tree.lifecycleStatus,
        plantedDate: tree.plantedDate,
        action: req.body.action || 'CREATE'
      },
      {
        investorBlockHash: investorBlock?.hash,
        investorBlockNumber: investorBlock?.index
      }
    );
    
    res.json({
      success: true,
      block: result.block,
      consensus: result.consensus
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateSmartCertificate = async (req, res) => {
  try {
    const { investorId, treeIds, certificateType, certifiedBy } = req.body;
    
    // Validate required fields
    if (!investorId || !treeIds || !Array.isArray(treeIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'investorId and treeIds array are required' 
      });
    }
    
    // Find all relevant blocks
    const investorBlock = await UnifiedBlockchainRecord.findOne({
      entityType: 'INVESTOR',
      entityId: investorId
    }).sort({ index: -1 });
    
    if (!investorBlock) {
      return res.status(404).json({ 
        success: false, 
        error: `Investor ${investorId} not found in blockchain` 
      });
    }
    
    // Find tree blocks
    const treeBlocks = await UnifiedBlockchainRecord.find({
      entityType: 'TREE',
      entityId: { $in: treeIds }
    }).sort({ index: -1 });
    
    // Verify all trees exist in blockchain
    if (treeBlocks.length !== treeIds.length) {
      const missingTrees = treeIds.filter(treeId => 
        !treeBlocks.some(block => block.entityId === treeId)
      );
      
      return res.status(404).json({ 
        success: false, 
        error: `Some trees not found in blockchain: ${missingTrees.join(', ')}` 
      });
    }
    
    // Create blockchain anchors array
    const anchors = [
      {
        blockHash: investorBlock.hash,
        blockNumber: investorBlock.index,
        entityType: 'INVESTOR',
        entityId: investorId,
        timestamp: new Date(investorBlock.timestamp)
      },
      ...treeBlocks.map(tb => ({
        blockHash: tb.hash,
        blockNumber: tb.index,
        entityType: 'TREE',
        entityId: tb.entityId,
        timestamp: new Date(tb.timestamp),
        treeData: tb.entityData // Include tree data from blockchain
      }))
    ];
    
    // Get investor data from database
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ 
        success: false, 
        error: `Investor ${investorId} not found in database` 
      });
    }
    
    // Get trees data from database
    const trees = await Tree.find({ treeId: { $in: treeIds } });
    
    // Calculate total investment value from trees
    const treeInvestmentValue = trees.reduce((sum, tree) => {
      return sum + (tree.estimatedValue || 5000); // Default $5000 per tree
    }, 0);
    
    // Generate certificate ID
    const certificateId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Create certificate
    const certificate = new SmartCertificate({
      certificateId, // Explicitly set certificateId
      type: certificateType || 'INVESTOR_AUTH',
      investorId,
      investorName: investor.name,
      treeIds,
      blockchainAnchors: anchors,
      certificationData: {
        investorName: investor.name,
        investorEmail: investor.email,
        investorPhone: investor.phone,
        investorAddress: investor.address,
        totalInvestment: investor.investment || treeInvestmentValue,
        treesOwned: trees.length,
        treeDetails: trees.map(tree => ({
          treeId: tree.treeId,
          block: tree.block,
          plantedDate: tree.plantedDate,
          healthStatus: tree.healthStatus,
          lifecycleStatus: tree.lifecycleStatus,
          estimatedValue: tree.estimatedValue || 5000
        })),
        location: trees.length > 0 ? `Block ${trees[0].block || 'A-7'}, Plantation Zone` : 'Plantation Zone',
        carbonCredits: trees.length * 25, // 25 tons per tree per year
        certifiedResinGrade: 'AAA+ Premium Quality',
        certificationDate: new Date(),
        expiryDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        certifiedBy: certifiedBy || 'SYSTEM'
      },
      verificationMetadata: {
        totalBlocksVerified: anchors.length,
        chainIntegrityScore: 100,
        lastVerificationDate: new Date(),
        verificationType: 'AUTOMATIC',
        verificationStatus: 'VALID',
        verificationUrl: `https://verify.forestchain.com/${certificateId}`
      },
      versionHistory: [{
        version: 1.0,
        updatedAt: new Date(),
        updatedBy: certifiedBy || 'SYSTEM',
        reason: 'Certificate created',
        blockchainHash: '' // Will be updated after block creation
      }],
      smartFeatures: {
        autoUpdate: true,
        notifyOnChanges: true,
        publiclyViewable: true,
        allowTransfer: true,
        expiryNotifications: true
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await certificate.save();
    
    // Add certificate to blockchain
    const certBlock = await blockchain.addBlockWithConsensus(
      'CERTIFICATE',
      {
        id: certificate.certificateId,
        investorId: investor._id,
        investorName: investor.name,
        treeIds,
        type: certificate.type,
        certificationData: certificate.certificationData,
        blockchainAnchors: anchors.map(a => a.blockHash),
        action: 'ISSUE',
        timestamp: new Date()
      },
      {
        investorBlockHash: investorBlock.hash,
        investorBlockNumber: investorBlock.index,
        treeBlockHashes: treeBlocks.map(tb => tb.hash)
      },
      certifiedBy || '0xSYSTEM123' // Proposer address
    );
    
    // Update certificate with blockchain hash
    certificate.versionHistory[0].blockchainHash = certBlock.block.hash;
    certificate.blockchainAnchors.push({
      blockHash: certBlock.block.hash,
      blockNumber: certBlock.block.index,
      entityType: 'CERTIFICATE',
      entityId: certificate.certificateId,
      timestamp: new Date()
    });
    
    await certificate.save();
    
    // Optional: Generate NFT metadata
    if (req.body.generateNFT === true) {
      const nftMetadata = {
        tokenId: `NFT-${certificate.certificateId}`,
        contractAddress: '0xForestTokenContract',
        metadataUri: `https://api.forestchain.com/nft/${certificate.certificateId}`,
        mintedAt: new Date(),
        mintedBy: certifiedBy || 'SYSTEM'
      };
      
      certificate.nftMetadata = nftMetadata;
      await certificate.save();
    }
    
    // Return complete response
    res.json({
      success: true,
      message: 'Smart certificate generated successfully',
      certificate: {
        certificateId: certificate.certificateId,
        type: certificate.type,
        investorId: certificate.investorId,
        investorName: certificate.investorName,
        treeIds: certificate.treeIds,
        certificationData: certificate.certificationData,
        blockchainAnchors: certificate.blockchainAnchors.map(anchor => ({
          blockNumber: anchor.blockNumber,
          entityType: anchor.entityType,
          entityId: anchor.entityId,
          timestamp: anchor.timestamp
        })),
        verificationMetadata: certificate.verificationMetadata,
        versionHistory: certificate.versionHistory,
        smartFeatures: certificate.smartFeatures,
        status: certificate.status,
        createdAt: certificate.createdAt,
        updatedAt: certificate.updatedAt,
        nftMetadata: certificate.nftMetadata || null
      },
      blockchain: {
        blockNumber: certBlock.block.index,
        blockHash: certBlock.block.hash,
        consensus: certBlock.consensus,
        timestamp: new Date()
      },
      trees: trees.map(tree => ({
        treeId: tree.treeId,
        block: tree.block,
        healthStatus: tree.healthStatus,
        lifecycleStatus: tree.lifecycleStatus,
        plantedDate: tree.plantedDate
      }))
    });
    
  } catch (error) {
    console.error('Error generating smart certificate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    const certificate = await SmartCertificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }
    
    // Verify all blockchain anchors
    const verificationResult = await certificate.verify();
    
    res.json({
      success: true,
      certificate: {
        id: certificate.certificateId,
        type: certificate.type,
        status: certificate.status,
        investorName: certificate.certificationData.investorName,
        treesOwned: certificate.certificationData.treesOwned,
        issuanceDate: certificate.certificationData.certificationDate
      },
      verification: verificationResult,
      blockchainAnchors: certificate.blockchainAnchors.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getValidatorStats = async (req, res) => {
  try {
    const stats = blockchain.validators.getValidatorStats();
    res.json({ 
      success: true, 
      validators: stats,
      totalValidators: stats.length,
      activeValidators: stats.filter(v => v.isActive).length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyBlockchain = async (req, res) => {
  try {
    const result = await blockchain.verifyChainIntegrity();
    res.json({ 
      success: true, 
      verification: result,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBlockchainInfo = async (req, res) => {
  try {
    const totalBlocks = blockchain.chain.length;
    const latestBlock = blockchain.getLatestBlock();
    
    // Count blocks by type
    const blockCounts = {};
    blockchain.chain.forEach(block => {
      blockCounts[block.entityType] = (blockCounts[block.entityType] || 0) + 1;
    });
    
    res.json({
      success: true,
      info: {
        totalBlocks,
        latestBlock: {
          index: latestBlock.index,
          entityType: latestBlock.entityType,
          timestamp: latestBlock.timestamp,
          hash: latestBlock.hash.substring(0, 20) + '...'
        },
        blockCounts,
        difficulty: blockchain.difficulty,
        chainHealth: totalBlocks > 0 ? 'HEALTHY' : 'EMPTY'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const history = await blockchain.getChainHistory(entityType, entityId);
    
    if (history.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `No history found for ${entityType}:${entityId}` 
      });
    }
    
    res.json({
      success: true,
      entityType,
      entityId,
      history,
      totalEntries: history.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInvestorBlock,
  createTreeBlock,
  generateSmartCertificate,
  verifyCertificate,
  getValidatorStats,
  verifyBlockchain,
  getBlockchainInfo,
  getEntityHistory,
  blockchain // Export for use in other controllers
};