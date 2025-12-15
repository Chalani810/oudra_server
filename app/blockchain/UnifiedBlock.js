// blockchain/UnifiedBlock.js - REDESIGNED
const crypto = require('crypto');

class UnifiedBlock {
  constructor(index, timestamp, entityType, entityData, references, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    
    // NEW: Support multiple entity types
    this.entityType = entityType; // 'INVESTOR', 'TREE', 'IOT_DATA', 'AI_GRADE', 'CERTIFICATE'
    this.entityId = entityData.id; // Universal ID field
    this.entityData = this.sanitizeData(entityData);
    
    // NEW: Cross-references to other blocks
    this.references = references || {
      investorBlockHash: null,
      treeBlockHash: null,
      iotBlockHash: null,
      aiGradeBlockHash: null
    };
    
    this.previousHash = previousHash;
    this.merkleRoot = this.calculateMerkleRoot();
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  sanitizeData(data) {
    // Remove sensitive fields from hash calculation
    const sanitized = { ...data };
    delete sanitized.password;
    delete sanitized.privateKey;
    return sanitized;
  }

  calculateMerkleRoot() {
    // NEW: Use Merkle tree for data integrity
    const leaves = [
      this.entityType,
      this.entityId,
      JSON.stringify(this.entityData),
      JSON.stringify(this.references),
      this.timestamp.toString()
    ];
    
    return this.buildMerkleTree(leaves);
  }

  buildMerkleTree(leaves) {
    if (leaves.length === 0) return '';
    if (leaves.length === 1) return crypto.createHash('sha256').update(leaves[0]).digest('hex');
    
    const newLevel = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = crypto.createHash('sha256').update(leaves[i]).digest('hex');
      const right = leaves[i + 1] 
        ? crypto.createHash('sha256').update(leaves[i + 1]).digest('hex')
        : left;
      newLevel.push(crypto.createHash('sha256').update(left + right).digest('hex'));
    }
    
    return this.buildMerkleTree(newLevel);
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
        this.previousHash +
        this.timestamp +
        this.entityType +
        this.entityId +
        this.merkleRoot +
        this.nonce
      )
      .digest('hex');
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join('0');
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`⛏️ Block #${this.index} mined (${this.entityType}): ${this.hash}`);
  }

  // NEW: Verify Merkle proof (prove data exists without revealing full block)
  verifyMerkleProof(data, proof) {
    let hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    
    for (const sibling of proof) {
      hash = sibling.left
        ? crypto.createHash('sha256').update(sibling.value + hash).digest('hex')
        : crypto.createHash('sha256').update(hash + sibling.value).digest('hex');
    }
    
    return hash === this.merkleRoot;
  }
}

module.exports = UnifiedBlock;