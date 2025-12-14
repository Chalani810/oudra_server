//path: oudra-server(same backend for web & mobile apps)/app/controllers/syncController.js
const Tree = require('../models/TreeModel');
const TreeHistory = require('../models/TreeHistory');
const Observation = require('../models/Observations');

// Batch sync offline data from mobile
exports.batchSync = async (req, res) => {
  try {
    const { deviceId, userId, items } = req.body;
    const results = [];

    console.log(`Batch sync request from device: ${deviceId}, user: ${userId}, items: ${items.length}`);

    for (const item of items) {
      try {
        if (item.type === 'TREE_UPDATE') {
          const tree = await Tree.findOne({ treeId: item.treeId });
          if (!tree) {
            results.push({ 
              id: item.id, 
              status: 'error', 
              reason: 'Tree not found',
              treeId: item.treeId 
            });
            continue;
          }

          // Conflict detection
          if (item.baseUpdatedAt && tree.updatedAt && new Date(tree.updatedAt) > new Date(item.baseUpdatedAt)) {
            results.push({ 
              id: item.id, 
              status: 'conflict', 
              remote: tree,
              conflictType: 'tree_updated_remotely',
              remoteUpdatedAt: tree.updatedAt,
              localUpdatedAt: item.baseUpdatedAt
            });
            continue;
          }

          // Apply the changes
          const changes = item.payload.changes || {};
          Object.assign(tree, changes);
          
          // Update timestamps
          tree.updatedAt = new Date();
          tree.lastUpdatedAt = new Date();
          tree.lastUpdatedBy = userId || 'mobile-user';
          tree.offlineUpdated = true;
          
          await tree.save();

          // Add to history
          await TreeHistory.create({
            treeId: tree.treeId,
            actionType: 'ManualEdit',
            newValue: changes,
            changedBy: userId || 'mobile-user',
            timestamp: new Date(),
            device: 'mobile',
            notes: `Offline sync: ${Object.keys(changes).join(', ')} updated`
          });

          results.push({ 
            id: item.id, 
            status: 'ok', 
            updatedAt: tree.updatedAt,
            treeId: tree.treeId,
            message: 'Tree updated successfully'
          });
          
        } else if (item.type === 'OBSERVATION_ADD') {
          // Handle observation addition
          const observationData = item.payload;
          
          const observation = new Observation({
            observationId: `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            treeId: observationData.treeId,
            notes: observationData.notes,
            images: observationData.images || [],
            healthStatus: observationData.healthStatus || 'Healthy',
            observedBy: userId || 'mobile-user',
            type: observationData.type || 'Routine',
            timestamp: new Date(),
            canEdit: true
          });

          await observation.save();

          // Add to tree history
          await TreeHistory.create({
            treeId: observationData.treeId,
            actionType: 'NoteAdded',
            newValue: { 
              observationId: observation.observationId,
              notes: observationData.notes.substring(0, 100),
              healthStatus: observationData.healthStatus
            },
            changedBy: userId || 'mobile-user',
            notes: 'Field note added via offline sync',
            timestamp: new Date(),
            device: 'mobile'
          });

          results.push({ 
            id: item.id, 
            status: 'ok', 
            observationId: observation.observationId,
            message: 'Observation added successfully'
          });
          
        } else if (item.type === 'GPS_UPDATE') {
          // Handle GPS update
          const tree = await Tree.findOne({ treeId: item.treeId });
          if (!tree) {
            results.push({ 
              id: item.id, 
              status: 'error', 
              reason: 'Tree not found',
              treeId: item.treeId 
            });
            continue;
          }

          tree.gps = item.payload.gps;
          tree.updatedAt = new Date();
          tree.lastUpdatedAt = new Date();
          tree.lastUpdatedBy = userId || 'mobile-user';
          
          await tree.save();

          // Add to history
          await TreeHistory.create({
            treeId: tree.treeId,
            actionType: 'ManualEdit',
            newValue: { gps: item.payload.gps },
            changedBy: userId || 'mobile-user',
            notes: 'GPS coordinates updated via offline sync',
            timestamp: new Date(),
            device: 'mobile'
          });

          results.push({ 
            id: item.id, 
            status: 'ok', 
            message: 'GPS updated successfully',
            treeId: tree.treeId
          });
          
        } else {
          results.push({ 
            id: item.id, 
            status: 'error', 
            reason: `Unknown operation type: ${item.type}` 
          });
        }
        
      } catch (err) {
        console.error(`Error processing item ${item.id}:`, err);
        results.push({ 
          id: item.id, 
          status: 'error', 
          reason: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }

    console.log(`Batch sync completed. Results:`, results);
    res.json({ 
      success: true, 
      results,
      timestamp: new Date().toISOString(),
      processed: results.length
    });
    
  } catch (error) {
    console.error('Batch sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Test endpoint for sync
exports.testSync = async (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Sync controller is working',
    timestamp: new Date().toISOString()
  });
};