const express = require('express');
const authMiddleware = require('../middleware/auth');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { getPRDiff } = require('../utils/github');
const router = express.Router();

/*
 * GET /api/executions
 * List user's executions (most recent first)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0, repoId } = req.query;

    const filter = { userId: req.userId };
    if (repoId) filter.repositoryId = repoId;

    const executions = await Execution.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('repositoryId', 'fullName name language');

    const total = await Execution.countDocuments(filter);

    res.json({ executions, total });
  } catch (error) {
    console.error('Error fetching executions:', error.message);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

/*
 * GET /api/executions/stats
 * Get aggregated stats for the dashboard
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const [total, successful, running, failed] = await Promise.all([
      Execution.countDocuments({ userId }),
      Execution.countDocuments({ userId, status: { $in: ['merged', 'approved'] } }),
      Execution.countDocuments({ userId, status: { $in: ['ai_running', 'logs_processed', 'ci_failed', 'ai_complete'] } }),
      Execution.countDocuments({ userId, status: 'error' })
    ]);

    res.json({
      totalExecutions: total,
      successfulFixes: successful,
      activePipelines: running,
      failedPipelines: failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/*
 * GET /api/executions/:id
 * Get execution detail
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const execution = await Execution.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate('repositoryId', 'fullName name language');

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    console.error('Error fetching execution:', error.message);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

/*
 * GET /api/executions/:id/status
 * Return current execution status (updated directly by the AI pipeline)
 */
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const execution = await Execution.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const statusMessages = {
      ci_failed: 'CI failure detected, fetching logs...',
      logs_processed: 'Logs analyzed, starting AI...',
      ai_running: 'AI is analyzing the root cause and generating a fix...',
      ai_complete: 'AI fix generated, creating PR...',
      pr_created: 'Pull request created — awaiting review',
      awaiting_approval: 'Waiting for user approval',
      approved: 'Fix approved and merged',
      merged: 'Fix merged successfully',
      rejected: 'Fix was rejected',
      error: execution.errorMessage || 'Pipeline error'
    };

    res.json({
      status: execution.status,
      detail: statusMessages[execution.status] || 'Processing...',
      execution
    });
  } catch (error) {
    console.error('Error polling status:', error.message);
    res.status(500).json({ error: 'Failed to poll status' });
  }
});

/*
 * GET /api/executions/:id/diff
 * Get PR diff for an execution
 */
router.get('/:id/diff', authMiddleware, async (req, res) => {
  try {
    const execution = await Execution.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!execution || !execution.prNumber) {
      return res.status(404).json({ error: 'No PR found for this execution' });
    }

    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);
    const diff = await getPRDiff(token, execution.repoFullName, execution.prNumber);

    res.json({ diff });
  } catch (error) {
    console.error('Error fetching diff:', error.message);
    res.status(500).json({ error: 'Failed to fetch diff' });
  }
});

module.exports = router;
