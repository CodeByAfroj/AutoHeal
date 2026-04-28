const mongoose = require('mongoose');

const FixFailureSchema = new mongoose.Schema({
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
  logFingerprint: { type: String, required: true, index: true },
  failedCode: mongoose.Schema.Types.Mixed,
  failureReason: String,
  attempts: { type: Number, default: 1 },
  lastFailedAt: { type: Date, default: Date.now }
});

// Optimized for fast retrieval during AI analysis
FixFailureSchema.index({ repositoryId: 1, logFingerprint: 1 });

module.exports = mongoose.model('FixFailure', FixFailureSchema);
