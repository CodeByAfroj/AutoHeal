const CodeChunk = require('../models/CodeChunk');

// Cache the local embedder in memory so it doesn't reload the 80MB model repeatedly
let localEmbedder = null;

/**
 * Initialize the Hugging Face AI locally in WebAssembly 
 */
async function getEmbedder() {
  if (!localEmbedder) {
    console.log('🤖 Booting up Local Embedding Engine (all-MiniLM-L6-v2) ...');
    // Using dynamic import so CommonJS doesn't crash on ESM modules!
    const { pipeline } = await import('@xenova/transformers');
    localEmbedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return localEmbedder;
}

/**
 * Generate a single local embedding 
 */
async function generateEmbedding(text) {
  const extractor = await getEmbedder();
  // Pooling mean & normalize forces the vector to tightly conform to clustering algorithms
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Find the most relevant code chunks automatically
 */
async function findRelevantCodeChunks(errorLog, repositoryId, limit = 3) {
  console.log('🔍 Generating local offline embedding for error log...');
  const queryEmbedding = await generateEmbedding(errorLog);
  
  console.log('🔎 Querying MongoDB Atlas Vector Search...');
  return await CodeChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: limit
      }
    },
    { 
      $match: { repositoryId: repositoryId } 
    }
  ]);
}

/**
 * Upsert a single code chunk
 */
async function indexCodeChunk(repositoryId, filePath, functionName, codeContent) {
  const textToEmbed = `File: ${filePath}\nFunction: ${functionName}\nCode:\n${codeContent}`;
  const embedding = await generateEmbedding(textToEmbed);
  
  await CodeChunk.findOneAndUpdate(
    { repositoryId, filePath, functionName },
    { codeContent, embedding },
    { upsert: true, new: true }
  );
}

/**
 * Super-optimized Engine to embed tons of chunks without freezing Memory
 */
async function indexCodeChunksBatch(repositoryId, chunksData) {
  if (chunksData.length === 0) return;
  
  console.log(`🔎 [Local Ingestor] Crunching vectors for ${chunksData.length} chunks fully offline...`);
  
  try {
    const extractor = await getEmbedder();
    const allEmbeddings = [];
    
    // We process sequentially, it's insanely fast locally and prevents RAM spiking
    for (const chunk of chunksData) {
      const text = `File: ${chunk.filePath}\nFunction: ${chunk.functionName}\nCode:\n${chunk.codeContent}`;
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      allEmbeddings.push(Array.from(output.data));
    }

    const bulkOps = chunksData.map((chunk, idx) => ({
      updateOne: {
        filter: { repositoryId, filePath: chunk.filePath, functionName: chunk.functionName },
        update: { $set: { codeContent: chunk.codeContent, embedding: allEmbeddings[idx] } },
        upsert: true
      }
    }));
    
    if (bulkOps.length > 0) {
      await CodeChunk.bulkWrite(bulkOps);
    }
  } catch (e) {
    throw new Error(`Local embedding failed horribly: ${e.message}`);
  }
}

module.exports = {
  generateEmbedding,
  findRelevantCodeChunks,
  indexCodeChunk,
  indexCodeChunksBatch
};
