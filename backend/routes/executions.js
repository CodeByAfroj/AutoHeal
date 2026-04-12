const express = require('express');
const authMiddleware = require('../middleware/auth');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { getExecutionStatus, mapKestraStatus } = require('../utils/kestra');
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
      Execution.countDocuments({ userId, status: { $in: ['ai_running', 'logs_processed'] } }),
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
 * Poll Kestra for latest status and update local record
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

    // If terminal state, return as-is
    if (['merged', 'approved', 'rejected', 'error'].includes(execution.status)) {
      return res.json({
        status: execution.status,
        detail: execution.errorMessage || 'Complete',
        execution
      });
    }

    // Poll Kestra if we have an execution ID
    if (execution.kestraExecutionId) {
      try {
        const kestraData = await getExecutionStatus(execution.kestraExecutionId);
        const mapped = mapKestraStatus(kestraData);

        // Update local status if it advanced
        const stageOrder = ['ci_failed', 'logs_processed', 'ai_running', 'ai_complete', 'pr_created', 'awaiting_approval'];
        const currentIdx = stageOrder.indexOf(execution.status);
        const newIdx = stageOrder.indexOf(mapped.stage);

        if (newIdx > currentIdx || mapped.stage === 'error') {
          execution.status = mapped.stage;
          if (mapped.stage === 'error') {
            execution.errorMessage = mapped.detail;
          }
          await execution.save();
        }

        // Try to extract PR info from Kestra outputs
        if (kestraData.outputs && !execution.prUrl) {
          try {
            const prResult = kestraData.outputs.pr_result;
            if (prResult) {
              const pr = JSON.parse(prResult);
              if (pr.pr_url) {
                execution.prUrl = pr.pr_url;
                execution.prNumber = pr.pr_number;
                execution.status = 'pr_created';
                await execution.save();
              }
            }
          } catch (parseErr) { /* ignore parse errors on outputs */ }
        }

        return res.json({
          status: execution.status,
          detail: mapped.detail,
          execution
        });
      } catch (kestraError) {
        // Kestra may be unreachable; return current state
        console.warn('Kestra poll failed:', kestraError.message);
      }
    }

    res.json({
      status: execution.status,
      detail: 'Polling...',
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
