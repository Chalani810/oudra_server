// path: oudra-server/clearNonces.js
// Run with: node clearNonces.js
// Cancels all stuck pending nonces by sending 0 POL self-transfers

require("dotenv").config();
const { ethers } = require("ethers");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);

  const confirmedNonce = await provider.getTransactionCount(wallet.address, "latest");
  const pendingNonce   = await provider.getTransactionCount(wallet.address, "pending");

  console.log(`👛 Wallet: ${wallet.address}`);
  console.log(`✅ Confirmed nonce: ${confirmedNonce}`);
  console.log(`⏳ Pending nonce:   ${pendingNonce}`);
  console.log(`🧹 Stuck txs to cancel: ${pendingNonce - confirmedNonce}\n`);

  if (pendingNonce === confirmedNonce) {
    console.log("✅ Mempool is already clean! Nothing to cancel.");
    return;
  }

  // Get gas price from gas station
  let gasPrice;
  try {
    const gs = await fetch("https://gasstation.polygon.technology/amoy").then(r => r.json());
    // Use 3× fast price to guarantee replacement
    gasPrice = BigInt(Math.ceil(gs.fast.maxFee * 3 * 1e9));
    console.log(`⛽ Cancel gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei (3× fast)\n`);
  } catch {
    gasPrice = 150_000_000_000n; // 150 gwei fallback
    console.log("⛽ Using fallback cancel gas price: 150 gwei\n");
  }

  // Send cancel tx for each stuck nonce
  const hashes = [];
  for (let nonce = confirmedNonce; nonce < pendingNonce; nonce++) {
    try {
      console.log(`🧹 Cancelling nonce ${nonce}...`);
      const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0n,
        nonce,
        gasLimit: 21_000n,
        gasPrice,
      });
      console.log(`   📤 Cancel tx: ${tx.hash}`);
      hashes.push({ nonce, hash: tx.hash });
      await sleep(1000); // small delay between sends
    } catch (err) {
      console.warn(`   ⚠️  Nonce ${nonce} failed: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`\n⏳ Waiting for ${hashes.length} cancel txs to confirm...\n`);

  // Wait for all cancel txs
  for (const { nonce, hash } of hashes) {
    try {
      const receipt = await Promise.race([
        provider.waitForTransaction(hash),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 60_000))
      ]);
      if (receipt?.status === 1) {
        console.log(`   ✅ Nonce ${nonce} cancelled — block ${receipt.blockNumber}`);
      } else {
        console.log(`   ⚠️  Nonce ${nonce} receipt status: ${receipt?.status}`);
      }
    } catch {
      console.log(`   ⚠️  Nonce ${nonce} timed out — may still confirm later`);
    }
  }

  // Final check
  const finalPending   = await provider.getTransactionCount(wallet.address, "pending");
  const finalConfirmed = await provider.getTransactionCount(wallet.address, "latest");
  console.log(`\n📊 Final state:`);
  console.log(`   ✅ Confirmed nonce: ${finalConfirmed}`);
  console.log(`   ⏳ Pending nonce:   ${finalPending}`);

  if (finalPending === finalConfirmed) {
    console.log("\n🎉 Mempool is clean! You can now run the sync.");
  } else {
    console.log(`\n⚠️  ${finalPending - finalConfirmed} nonces still stuck — run this script again.`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});