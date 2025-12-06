const crypto = require('crypto');

class MerkleTree {
  constructor(transactions) {
    this.transactions = transactions;
    this.tree = this.buildTree();
  }

  hash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  buildTree() {
    let tree = this.transactions.map(tx => this.hash(tx));
    
    while (tree.length > 1) {
      const level = [];
      for (let i = 0; i < tree.length; i += 2) {
        const left = tree[i];
        const right = tree[i + 1] || left;
        level.push(this.hash(left + right));
      }
      tree = level;
    }
    
    return tree;
  }

  getRoot() {
    return this.tree[0];
  }
}

module.exports = MerkleTree;