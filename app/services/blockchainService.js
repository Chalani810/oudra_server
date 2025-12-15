// app/services/blockchainService.js
const crypto = require('crypto');
const TreeHistory = require('../models/TreeHistory');

class BlockchainService {
  
  /**
   * Generate SHA-256 hash from history data
   */
  static generateHash(data) {
    const {
      treeId,
      timestamp,
      actionType,
      oldValue,
      newValue,
      changedBy,
      previousHash,
      blockNumber
    } = data;
    
    // Create deterministic string for hashing
    const hashString = JSON.stringify({
      treeId,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
      actionType,
      oldValue: oldValue ? JSON.stringify(oldValue) : 'null',
      newValue: newValue ? JSON.stringify(newValue) : 'null',
      changedBy,
      previousHash,
      blockNumber
    });
    
    return crypto
      .createHash('sha256')
      .update(hashString)
      .digest('hex');
  }
  
  /**
   * Get the last block's hash and number
   */
  static async getLastBlock() {
    try {
      const lastBlock = await TreeHistory.getLastBlock();
      
      if (!lastBlock) {
        return {
          previousHash: '0',
          blockNumber: 0
        };
      }
      
      return {
        previousHash: lastBlock.recordHash,
        blockNumber: lastBlock.blockNumber
      };
    } catch (error) {
      console.error('Error getting last block:', error);
      throw error;
    }
  }
  
  /**
   * Add blockchain data to existing history record
   * This enhances your existing TreeHistory.create() calls
   */
  static async enhanceHistoryRecord(historyData) {
    try {
      // Get last block info
      const { previousHash, blockNumber } = await this.getLastBlock();
      
      // Add blockchain fields
      const enhancedData = {
        ...historyData,
        previousHash,
        blockNumber: blockNumber + 1,
        timestamp: historyData.timestamp || new Date(),
        isVerified: true
      };
      
      // Generate hash
      enhancedData.recordHash = this.generateHash(enhancedData);
      
      console.log(`✅ Blockchain block created: #${enhancedData.blockNumber} for tree ${historyData.treeId}`);
      
      return enhancedData;
      
    } catch (error) {
      console.error('❌ Blockchain enhancement failed:', error);
      // Return original data if blockchain fails (non-blocking)
      return historyData;
    }
  }
  
  /**
   * Create history with blockchain (use this instead of TreeHistory.create())
   */
  static async createHistoryWithBlockchain(historyData) {
    try {
      // Enhance with blockchain data
      const enhancedData = await this.enhanceHistoryRecord(historyData);
      
      // Save to database
      const history = new TreeHistory(enhancedData);
      await history.save();
      
      return history;
      
    } catch (error) {
      console.error('❌ Create history with blockchain failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify a single block's hash
   */
  static async verifyBlock(historyId) {
    try {
      const history = await TreeHistory.findById(historyId);
      
      if (!history || !history.recordHash) {
        throw new Error('History record not found or not blockchain-enabled');
      }
      
      const calculatedHash = this.generateHash({
        treeId: history.treeId,
        timestamp: history.timestamp,
        actionType: history.actionType,
        oldValue: history.oldValue,
        newValue: history.newValue,
        changedBy: history.changedBy,
        previousHash: history.previousHash,
        blockNumber: history.blockNumber
      });
      
      const isValid = history.recordHash === calculatedHash;
      
      return {
        isValid,
        storedHash: history.recordHash,
        calculatedHash,
        blockNumber: history.blockNumber,
        treeId: history.treeId
      };
      
    } catch (error) {
      console.error('Error verifying block:', error);
      throw error;
    }
  }
  
  /**
   * Verify entire chain integrity
   */
  static async verifyChain(treeId = null) {
    try {
      return await TreeHistory.verifyChainIntegrity(treeId);
    } catch (error) {
      console.error('Error verifying chain:', error);
      throw error;
    }
  }
  
  /**
   * Detect tampering
   */
  static async detectTampering(treeId = null) {
    try {
      const query = treeId 
        ? { treeId, blockNumber: { $exists: true } } 
        : { blockNumber: { $exists: true } };
        
      const histories = await TreeHistory.find(query).sort({ blockNumber: 1 });
      
      if (histories.length === 0) {
        return {
          isTampered: false,
          tamperedBlocks: [],
          totalBlocksChecked: 0,
          message: 'No blockchain records found'
        };
      }
      
      const tamperedBlocks = [];
      
      for (let i = 0; i < histories.length; i++) {
        const history = histories[i];
        
        // Check hash validity
        const calculatedHash = this.generateHash({
          treeId: history.treeId,
          timestamp: history.timestamp,
          actionType: history.actionType,
          oldValue: history.oldValue,
          newValue: history.newValue,
          changedBy: history.changedBy,
          previousHash: history.previousHash,
          blockNumber: history.blockNumber
        });
        
        if (calculatedHash !== history.recordHash) {
          tamperedBlocks.push({
            blockNumber: history.blockNumber,
            treeId: history.treeId,
            reason: 'Hash mismatch',
            storedHash: history.recordHash,
            calculatedHash
          });
        }
        
        // Check chain linkage
        if (i > 0 && history.previousHash !== histories[i - 1].recordHash) {
          tamperedBlocks.push({
            blockNumber: history.blockNumber,
            treeId: history.treeId,
            reason: 'Chain break',
            expectedPreviousHash: histories[i - 1].recordHash,
            actualPreviousHash: history.previousHash
          });
        }
      }
      
      return {
        isTampered: tamperedBlocks.length > 0,
        tamperedBlocks,
        totalBlocksChecked: histories.length
      };
      
    } catch (error) {
      console.error('Error detecting tampering:', error);
      throw error;
    }
  }
  
  /**
   * Get blockchain statistics
   */
  static async getBlockchainStats() {
    try {
      const lastBlock = await this.getLastBlock();
      const totalBlocks = await TreeHistory.countDocuments({ blockNumber: { $exists: true } });
      const integrity = await this.verifyChain();
      
      return {
        totalBlocks,
        lastBlockNumber: lastBlock.blockNumber,
        lastBlockHash: lastBlock.previousHash,
        chainIntegrity: integrity.isValid,
        genesisBlock: '0'
      };
    } catch (error) {
      console.error('Error getting blockchain stats:', error);
      throw error;
    }
  }
}

module.exports = BlockchainService;