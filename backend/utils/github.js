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
  let resultLines = [];
  
  // 1. Find the primary failure blocks (FAIL)
  let inFailBlock = false;
  let failBlockLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Start of a Jest failure block
    if (line.includes('FAIL ')) {
      inFailBlock = true;
      failBlockLines.push(`\n--- PRIMARY FAILURE DETECTED ---\n${line}`);
      continue;
    }
    
    if (inFailBlock) {
      failBlockLines.push(line);
      // End of block is usually a summary or the start of another job
      if (line.includes('Test Suites:') || line.includes('Done in ') || line.includes('--- PRIMARY FAILURE')) {
        inFailBlock = false;
      }
    }
    
    // Also capture lines with explicit Reference/Syntax errors
    if (line.includes('ReferenceError') || line.includes('SyntaxError') || line.includes('TypeError')) {
      // Capture context around these errors
      for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 15); j++) {
        resultLines.push(lines[j]);
      }
    }
  }

  const finalLogs = [...failBlockLines, ...resultLines].join('\n');
  
  // If nothing specific found, fallback to the last 150 lines
  if (finalLogs.trim().length < 50) {
    return lines.slice(-150).join('\n');
  }

  return finalLogs.substring(0, 15000); // Plenty of room for context
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
