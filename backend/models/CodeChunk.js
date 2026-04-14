const mongoose = require('mongoose');

const codeChunkSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  functionName: {
    type: String, // from AST
  },
  codeContent: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('CodeChunk', codeChunkSchema);
