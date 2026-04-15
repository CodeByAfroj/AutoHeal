const express = require('express');
const crypto = require('crypto');
const Repository = require('../models/Repository');
const Execution = require('../models/Execution');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { fetchWorkflowLogs } = require('../utils/github');
const { runSelfHealingPipeline } = require('../utils/ai-fixer');
const { deleteBranch, createPR } = require('../utils/git-ops');
const router = express.Router();

// 🛡️ NATIVE NODE.JS MEMORY MUTEX
// Because Node is single-threaded, using an in-memory Set prevents all parallel webhook duplication 
// instantly without suffering from async MongoDB latency overhead!
const activeWebhookLocks = new Set();

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

    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString();
    const payload = JSON.parse(rawBody);

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (event !== 'workflow_run') {
      return res.status(200).json({ message: `Ignoring event: ${event}` });
    }

    if (payload.action !== 'completed') {
      return res.status(200).json({ message: 'Not a completed event, ignoring' });
    }

    const workflowRun = payload.workflow_run;
    const conclusion = workflowRun.conclusion; // 'success' or 'failure'
    const repoFullName = payload.repository.full_name;
    const commitSha = workflowRun.head_sha;
    const branch = workflowRun.head_branch;
    const runId = workflowRun.id;

    // ============================================
    // 🏎️ SYNCHRONOUS MUTEX LOCK
    // Blocks multiple parallel failing workflows (e.g. Lint & Test) executing on the same commit!
    // ============================================
    const lockKey = branch.startsWith('fix/autoheal-') ? branch : commitSha;
    if (activeWebhookLocks.has(lockKey)) {
       return res.status(200).json({ message: 'Mutex locked. Webhook dropped to prevent AI Overlaps.' });
    }
    activeWebhookLocks.add(lockKey);
    setTimeout(() => activeWebhookLocks.delete(lockKey), 1000 * 60 * 5); // Automatically release after 5 mins

    // Retrieve repository configuration
    const repo = await Repository.findOne({ fullName: repoFullName, enabled: true });
    if (!repo) return res.status(200).json({ message: 'Repository not enabled' });

    const user = await User.findById(repo.userId);
    if (!user) return res.status(200).json({ message: 'User not found' });
    const githubToken = decrypt(user.accessToken);

    // ============================================
    // SHADOW BRANCH LISTENER
    // ============================================
    if (branch.startsWith('fix/autoheal-')) {
      const existingExecution = await Execution.findOne({ fixBranch: branch });

      if (!existingExecution) {
        return res.status(200).json({ message: 'Shadow branch execution not found in DB.' });
      }

      // 🛡️ PREVENT RACE CONDITIONS: Only evaluate the EXACT workflow ID that originally failed
      if (existingExecution.workflowId && existingExecution.workflowId !== workflowRun.workflow_id) {
        console.log(`       [Race Condition Shield] Ignoring webhook for irrelevant workflow "${workflowRun.name}" on shadow branch.`);
        return res.status(200).json({ message: 'Ignored irrelevant workflow response.' });
      }

      // 🛡️ ATOMIC STATE LOCK: Only process if we are still waiting for CI validation!
      if (existingExecution.status !== 'ai_complete') {
        console.log(`       [Atomic Lock] Branch ${branch} was already validated (Status: ${existingExecution.status}). Ignoring duplicate webhook.`);
        return res.status(200).json({ message: 'Shadow branch already processed.' });
      }

      await evaluateShadowBranchResults(githubToken, repo, existingExecution, conclusion, runId);
      return res.status(200).json({ message: 'Shadow branch webhook processed.' });
    }

    // ============================================
    // MAIN PIPELINE FAILURE HANDLER
    // ============================================
    if (conclusion !== 'failure') {
      return res.status(200).json({ message: 'Run was successful (and not a shadow branch). Ignoring.' });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔴 CI FAILURE DETECTED: ${repoFullName}`);
    console.log(`   Commit: ${commitSha.substring(0, 7)} | Branch: ${branch}`);
    console.log(`   Workflow: ${workflowRun.name}`);
    console.log(`${'='.repeat(60)}`);

    // 🛡️ ATOMIC COMMIT LOCK 
    // If a pipeline already exists for this EXACT Git commit, ignore all other incoming webhooks.
    // (Prevents 10 failing workflows from launching 10 concurrent AI Agents causing Git 409 Conflicts!)
    const activeLock = await Execution.findOne({ commitSha });
    if (activeLock) {
      console.log(`       [Commit Lock] AutoHeal is already handling commit ${commitSha.substring(0,7)}. Ignoring duplicate/concurrent failure.`);
      return res.status(200).json({ message: 'A pipeline is already actively healing this commit.' });
    }

    // Infinite Loop Protector
    const hourAgoMain = new Date(Date.now() - 60 * 60 * 1000);
    const recentExecutionsCount = await Execution.countDocuments({
      repositoryId: repo._id,
      createdAt: { $gte: hourAgoMain }
    });

    if (recentExecutionsCount >= 100) {
      console.log(`\n⛔ INFINITE LOOP PREVENTION: AutoHeal executed ${recentExecutionsCount} times in last hour.`);
      return res.status(200).json({ message: 'Rate limit reached. Skipping.' });
    }

    // Create execution record
    const execution = await Execution.create({
      userId: user._id,
      repositoryId: repo._id,
      repoFullName,
      commitSha,
      branch,
      status: 'ci_failed',
      workflowId: workflowRun.workflow_id,
      workflowName: workflowRun.name,
      workflowRunId: runId,
      errorMessage: `CI workflow "${workflowRun.name}" failed`
    });

    console.log(`📋 Execution payload accepted: ${execution._id}`);
    res.status(200).json({ message: 'Webhook received, AutoHealing...', executionId: execution._id });

    // Run pipeline asynchronously
    (async () => {
      try {
        console.log('📄 Fetching CI logs...');
        let errorLogs = '';
        try {
          errorLogs = await fetchWorkflowLogs(githubToken, repoFullName, runId);
          execution.status = 'logs_processed';
          execution.errorLogs = errorLogs;
          await execution.save();
          console.log('✅ Logs fetched and processed');
        } catch (err) {
          execution.errorLogs = `Workflow failed. Basic logs only.`;
          await execution.save();
        }

        await runSelfHealingPipeline(execution, githubToken);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 AI PATCH GENERATED & PUSHED!`);
        console.log(`   Awaiting CI validation on the shadow branch before opening PR.`);
        console.log(`${'='.repeat(60)}\n`);
      } catch (pipelineError) {
        console.error(`❌ Pipeline failed autonomously: ${pipelineError.message}`);
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

/**
 * EVALUATE SHADOW BRANCH RESULTS
 * This is the core engine that decides if a fix is "Gold" (PR Created) 
 * or "Broken" (Retry Loop triggered).
 */
async function evaluateShadowBranchResults(githubToken, repo, existingExecution, conclusion, runId) {
  const branch = existingExecution.fixBranch;
  const repoFullName = repo.fullName;

  if (conclusion === 'success') {
    console.log(`\n🎉 SHADOW BRANCH PASSED VALIDATION! Opening PR...`);
    try {
      const prTitle = existingExecution.errorMessage || "🤖 AutoHeal Fix: Resolved pipeline failure";
      const prBody = existingExecution.errorLogs || "Automated fix generated by AutoHeal 2.0";

      const prData = await createPR(githubToken, repo.fullName, prTitle, prBody, branch, existingExecution.branch);

      existingExecution.prNumber = prData.number;
      existingExecution.prUrl = prData.html_url;
      existingExecution.status = 'pr_created';
      await existingExecution.save();
      console.log(`  ✅ PR officially created: ${prData.html_url}\n`);
    } catch (e) {
      console.error(`❌ Failed to create PR from successful shadow branch:`, e.response?.data || e.message);
    }
  } else if (conclusion === 'failure') {
    console.log(`\n❌ SHADOW BRANCH FAILED VALIDATION! The AI fix was incorrect.`);
    console.log(`🧹 Silently deleting broken shadow branch: ${branch}`);
    try {
      await deleteBranch(githubToken, repo.fullName, branch);
    } catch (e) {
      console.error(`⚠️ Could not automatically delete branch ${branch}`);
    }

    // ============================================
    // ♻️ SMART RETRY LOOP
    // ============================================
    console.log(`📄 Fetching failure logs from the broken shadow branch...`);
    let shadowLogs = '';
    try {
      shadowLogs = await fetchWorkflowLogs(githubToken, repoFullName, runId);
    } catch (e) {
      shadowLogs = "Shadow branch testing failed. Detailed logs could not be extracted.";
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const execCount = await Execution.countDocuments({ repositoryId: repo._id, createdAt: { $gte: hourAgo } });

    if (execCount >= 100) {
      console.log(`⛔ Circuit Breaker tripped. Max loop limit reached. Cannot auto-retry.`);
      return;
    }

    console.log(`♻️ TRIGGERING SMART RETRY. Booting up second AI attempt...`);
    const retryExecution = await Execution.create({
      userId: repo.userId,
      repositoryId: repo._id,
      repoFullName,
      commitSha: existingExecution.commitSha,
      branch: existingExecution.branch,
      status: 'logs_processed',
      workflowId: existingExecution.workflowId,
      workflowName: existingExecution.workflowName,
      workflowRunId: runId,
      errorMessage: `[Retry Loop] Shadow Branch failed. AutoHealing again.`
    });

    retryExecution.errorLogs = `🚨 URGENT: YOUR PREVIOUS FIX FAILED! 🚨
You successfully generated a fix, but when deployed to a test branch, the pipeline FAILED.

=== WHAT YOU TRIED LAST TIME ===
${existingExecution.errorMessage}
${existingExecution.errorLogs}

=== THE RESULTS (NEW FAILURE LOGS, LAST 4000 CHARS) ===
${shadowLogs.length > 4000 ? shadowLogs.slice(-4000) : shadowLogs}

Analyze why your last fix was insufficient or caused new errors. Generate a COMPLETELY NEW strategy to fix the codebase.`;
    await retryExecution.save();

    await Execution.findByIdAndDelete(existingExecution._id);

    runSelfHealingPipeline(retryExecution, githubToken).catch(async (err) => {
      console.error(`❌ Retry Pipeline crashed: ${err.message}`);
      retryExecution.status = 'error';
      retryExecution.errorMessage = `Retry loop failed: ${err.message}`;
      await retryExecution.save();
    });
  }
}

module.exports = { router, evaluateShadowBranchResults };
