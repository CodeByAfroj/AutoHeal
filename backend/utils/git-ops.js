const axios = require('axios');

const GITHUB_API = 'https://api.github.com';

/**
 * Get the base branch's latest SHA
 */
async function getBaseSha(token, repo, branch) {
  const { data } = await axios.get(
    `${GITHUB_API}/repos/${repo}/git/ref/heads/${branch}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  return data.object.sha;
}

/**
 * Create a new branch from the base branch
 */
async function createBranch(token, repo, branchName, baseSha) {
  const { data } = await axios.post(
    `${GITHUB_API}/repos/${repo}/git/refs`,
    { ref: `refs/heads/${branchName}`, sha: baseSha },
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  return data;
}

/**
 * Get a file's content from a repo
 */
async function getFileContent(token, repo, filePath, branch) {
  const { data } = await axios.get(
    `${GITHUB_API}/repos/${repo}/contents/${filePath}`,
    {
      params: { ref: branch },
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    }
  );
  return {
    content: Buffer.from(data.content, 'base64').toString('utf8'),
    sha: data.sha
  };
}

/**
 * Update (commit) a file on a branch
 */
async function updateFile(token, repo, filePath, content, message, branch, fileSha) {
  const { data } = await axios.put(
    `${GITHUB_API}/repos/${repo}/contents/${filePath}`,
    {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: fileSha
    },
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  return data;
}

/**
 * Create a pull request
 */
async function createPR(token, repo, title, body, head, base) {
  const { data } = await axios.post(
    `${GITHUB_API}/repos/${repo}/pulls`,
    { title, body, head, base },
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  return data;
}

/**
 * Get repo tree to list files
 */
async function getRepoTree(token, repo, branch) {
  const { data } = await axios.get(
    `${GITHUB_API}/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  return data.tree.filter(t => t.type === 'blob').map(t => t.path);
}

/**
 * Delete a branch (ref)
 */
async function deleteBranch(token, repo, branchName) {
  try {
    const { data } = await axios.delete(
      `${GITHUB_API}/repos/${repo}/git/refs/heads/${branchName}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    return data;
  } catch (e) {
    if (e.response && e.response.status === 422) return; // Already deleted
    throw e;
  }
}

module.exports = {
  getBaseSha,
  createBranch,
  getFileContent,
  updateFile,
  createPR,
  getRepoTree,
  deleteBranch
};
