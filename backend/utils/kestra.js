const axios = require('axios');

const KESTRA_URL = process.env.KESTRA_API_URL || 'http://localhost:8080';
const NAMESPACE = 'company.self-healing';
const FLOW_ID = 'failure-intake-rca';

/**
 * Trigger a Kestra flow execution
 * Uses multipart form data to pass inputs
 */
async function triggerFlow(inputs) {
  const url = `${KESTRA_URL}/api/v1/executions/${NAMESPACE}/${FLOW_ID}`;

  // Build form data
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(inputs)) {
    formData.append(key, value || '');
  }

  const { data } = await axios.post(url, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return data;
}

/**
 * Get execution status from Kestra
 */
async function getExecutionStatus(executionId) {
  const url = `${KESTRA_URL}/api/v1/executions/${executionId}`;

  const { data } = await axios.get(url);
  return data;
}

/**
 * Map Kestra task states to our pipeline stages
 */
function mapKestraStatus(kestraExecution) {
  if (!kestraExecution || !kestraExecution.taskRunList) {
    return { stage: 'ai_running', detail: 'Waiting for Kestra...' };
  }

  const taskRuns = kestraExecution.taskRunList;
  const state = kestraExecution.state?.current;

  // Check for overall failure
  if (state === 'FAILED') {
    return { stage: 'error', detail: 'Kestra flow failed' };
  }

  // Map based on completed tasks
  const completedTasks = taskRuns
    .filter(t => t.state?.current === 'SUCCESS')
    .map(t => t.taskId);

  if (completedTasks.includes('trigger_pr_creation') || completedTasks.includes('call_pr_creator')) {
    return { stage: 'pr_created', detail: 'Pull request created' };
  }

  if (completedTasks.includes('clone_and_fix') || completedTasks.includes('trigger_code_fixer')) {
    return { stage: 'ai_complete', detail: 'AI fix generated' };
  }

  if (completedTasks.includes('ai_root_cause_analysis') || completedTasks.includes('parse_rca_response')) {
    return { stage: 'ai_running', detail: 'AI analyzing and generating fix...' };
  }

  if (completedTasks.includes('normalize_logs')) {
    return { stage: 'logs_processed', detail: 'Logs normalized' };
  }

  if (completedTasks.includes('extract_inputs')) {
    return { stage: 'logs_processed', detail: 'Processing inputs...' };
  }

  if (state === 'RUNNING') {
    return { stage: 'ai_running', detail: 'Pipeline executing...' };
  }

  if (state === 'SUCCESS') {
    return { stage: 'pr_created', detail: 'Pipeline complete' };
  }

  return { stage: 'ai_running', detail: `State: ${state || 'unknown'}` };
}

module.exports = {
  triggerFlow,
  getExecutionStatus,
  mapKestraStatus
};
