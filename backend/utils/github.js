const axios = require('axios');

const GITHUB_API = 'https://api.github.com';

/**
 * Fetch all repositories for a user (paginated)
 */
async function fetchUserRepos(token) {
  const repos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await axios.get(`${GITHUB_API}/user/repos`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        per_page: perPage,
        page,
        sort: 'updated',
        direction: 'desc',
        affiliation: 'owner,collaborator,organization_member'
      }
    });

    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * Create a webhook on a repository
 */
async function createWebhook(token, repoFullName, webhookUrl, secret) {
  const { data } = await axios.post(
    `${GITHUB_API}/repos/${repoFullName}/hooks`,
    {
      name: 'web',
      active: true,
      events: ['workflow_run'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: secret,
        insecure_ssl: '0'
      }
    },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  return data;
}

/**
 * Delete a webhook from a repository
 */
async function deleteWebhook(token, repoFullName, webhookId) {
  await axios.delete(
    `${GITHUB_API}/repos/${repoFullName}/hooks/${webhookId}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );
}

/**
 * Extract error/failure lines from logs with context
 */
function extractErrorLogs(fullLogs) {
  if (typeof fullLogs !== 'string') return '';
  const lines = fullLogs.split('\n');
  const errorKeywords = ['error', 'fail', 'exception', 'traceback', 'reject', 'fatal', 'err'];

  let interestingIndices = new Set();
  const contextSize = 5; // lines before and after an error line

  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    // Typical log format checking
    if (errorKeywords.some(kw => lowerLine.includes(kw))) {
      for (let j = Math.max(0, i - contextSize); j <= Math.min(lines.length - 1, i + contextSize); j++) {
        interestingIndices.add(j);
      }
    }
  }

  // If no clear errors found, fallback to last 100 lines
  if (interestingIndices.size === 0) {
    return lines.slice(-100).join('\n');
  }

  // Sort and reconstruct logs with context blocks
  const sortedIndices = Array.from(interestingIndices).sort((a, b) => a - b);
  const result = [];

  let lastIdx = -2;
  for (const idx of sortedIndices) {
    if (lastIdx !== -2 && idx > lastIdx + 1) {
      result.push('... [Logs Skipped] ...');
    }
    result.push(lines[idx]);
    lastIdx = idx;
  }

  return result.join('\n');
}

/**
 * Fetch workflow run logs as text
 */
async function fetchWorkflowLogs(token, repoFullName, runId) {
  try {
    // Get the jobs for this workflow run
    const { data: jobsData } = await axios.get(
      `${GITHUB_API}/repos/${repoFullName}/actions/runs/${runId}/jobs`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    // Collect failed job logs
    let logs = '';
    for (const job of jobsData.jobs) {
      if (job.conclusion === 'failure') {
        try {
          const { data: jobLogs } = await axios.get(
            `${GITHUB_API}/repos/${repoFullName}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
              },
              maxRedirects: 5
            }
          );

          const filteredLogs = extractErrorLogs(jobLogs);
          logs += `\n=== Job: ${job.name} (Errors Extracted) ===\n${filteredLogs}\n`;
        } catch (logErr) {
          logs += `\n=== Job: ${job.name} === (logs unavailable)\n`;
        }
      }
    }

    // Limit the final payload just in case there are too many errors
    return logs.substring(0, 10000) || 'No failure logs captured';
  } catch (error) {
    console.error('Error fetching workflow logs:', error.message);
    return 'Error fetching logs: ' + error.message;
  }
}

/**
 * Merge a pull request
 */
async function mergePR(token, repoFullName, prNumber) {
  const { data } = await axios.put(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}/merge`,
    {
      merge_method: 'squash',
      commit_title: `🤖 Auto-merge: Self-Healing Fix #${prNumber}`
    },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  return data;
}

/**
 * Close a pull request
 */
async function closePR(token, repoFullName, prNumber) {
  const { data } = await axios.patch(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}`,
    { state: 'closed' },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  // Add a comment
  await axios.post(
    `${GITHUB_API}/repos/${repoFullName}/issues/${prNumber}/comments`,
    { body: '❌ **AI fix rejected** by user. PR closed.' },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  return data;
}

/**
 * Get pull request diff
 */
async function getPRDiff(token, repoFullName, prNumber) {
  const { data } = await axios.get(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.diff'
      }
    }
  );

  return data;
}

module.exports = {
  fetchUserRepos,
  createWebhook,
  deleteWebhook,
  fetchWorkflowLogs,
  mergePR,
  closePR,
  getPRDiff,
  checkWorkflowStatus: async (token, repoFullName, branch) => {
    const { data } = await axios.get(
      `${GITHUB_API}/repos/${repoFullName}/actions/runs`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        },
        params: { branch, per_page: 1 }
      }
    );
    return data.workflow_runs?.[0] || null;
  }
};
