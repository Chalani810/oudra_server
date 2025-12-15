// blockchain/ValidatorNetwork.js - NEW
const crypto = require('crypto');

class ValidatorNetwork {
  constructor() {
    this.validators = new Map(); // address => validator info
    this.pendingTransactions = [];
    this.minValidators = 3; // Minimum for consensus
    this.consensusThreshold = 0.67; // 67% must agree
  }

  // Register a validator (plantation manager, admin, auditor)
  registerValidator(address, publicKey, role, reputation = 100) {
    this.validators.set(address, {
      address,
      publicKey,
      role, // 'ADMIN', 'MANAGER', 'AUDITOR', 'SYSTEM'
      reputation,
      blocksProposed: 0,
      blocksApproved: 0,
      lastActiveAt: new Date(),
      isActive: true
    });
    
    console.log(`✅ Validator registered: ${role} - ${address.substring(0, 10)}...`);
  }

  // Propose a new block
  async proposeBlock(block, proposerAddress) {
    if (!this.validators.has(proposerAddress)) {
      throw new Error('Unauthorized proposer');
    }
    
    const proposal = {
      block,
      proposer: proposerAddress,
      proposedAt: Date.now(),
      votes: new Map(), // validator => vote
      status: 'PENDING'
    };
    
    this.pendingTransactions.push(proposal);
    
    // Validators automatically vote
    await this.collectVotes(proposal);
    
    return proposal;
  }

  async collectVotes(proposal) {
    const activeValidators = Array.from(this.validators.values())
      .filter(v => v.isActive && v.address !== proposal.proposer);
    
    if (activeValidators.length < this.minValidators - 1) {
      console.warn('⚠️ Not enough validators for consensus');
      return false;
    }
    
    // Simulate async voting (in real system, this would be P2P network)
    for (const validator of activeValidators) {
      const vote = await this.validateBlock(proposal.block, validator);
      proposal.votes.set(validator.address, vote);
    }
    
    return this.finalizeConsensus(proposal);
  }

  async validateBlock(block, validator) {
    // Validation criteria
    const checks = {
      hashValid: block.hash === block.calculateHash(),
      previousHashValid: true, // Check against chain
      merkleRootValid: block.merkleRoot === block.calculateMerkleRoot(),
      timestampValid: block.timestamp <= Date.now(),
      dataIntegrity: this.verifyDataIntegrity(block.entityData)
    };
    
    const allValid = Object.values(checks).every(v => v);
    
    // Update validator stats
    if (allValid) {
      validator.blocksApproved++;
      validator.reputation = Math.min(validator.reputation + 1, 1000);
    } else {
      validator.reputation = Math.max(validator.reputation - 5, 0);
    }
    
    return {
      validator: validator.address,
      approved: allValid,
      checks,
      signature: this.signVote(validator, block.hash, allValid),
      timestamp: Date.now()
    };
  }

  signVote(validator, blockHash, approved) {
    const message = `${validator.address}:${blockHash}:${approved}`;
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  finalizeConsensus(proposal) {
    const votes = Array.from(proposal.votes.values());
    const approvals = votes.filter(v => v.approved).length;
    const total = votes.length;
    
    const consensusReached = approvals / total >= this.consensusThreshold;
    
    proposal.status = consensusReached ? 'APPROVED' : 'REJECTED';
    proposal.consensusResult = {
      approvals,
      rejections: total - approvals,
      total,
      threshold: this.consensusThreshold,
      reached: consensusReached
    };
    
    if (consensusReached) {
      const proposer = this.validators.get(proposal.proposer);
      proposer.blocksProposed++;
      proposer.reputation += 5;
      
      console.log(`✅ Consensus reached for block #${proposal.block.index}`);
    } else {
      console.warn(`❌ Consensus failed for block #${proposal.block.index}`);
    }
    
    return consensusReached;
  }

  verifyDataIntegrity(entityData) {
    // Custom validation rules per entity type
    if (!entityData || typeof entityData !== 'object') return false;
    
    // Add more specific checks
    return true;
  }

  getValidatorStats() {
    return Array.from(this.validators.values()).map(v => ({
      address: v.address.substring(0, 10) + '...',
      role: v.role,
      reputation: v.reputation,
      blocksProposed: v.blocksProposed,
      blocksApproved: v.blocksApproved,
      accuracy: v.blocksProposed > 0 
        ? Math.round((v.blocksApproved / v.blocksProposed) * 100) 
        : 0,
      isActive: v.isActive
    }));
  }
}

module.exports = ValidatorNetwork;