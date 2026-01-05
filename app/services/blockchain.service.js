// app/services/blockchain.service.js
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

class BlockchainService {
  constructor() {
    this.enabled = false;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = null;
    this.init();
  }

  init() {
    try {
      // Load contract ABI from compiled contract
      const abiPath = path.join(__dirname, '../contracts/TreeCertificate.json');
      
      let contractABI;
      if (fs.existsSync(abiPath)) {
        const contractJSON = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contractABI = contractJSON.abi;
        console.log('✅ Contract ABI loaded from file');
      } else {
        console.warn('⚠️  TreeCertificate.json not found, using fallback ABI');
        // Fallback to minimal ABI if file doesn't exist
        contractABI = [
          {
            "inputs": [
              { "internalType": "string", "name": "certificateId", "type": "string" },
              { "internalType": "address", "name": "recipient", "type": "address" },
              { "internalType": "string", "name": "treeId", "type": "string" },
              { "internalType": "string", "name": "location", "type": "string" },
              { "internalType": "string", "name": "treeSpecies", "type": "string" }
            ],
            "name": "issueCertificate",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ];
      }

      // Check for private key
      const privateKey = process.env.PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY;
      if (!privateKey) {
        console.warn('⚠️  PRIVATE_KEY not set - blockchain features disabled');
        return;
      }

      // Setup provider
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-amoy.polygon.technology';
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Setup wallet
      this.wallet = new ethers.Wallet(privateKey, provider);

      // Setup contract
      this.contractAddress = process.env.CONTRACT_ADDRESS || "0xa031690639844b131FC96360fD41516a8A24d541";
      
      this.contract = new ethers.Contract(
        this.contractAddress,
        contractABI,
        this.wallet
      );

      this.enabled = true;
      console.log('✅ Blockchain service initialized');
      console.log('📍 Contract:', this.contractAddress);
      console.log('👤 Wallet:', this.wallet.address);

    } catch (error) {
      console.error('❌ Blockchain service initialization failed:', error.message);
      this.enabled = false;
    }
  }

  // Updated to match your new contract signature
  async issueCertificate(certificateId, ownerAddress, metadataURI) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Blockchain service not enabled'
      };
    }

    try {
      console.log('🌳 Issuing certificate on blockchain...');
      console.log('   Certificate ID:', certificateId);
      console.log('   Owner:', ownerAddress);
      console.log('   Metadata URI:', metadataURI);

      // Call the new contract function with all 5 parameters
      const tx = await this.contract.issueCertificate(
        certificateId,
        ownerAddress,
        certificateId, // Using certificateId as treeId for now
        metadataURI || 'Not specified', // location
        'Tree' // treeSpecies - you can make this dynamic
      );

      console.log('📤 Transaction sent:', tx.hash);

      const receipt = await tx.wait();

      console.log('✅ Certificate issued on blockchain!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas used:', receipt.gasUsed.toString());

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`
      };

    } catch (error) {
      console.error('❌ Blockchain error:', error);
      return {
        success: false,
        error: error.message || error.toString()
      };
    }
  }

  // Verify certificate by transaction hash
  async verifyCertificate(transactionHash) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Blockchain service not enabled'
      };
    }

    try {
      const receipt = await this.wallet.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      return {
        success: true,
        data: {
          blockNumber: receipt.blockNumber.toString(),
          status: receipt.status === 1 ? 'success' : 'failed',
          from: receipt.from,
          to: receipt.to,
          gasUsed: receipt.gasUsed.toString(),
          explorerUrl: `https://amoy.polygonscan.com/tx/${transactionHash}`
        }
      };

    } catch (error) {
      console.error('❌ Verification error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get wallet balance
  async getBalance() {
    if (!this.enabled) return '0';

    try {
      const balance = await this.wallet.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('❌ Get balance error:', error.message);
      return '0';
    }
  }

  // Check connection status
  async checkConnection() {
    if (!this.enabled) {
      return {
        connected: false,
        error: 'Blockchain service not enabled'
      };
    }

    try {
      const network = await this.wallet.provider.getNetwork();
      const blockNumber = await this.wallet.provider.getBlockNumber();
      const balance = await this.getBalance();

      return {
        connected: true,
        network: network.name,
        chainId: Number(network.chainId),
        blockNumber: blockNumber,
        walletAddress: this.wallet.address,
        walletBalance: balance,
        contractAddress: this.contractAddress
      };

    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = new BlockchainService();