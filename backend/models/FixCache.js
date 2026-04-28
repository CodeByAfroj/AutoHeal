const mongoose = require('mongoose');

const FixCacheSchema = new mongoose.Schema({
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
  logFingerprint: { type: String, required: true },
  errorFingerprint: { type: String }, // Legacy support for ghost indexes
  successfulFix: {
    files: [{
      filePath: String,
      replacements: [{
        startLine: Number,
        endLine: Number,
        replace: String
      }]
    }]
  },
  resolvedAt: { type: Date, default: Date.now },
  originalError: String
});

// Compound unique index to prevent duplication while allowing legacy nulls
FixCacheSchema.index({ repositoryId: 1, logFingerprint: 1 }, { unique: true });

module.exports = mongoose.model('FixCache', FixCacheSchema);
