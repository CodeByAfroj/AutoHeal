const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Repository = require('../models/Repository');
const { decrypt } = require('../utils/crypto');
const { fetchUserRepos, createWebhook, deleteWebhook } = require('../utils/github');
const router = express.Router();

// Simple in-memory cache to store GitHub repositories
// Key: userId, Value: { data: repos, timestamp: number }
const repoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/*
 * GET /api/repos
 * Fetch user's GitHub repositories
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get user with encrypted token
    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);

    let githubRepos;
    const cached = repoCache.get(req.userId);

    // Check if we have valid cached repositories for this user
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      githubRepos = cached.data;
    } else {
      // Fetch repos from GitHub and update cache
      githubRepos = await fetchUserRepos(token);
      repoCache.set(req.userId, { data: githubRepos, timestamp: Date.now() });
    }

    // Get enabled repos from our DB
    const enabledRepos = await Repository.find({
      userId: req.userId,
      enabled: true
    });
    const enabledIds = new Set(enabledRepos.map(r => r.githubRepoId));

    // Map and merge
    const repos = githubRepos.map(repo => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      private: repo.private,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at,
      enabled: enabledIds.has(repo.id)
    }));

    res.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

/*
 * POST /api/repos/:repoId/enable
 * Enable self-healing for a repository (creates webhook)
 */
router.post('/:repoId/enable', authMiddleware, async (req, res) => {
  try {
    const { repoId } = req.params;
    const { fullName, name, defaultBranch, language, description } = req.body;

    // Get user token
    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);

    // Build webhook URL
    const baseUrl = process.env.NGROK_URL || `http://localhost:${process.env.PORT || 8000}`;
    const webhookUrl = `${baseUrl}/webhook/github`;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let webhookId = null;

    try {
      // Try to create webhook
      const webhookData = await createWebhook(token, fullName, webhookUrl, webhookSecret);
      webhookId = webhookData.id;
    } catch (webhookErr) {
      // If webhook already exists, find it and reuse
      if (webhookErr.response?.status === 422) {
        console.log('⚠️  Webhook already exists, finding existing...');
        try {
          const { default: axios } = await import('axios');
          const listRes = await axios.get(
            `https://api.github.com/repos/${fullName}/hooks`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
          );
          const existing = listRes.data.find(h => h.config?.url?.includes('/webhook/github'));
          if (existing) {
            webhookId = existing.id;
            console.log(`✅ Found existing webhook: ${webhookId}`);
          }
        } catch (listErr) {
          console.warn('Could not list webhooks:', listErr.message);
        }
      } else {
        throw webhookErr;
      }
    }

    // Upsert repository in DB
    const repo = await Repository.findOneAndUpdate(
      { userId: req.userId, githubRepoId: parseInt(repoId) },
      {
        userId: req.userId,
        githubRepoId: parseInt(repoId),
        fullName,
        name,
        defaultBranch: defaultBranch || 'main',
        language: language || '',
        description: description || '',
        webhookId: webhookId,
        enabled: true
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Self-healing enabled',
      repository: repo,
      webhookId: webhookId
    });
  } catch (error) {
    console.error('Error enabling repo:', error.message);
    res.status(500).json({ error: 'Failed to enable self-healing' });
  }
});

/*
 * POST /api/repos/:repoId/disable
 * Disable self-healing for a repository (deletes webhook)
 */
router.post('/:repoId/disable', authMiddleware, async (req, res) => {
  try {
    const { repoId } = req.params;

    // Find the repo in our DB
    const repo = await Repository.findOne({
      userId: req.userId,
      githubRepoId: parseInt(repoId)
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Get user token
    const user = await User.findById(req.userId);
    const token = decrypt(user.accessToken);

    // Delete webhook from GitHub
    if (repo.webhookId) {
      try {
        await deleteWebhook(token, repo.fullName, repo.webhookId);
      } catch (err) {
        // Webhook may have been manually deleted
        console.warn('Webhook deletion warning:', err.message);
      }
    }

    // Update DB
    repo.enabled = false;
    repo.webhookId = null;
    await repo.save();

    res.json({ message: 'Self-healing disabled', repository: repo });
  } catch (error) {
    console.error('Error disabling repo:', error.message);
    res.status(500).json({ error: 'Failed to disable self-healing' });
  }
});

module.exports = router;
