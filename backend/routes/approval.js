const express = require('express');
const authMiddleware = require('../middleware/auth');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { mergePR, closePR } = require('../utils/github');
const router = express.Router();

/*
 * POST /api/executions/:id/approve
 * Approve AI-generated fix and merge PR
 */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const execution = await Execution.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (!execution.prNumber) {
      return res.status(400).json({ error: 'No PR associated with this execution' });
    }

    if (['merged', 'rejected'].includes(execution.status)) {
      return res.status(400).json({ error: `Execution already ${execution.status}` });
    }

    // Get user token
    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);

    // Merge PR
    await mergePR(token, execution.repoFullName, execution.prNumber);

    // Update execution
    execution.status = 'merged';
    await execution.save();

    console.log(`✅ PR #${execution.prNumber} merged for ${execution.repoFullName}`);

    res.json({
      message: 'PR merged successfully',
      execution
    });
  } catch (error) {
    console.error('Error approving:', error.message);

    if (error.response?.status === 405) {
      return res.status(405).json({ error: 'PR cannot be merged (check for conflicts or branch protection)' });
    }

    res.status(500).json({ error: 'Failed to merge PR' });
  }
});

/*
 * POST /api/executions/:id/reject
 * Reject AI-generated fix and close PR
 */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const execution = await Execution.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (!execution.prNumber) {
      return res.status(400).json({ error: 'No PR associated with this execution' });
    }

    if (['merged', 'rejected'].includes(execution.status)) {
      return res.status(400).json({ error: `Execution already ${execution.status}` });
    }

    // Get user token
    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);

    // Close PR
    await closePR(token, execution.repoFullName, execution.prNumber);

    // Update execution
    execution.status = 'rejected';
    await execution.save();

    console.log(`❌ PR #${execution.prNumber} rejected for ${execution.repoFullName}`);

    res.json({
      message: 'PR rejected and closed',
      execution
    });
  } catch (error) {
    console.error('Error rejecting:', error.message);
    res.status(500).json({ error: 'Failed to reject PR' });
  }
});

module.exports = router;
