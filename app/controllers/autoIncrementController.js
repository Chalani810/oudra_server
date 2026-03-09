//path:oudra-server(same backend for web & mobile apps)/app/controllers/autoIncrementController.js
const AutoIncrementTreeIdCount = require('../models/AutoIncrementTreeIdCount');
const Tree = require('../models/TreeModel');

function extractNumber(treeId) {
  if (!treeId) return 0;
  // Match either T{Letter}-{digits} or T-{digits}
  const match = treeId.match(/^T[A-F]?-(\d+)$/);
  if (!match) return 0;
  const num = parseInt(match[1]);
  return isNaN(num) ? 0 : num;
}

// Get block letter from block string e.g. "Block-A" → "A"
function getBlockLetter(block) {
  if (!block) return 'X';
  const match = block.match(/Block-([A-F])/i);
  return match ? match[1].toUpperCase() : 'X';
}

// Get next available number (gap-filling, global across all blocks)
exports.getNextAvailableNumber = async () => {
  try {
    const existingTrees = await Tree.find({}, 'treeId').lean();
    const existingNumbers = existingTrees
      .map(t => extractNumber(t.treeId))
      .filter(n => n > 0)
      .sort((a, b) => a - b);

    // Find first gap
    let nextNum = 1;
    for (let i = 0; i < existingNumbers.length; i++) {
      if (existingNumbers[i] !== i + 1) {
        nextNum = i + 1;
        break;
      }
      nextNum = existingNumbers[i] + 1;
    }

    return nextNum;
  } catch (error) {
    console.error('Error getting next available number:', error);
    throw error;
  }
};

// Build the full tree ID from block and number
exports.buildTreeId = (block, number) => {
  const letter = getBlockLetter(block);
  return `T${letter}-${String(number).padStart(6, '0')}`;
};

// Legacy export kept for any other code that might import it
exports.getNextAvailableTreeId = async (block) => {
  const num = await exports.getNextAvailableNumber();
  return exports.buildTreeId(block, num);
};

exports.resetSequence = async (newSeq = 1) => {
  await AutoIncrementTreeIdCount.findOneAndUpdate(
    { _id: 'tree' },
    { seq: newSeq },
    { upsert: true, new: true }
  );
  return { message: `Sequence reset to ${newSeq}` };
};