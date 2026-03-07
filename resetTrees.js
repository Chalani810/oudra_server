require('dotenv').config();
const mongoose = require('mongoose');
const Tree = require('./app/models/TreeModel');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const result = await Tree.updateMany(
    { treeId: { $in: ['T-000012','T-000013','T-000014','T-000015','T-000016','T-000017','T-000018','T-000019','T-000020','T-000021'] } },
    { blockchainStatus: 'Unverified', blockchainTxHash: null }
  );
  console.log('✅ Reset done:', result.modifiedCount, 'trees reset');
  process.exit();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});