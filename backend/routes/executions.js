const express = require('express');
const authMiddleware = require('../middleware/auth');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { getPRDiff } = require('../utils/github');
const pipelineEvents = require('../utils/events');
const router = express.Router();

/*
 * GET /api/executions/stream
 * Server-Sent Events (SSE) stream for real-time pipeline status updates
 */
router.get('/stream', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userId = req.userId.toString();

  // Send an initial connected message so the client knows it's active
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const handleUpdate = (data) => {
    // Only send updates for this user's executions
    if (data.userId.toString() === userId) {
      res.write(`data: ${JSON.stringify({ type: 'execution_updated', ...data })}\n\n`);
    }
  };

  pipelineEvents.on('execution_updated', handleUpdate);

  // Clean up listener when client disconnects
  req.on('close', () => {
    pipelineEvents.off('execution_updated', handleUpdate);
  });
});

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

/**
 * DELETE /api/executions/:id
 * Manually remove a stuck or irrelevant execution from the dashboard.
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Execution.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // 📣 Notify all clients via SSE to refresh their lists
    pipelineEvents.emit('execution_updated', {
      userId: req.userId,
      executionId: req.params.id,
      action: 'deleted'
    });

    res.json({ success: true, message: 'Execution removed.' });
  } catch (error) {
    console.error('Error deleting execution:', error.message);
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

module.exports = router;
