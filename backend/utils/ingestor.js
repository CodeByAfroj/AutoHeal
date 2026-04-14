const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { parseAndChunkFile } = require('./ast');
const { indexCodeChunk, indexCodeChunksBatch } = require('./rag');

/**
 * Recursively find all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      // Ignore huge dependency folders or git histories
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });
  return arrayOfFiles;
}

/**
 * Download a GitHub repository and index all its functions into MongoDB Vector Store
 */
async function ingestRepository(repositoryId, fullName, token, branch) {
  console.log(`\n📥 [Ingestor] Starting background ingestion for ${fullName}...`);
  const tmpDir = path.join(os.tmpdir(), `autoheal-${repositoryId}-${Date.now()}`);
  
  try {
    // 1. Clone repository extremely fast (depth 1) into a temporary memory store
    const repoUrl = `https://oauth2:${token}@github.com/${fullName}.git`;
    console.log(`   [Ingestor] Cloning ${fullName} to temporal isolated directory...`);
    await execAsync(`git clone --depth 1 --branch ${branch} https://oauth2:${token}@github.com/${fullName}.git ${tmpDir}`);
    
    // 2. Scan all files
    const allFiles = getAllFiles(tmpDir);
    
    // Filter out purely documentation or config files. Target only logic.
    const sourceFiles = allFiles.filter(file => {
      const ext = path.extname(file);
      return ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go'].includes(ext);
    });

    console.log(`   [Ingestor] Scanned ${sourceFiles.length} raw source files.`);

    // 3. Process, AST-Chunk, and Vector Index every file
    let chunkCount = 0;
    const allChunksData = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = file.substring(tmpDir.length + 1);
      
      let lang = 'javascript';
      if (file.endsWith('.py')) lang = 'python';
      else if (file.endsWith('.java')) lang = 'java';
      
      try {
        // Run the AST parser to extract individual functions
        const { chunks } = await parseAndChunkFile(content, lang);
        
        for (const chunk of chunks) {
           allChunksData.push({
             filePath: relativePath,
             functionName: chunk.name,
             codeContent: chunk.content
           });
        }
      } catch (err) {
         console.warn(`   ⚠️ Skipping chunking for ${relativePath}: ${err.message}`);
      }
    }

    if (allChunksData.length > 0) {
      console.log(`   [Ingestor] Analyzed ${allChunksData.length} chunks. Sending as a single mega-batch to Gemini to evade rate limits...`);
      await indexCodeChunksBatch(repositoryId, allChunksData);
      chunkCount = allChunksData.length;
    }
    
    console.log(`🎉 [Ingestor] Success! ${chunkCount} new Code Chunks injected into the Vector DB for ${fullName}\n`);
  } catch (error) {
    if (error.message.includes('GEMINI_API_KEY')) {
       console.log(`❌ [Ingestor] Aborted: You must add GEMINI_API_KEY to your .env to convert code to vectors!`);
    } else {
       console.error(`❌ [Ingestor] Failed computing vectors for ${fullName}:`, error.message);
    }
  } finally {
    // 4. Clean up the isolated temporal directory
    if (fs.existsSync(tmpDir)) {
      await execAsync(`rm -rf ${tmpDir}`);
      console.log(`🧹 [Ingestor] Temporal environment destroyed.`);
    }
  }
}

module.exports = { ingestRepository };
