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
          logs += `\n=== Job: ${job.name} ===\n${jobLogs}`;
        } catch (logErr) {
          logs += `\n=== Job: ${job.name} === (logs unavailable)\n`;
        }
      }
    }

    // Truncate to 5000 chars for AI context limits
    return logs.substring(0, 5000) || 'No failure logs captured';
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
  getPRDiff
};
