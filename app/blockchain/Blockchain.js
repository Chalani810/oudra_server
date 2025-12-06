const Block = require('./Block.js');
const crypto = require('crypto');
const BlockchainRecord = require('../models/BlockchainRecord.js');

class Blockchain {
  constructor() {
    this.chain = [];
    this.difficulty = 2;
  }

  async initialize() {
    // Load blockchain from MongoDB
    const blocks = await BlockchainRecord.find().sort({ index: 1 });
    
    if (blocks.length === 0) {
      // Create genesis block if blockchain is empty
      await this.createGenesisBlock();
    } else {
      this.chain = blocks.map(block => {
        const b = new Block(block.index, block.timestamp, block.data, block.previousHash);
        b.hash = block.hash;
        b.nonce = block.nonce;
        return b;
      });
    }
  }

  async createGenesisBlock() {
    const genesisData = { action: 'GENESIS' };
    const dataHash = Blockchain.hashData(genesisData);
    
    const genesisBlock = new Block(0, Date.now(), {
      ...genesisData,
      dataHash: dataHash
    }, '0');
    
    genesisBlock.mineBlock(this.difficulty);
    
    await BlockchainRecord.create({
      index: genesisBlock.index,
      timestamp: genesisBlock.timestamp,
      data: genesisBlock.data,
      previousHash: genesisBlock.previousHash,
      hash: genesisBlock.hash,
      nonce: genesisBlock.nonce,
    });
    
    this.chain.push(genesisBlock);
    return genesisBlock;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addBlock(data) {
    // Ensure dataHash is included in the block data
    const dataHash = Blockchain.hashData(data);
    const blockData = {
      ...data,
      dataHash: dataHash
    };
    
    const newBlock = new Block(
      this.chain.length,
      Date.now(),
      blockData,
      this.getLatestBlock().hash
    );
    
    newBlock.mineBlock(this.difficulty);
    
    // Save to MongoDB
    await BlockchainRecord.create({
      index: newBlock.index,
      timestamp: newBlock.timestamp,
      data: newBlock.data,
      previousHash: newBlock.previousHash,
      hash: newBlock.hash,
      nonce: newBlock.nonce,
    });
    
    this.chain.push(newBlock);
    return newBlock;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getChainData() {
    return this.chain;
  }

  static hashData(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}

module.exports = Blockchain;