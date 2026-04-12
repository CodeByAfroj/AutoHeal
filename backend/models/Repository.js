const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  githubRepoId: {
    type: Number,
    required: true
  },
  fullName: {
    type: String,
    required: true,
    index: true
    // e.g., "octocat/hello-world"
  },
  name: {
    type: String,
    required: true
  },
  defaultBranch: {
    type: String,
    default: 'main'
  },
  language: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  webhookId: {
    type: Number,
    default: null
    // GitHub webhook ID, set when enabled
  },
  enabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate repo entries per user
repositorySchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);
