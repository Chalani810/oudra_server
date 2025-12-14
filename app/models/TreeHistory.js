// app/models/TreeHistory.js
const mongoose = require('mongoose');

const TreeHistorySchema = new mongoose.Schema({
  treeId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  actionType: { 
    type: String, 
    enum: ['StatusChange', 'Inoculated', 'Inspection', 'LifecycleUpdate', 'NoteAdded', 'ManualEdit'],
    required: true
  },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  changedBy: { type: String, required: true },
  notes: { type: String },
  device: { type: String, enum: ['mobile', 'web'], default: 'mobile' }
});

module.exports = mongoose.model('TreeHistory', TreeHistorySchema);