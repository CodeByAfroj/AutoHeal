const mongoose = require('mongoose');

const executionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  repoFullName: {
    type: String,
    required: true
  },
  commitSha: {
    type: String,
    default: ''
  },
  branch: {
    type: String,
    default: 'main'
  },
  status: {
    type: String,
    enum: [
      'ci_failed',
      'logs_processed',
      'ai_running',
      'ai_complete',
      'pr_created',
      'awaiting_approval',
      'approved',
      'merged',
      'rejected',
      'error'
    ],
    default: 'ci_failed'
  },
  kestraExecutionId: {
    type: String,
    default: ''
  },
  errorLogs: {
    type: String,
    default: ''
  },
  rcaResult: {
    rootCause: { type: String, default: '' },
    targetFile: { type: String, default: '' },
    fixPlan: { type: String, default: '' },
    confidenceScore: { type: Number, default: 0 }
  },
  prUrl: {
    type: String,
    default: ''
  },
  prNumber: {
    type: Number,
    default: null
  },
  fixBranch: {
    type: String,
    default: ''
  },
  workflowRunId: {
    type: Number,
    default: null
  },
  errorMessage: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Execution', executionSchema);
