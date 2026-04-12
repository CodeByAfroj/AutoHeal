const express = require('express');
const crypto = require('crypto');
const Repository = require('../models/Repository');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { fetchWorkflowLogs } = require('../utils/github');
const { runSelfHealingPipeline } = require('../utils/ai-fixer');
const router = express.Router();

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!process.env.WEBHOOK_SECRET) return true;

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/*
 * POST /webhook/github
 * Receives GitHub webhook events (workflow_run)
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];

    // Parse body
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString();
    const payload = JSON.parse(rawBody);

    // Verify signature
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Only process workflow_run events that completed with failure
    if (event !== 'workflow_run') {
      return res.status(200).json({ message: `Ignoring event: ${event}` });
    }

    if (payload.action !== 'completed' || payload.workflow_run?.conclusion !== 'failure') {
      return res.status(200).json({ message: 'Not a failure event, ignoring' });
    }

    const workflowRun = payload.workflow_run;
    const repoFullName = payload.repository.full_name;
    const commitSha = workflowRun.head_sha;
    const branch = workflowRun.head_branch;
    const runId = workflowRun.id;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔴 CI FAILURE DETECTED: ${repoFullName}`);
    console.log(`   Commit: ${commitSha.substring(0, 7)} | Branch: ${branch}`);
    console.log(`   Workflow: ${workflowRun.name}`);
    console.log(`${'='.repeat(60)}`);

    // Find the repository in our DB
    const repo = await Repository.findOne({ fullName: repoFullName, enabled: true });
    if (!repo) {
      console.log(`⏭️ Repo ${repoFullName} not enabled for self-healing`);
      return res.status(200).json({ message: 'Repository not enabled' });
    }

    // Get user and decrypt token
    const user = await User.findById(repo.userId);
    if (!user) {
      console.error(`❌ User not found for repo ${repoFullName}`);
      return res.status(200).json({ message: 'User not found' });
    }

    const githubToken = decrypt(user.accessToken);

    // Create execution record
    const execution = await Execution.create({
      userId: user._id,
      repositoryId: repo._id,
      repoFullName,
      commitSha,
      branch,
      status: 'ci_failed',
      workflowRunId: runId,
      errorMessage: `CI workflow "${workflowRun.name}" failed`
    });

    console.log(`📋 Execution created: ${execution._id}`);

    // Respond to GitHub immediately (don't make it wait)
    res.status(200).json({
      message: 'Webhook received, processing...',
      executionId: execution._id
    });

    // ============================================
    // Run the self-healing pipeline asynchronously
    // ============================================
    (async () => {
      try {
        // Step 1: Fetch workflow logs
        console.log('📄 Fetching CI logs...');
        let errorLogs = '';
        try {
          errorLogs = await fetchWorkflowLogs(githubToken, repoFullName, runId);
          execution.status = 'logs_processed';
          execution.errorLogs = errorLogs;
          await execution.save();
          console.log('✅ Logs fetched and processed');
        } catch (logError) {
          console.error('⚠️ Failed to fetch detailed logs, using basic info');
          errorLogs = `Workflow "${workflowRun.name}" failed on commit ${commitSha}. Branch: ${branch}`;
          execution.errorLogs = errorLogs;
          execution.status = 'logs_processed';
          await execution.save();
        }

        // Step 2-4: AI Analysis → Fix → PR (all in one)
        const result = await runSelfHealingPipeline(
          execution,
          githubToken
        );

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 SELF-HEALING COMPLETE!`);
        console.log(`   PR: ${result.prUrl}`);
        console.log(`   Fix: ${result.targetFile}`);
        console.log(`   Root Cause: ${result.rootCause}`);
        console.log(`${'='.repeat(60)}\n`);

      } catch (pipelineError) {
        console.error(`❌ Pipeline failed: ${pipelineError.message}`);
        execution.status = 'error';
        execution.errorMessage = pipelineError.message;
        await execution.save();
      }
    })();

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
});

module.exports = router;
