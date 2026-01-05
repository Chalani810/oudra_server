// app/config/blockchain.config.js
const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

// Load contract ABI
let contractABI;
try {
  // Adjust path based on where your compiled contract JSON is
  const abiPath = path.join(__dirname, '../contracts/PlantationCertificate.json');
  const contractJSON = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  contractABI = contractJSON.abi;
  console.log('✅ Contract ABI loaded successfully');
} catch (error) {
  console.warn('⚠️  Contract ABI not found. Make sure to compile and copy your contract first.');
  console.warn('   Expected location: app/contracts/PlantationCertificate.json');
  contractABI = []; // Empty ABI as fallback
}

// Blockchain configuration
const config = {
  network: process.env.BLOCKCHAIN_NETWORK || 'sepolia',
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
  contractAddress: process.env.CONTRACT_ADDRESS,
  privateKey: process.env.PRIVATE_KEY
};

// Validate configuration
if (!config.rpcUrl) {
  console.warn('⚠️  BLOCKCHAIN_RPC_URL not set in .env');
}

if (!config.contractAddress || config.contractAddress === '0x0000000000000000000000000000000000000000') {
  console.warn('⚠️  CONTRACT_ADDRESS not set in .env - please deploy contract first');
}

if (!config.privateKey || config.privateKey === 'your_private_key_here_without_0x_prefix') {
  console.warn('⚠️  PRIVATE_KEY not set in .env');
}

// Provider setup (for reading blockchain)
let provider;
try {
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  console.log(`✅ Connected to ${config.network} network`);
} catch (error) {
  console.error('❌ Failed to connect to blockchain provider:', error.message);
  provider = null;
}

// Wallet setup (for signing transactions)
let wallet;
try {
  if (provider && config.privateKey && config.privateKey !== 'your_private_key_here_without_0x_prefix') {
    wallet = new ethers.Wallet(config.privateKey, provider);
    console.log(`✅ Wallet connected: ${wallet.address}`);
  } else {
    console.warn('⚠️  Wallet not initialized - check your PRIVATE_KEY in .env');
    wallet = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize wallet:', error.message);
  wallet = null;
}

// Contract instance for transactions (needs wallet)
let contract;
if (wallet && contractABI.length > 0 && config.contractAddress !== '0x0000000000000000000000000000000000000000') {
  try {
    contract = new ethers.Contract(
      config.contractAddress,
      contractABI,
      wallet
    );
    console.log(`✅ Contract initialized at: ${config.contractAddress}`);
  } catch (error) {
    console.error('❌ Failed to initialize contract:', error.message);
    contract = null;
  }
} else {
  console.warn('⚠️  Contract not initialized - missing wallet, ABI, or contract address');
  contract = null;
}

// Read-only contract instance (no gas fees, anyone can use)
let contractReadOnly;
if (provider && contractABI.length > 0 && config.contractAddress !== '0x0000000000000000000000000000000000000000') {
  try {
    contractReadOnly = new ethers.Contract(
      config.contractAddress,
      contractABI,
      provider
    );
    console.log('✅ Read-only contract initialized');
  } catch (error) {
    console.error('❌ Failed to initialize read-only contract:', error.message);
    contractReadOnly = null;
  }
} else {
  contractReadOnly = null;
}

// Health check function
const checkBlockchainConnection = async () => {
  try {
    if (!provider) {
      return { connected: false, error: 'Provider not initialized' };
    }

    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    let walletBalance = null;
    if (wallet) {
      const balance = await provider.getBalance(wallet.address);
      walletBalance = ethers.formatEther(balance);
    }

    return {
      connected: true,
      network: network.name,
      chainId: Number(network.chainId),
      blockNumber: blockNumber,
      walletAddress: wallet ? wallet.address : null,
      walletBalance: walletBalance,
      contractAddress: config.contractAddress
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};

// Export all instances
module.exports = {
  config,
  provider,
  wallet,
  contract,
  contractReadOnly,
  checkBlockchainConnection
};
