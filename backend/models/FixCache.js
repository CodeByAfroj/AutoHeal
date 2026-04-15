const mongoose = require('mongoose');

const fixCacheSchema = new mongoose.Schema({
  // A hash of the normalized error message to detect identical crashes instantly
  errorFingerprint: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  errorType: String,
  rootCause: String,
  fixStrategy: String,
  // We store the 'solution pattern' so we can apply it to other files with similar issues
  fixPattern: mongoose.Schema.Types.Mixed,
  successCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FixCache', fixCacheSchema);
