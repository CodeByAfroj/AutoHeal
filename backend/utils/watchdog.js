const Execution = require('../models/Execution');
const Repository = require('../models/Repository');
const { checkWorkflowStatus } = require('./github');
const { evaluateShadowBranchResults } = require('../routes/webhook');
const { decrypt } = require('./crypto');

/**
 * WATCHDOG ENGINE
 * Periodically scans for "Stuck" pipelines (ai_complete / validating) 
 * that haven't had a webhook update for a while.
 */
async function runWatchdog() {
  console.log('🐕 Watchdog: Checking for ghost pipelines...');
  
  // Find executions stuck in 'Wait for CI' stage for more than 10 minutes
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  const stuckPipelines = await Execution.find({
    status: 'ai_complete',
    updatedAt: { $lt: tenMinsAgo }
  });

  if (stuckPipelines.length === 0) return;

  console.log(`🐕 Watchdog: Found ${stuckPipelines.length} potentially stuck pipelines.`);

  for (const exec of stuckPipelines) {
    try {
      const repo = await Repository.findOne({ fullName: exec.repoFullName });
      if (!repo || !repo.installationToken) continue;

      const token = decrypt(repo.installationToken);
      const run = await checkWorkflowStatus(token, exec.repoFullName, exec.branch);

      if (!run) {
        console.warn(`   ⚠️ No workflow run found for ${exec.branch}. Marking as error.`);
        exec.status = 'error';
        exec.errorMessage = 'Shadow branch or workflow disappeared prematurely.';
        await exec.save();
        continue;
      }

      // If GitHub says it's finished, but we never got the webhook... Recover it!
      if (run.status === 'completed') {
        process.stdout.write(`   🔄 Recovering ${exec.branch}: Found completed run (${run.conclusion})\n`);
        
        if (run.conclusion === 'success') {
          // Recover SUCCESS: Create the final PR
          await createPR(token, exec.repoFullName, exec.branch, exec);
        } else if (run.conclusion === 'failure') {
          // Recover FAILURE: Trigger retry loop
          await handleShadowBranchFailure(token, exec.repoFullName, exec.branch, run.id, exec);
        }
      } else {
        // Still running on GitHub, just update our updatedAt to stop the watchdog from peaking again too soon
        exec.updatedAt = new Date();
        await exec.save();
      }
    } catch (err) {
      console.error(`   ❌ Watchdog failed for ${exec._id}:`, err.message);
    }
  }
}

module.exports = { runWatchdog };
