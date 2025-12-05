//path:oudra-server(same backend for web & mobile apps)/app/controllers/autoIncrementController.js
const AutoIncrementTreeIdCount = require('../models/AutoIncrementTreeIdCount');
const Tree = require('../models/TreeModel');

// Get the next available tree ID considering gaps from deletions
exports.getNextAvailableTreeId = async () => {
  try {
    // Get all existing tree IDs to find gaps
    const existingTrees = await Tree.find({}, 'treeId').sort({ treeId: 1 }).lean();
    const existingIds = existingTrees.map(tree => {
      const num = parseInt(tree.treeId.replace('T-', ''));
      return isNaN(num) ? 0 : num;
    }).filter(num => num > 0).sort((a, b) => a - b);

    // Find the first gap or use the next sequential number
    let nextId = 1;
    for (let i = 0; i < existingIds.length; i++) {
      if (existingIds[i] !== i + 1) {
        nextId = i + 1;
        break;
      }
      nextId = existingIds[i] + 1;
    }

    // Update the sequence counter to be at least the nextId
    const currentCounter = await AutoIncrementTreeIdCount.findOne({ _id: 'tree' });
    if (!currentCounter || currentCounter.seq < nextId) {
      await AutoIncrementTreeIdCount.findOneAndUpdate(
        { _id: 'tree' },
        { seq: nextId },
        { upsert: true, new: true }
      );
    }

    return `T-${String(nextId).padStart(6, '0')}`;
  } catch (error) {
    console.error('Error getting next available tree ID:', error);
    throw error;
  }
};

// Reset sequence if needed (for admin purposes)
exports.resetSequence = async (newSeq = 1) => {
  await AutoIncrementTreeIdCount.findOneAndUpdate(
    { _id: 'tree' },
    { seq: newSeq },
    { upsert: true, new: true }
  );
  return { message: `Sequence reset to ${newSeq}` };
};