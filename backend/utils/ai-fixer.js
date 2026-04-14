const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getBaseSha, createBranch, getFileContent, updateFile, createPR, getRepoTree } = require('./git-ops');

/**
 * Call AI with Groq (primary) or Gemini (fallback)
 * We use Llama 3.1 8B by default to preserve organization tokens (high daily limits).
 */
async function callAI(prompt, maxTokens = 2000) {
  // 🧠 Core Model Fallback Roster
  const groqModels = [
    'llama-3.3-70b-versatile', // Try the smartest model first
    'llama-3.1-8b-instant'     // Guaranteed alive fallback
  ];

  if (process.env.GROQ_API_KEY) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    for (const model of groqModels) {
      try {
        console.log(`   🧠 Using Groq (${model})...`);
        const response = await groq.chat.completions.create({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        });
        console.log('   ✅ Groq response received');
        return response.choices[0]?.message?.content || '';
      } catch (e) {
        if (e.message.includes('429')) {
          console.warn(`   ⚠️ Model [${model}] rate limited. Engaging fallback cascade...`);
          continue; // Instantly fall back to the next high-billion model
        }
        console.warn(`   ⚠️ Groq failed on ${model}: ${e.message}`);
      }
    }
  }

  // Fallback: Gemini
  if (process.env.GEMINI_API_KEY) {
    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    for (const modelName of models) {
      try {
        console.log(`   🧠 Trying Gemini ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(prompt);
        console.log(`   ✅ Gemini ${modelName} response received`);
        return response.response.text();
      } catch (e) {
        const isRateLimit = e.message?.includes('429') || e.message?.includes('quota');
        if (isRateLimit) {
          console.log(`   ⚠️ ${modelName} rate limited, trying next...`);
          continue;
        }
        throw e;
      }
    }
  }

  throw new Error('No AI provider available. Set GROQ_API_KEY or GEMINI_API_KEY in .env');
}

/**
 * Run the full AI self-healing pipeline:
 * 1. Analyze logs with AI → Root Cause Analysis
 * 2. Read the target file from GitHub
 * 3. Generate a fix with AI
 * 4. Create branch, commit fix, open PR
 */
async function runSelfHealingPipeline(execution, githubToken) {
  const repo = execution.repoFullName;
  const branch = execution.branch || 'main';
  const errorLogs = execution.errorLogs || '';

  console.log(`🤖 Starting AI self-healing for ${repo}...`);

  // ============================================
  // STEP 1: Root Cause Analysis (Multi-file)
  // ============================================
  console.log('📊 Step 1: AI Root Cause Analysis...');

  let repoFiles = [];
  try {
    repoFiles = await getRepoTree(githubToken, repo, branch);
  } catch (e) {
    console.warn('Could not fetch repo tree:', e.message);
  }

  // ============================================
  // STEP 1.5: RAG Vector Search (Atlas)
  // ============================================
  const { findRelevantCodeChunks } = require('./rag');
  let ragContext = "";
  try {
    console.log('🔍 Querying MongoDB Vector Database for semantic matches...');
    // Search the vector DB using the last 1000 characters of the error log
    const errorSnippet = errorLogs.length > 1000 ? errorLogs.slice(-1000) : errorLogs;
    const chunks = await findRelevantCodeChunks(errorSnippet, execution.repositoryId);
    
    if (chunks && chunks.length > 0) {
      ragContext = `\n## RAG VECTOR DATABASE MATCHES:\n(The following code chunks were mathematically identified as highly relevant to the error logs)\n\n`;
      chunks.forEach(c => {
         ragContext += `--- FILE: ${c.filePath} | FUNCTION: ${c.functionName} ---\n${c.codeContent}\n\n`;
      });
      console.log(`✅ RAG identified ${chunks.length} semantically relevant code chunks!`);
    } else {
      console.log('⚠️ No RAG matches found. (Repository might not be fully indexed).');
    }
  } catch (e) {
    if (e.message.includes('GEMINI_API_KEY')) {
      console.log('⚠️ RAG skipped: GEMINI_API_KEY is not configured yet.');
    } else {
      console.warn('⚠️ Vector Search error:', e.message);
    }
  }

  const rcaPrompt = `
You are a Senior Site Reliability Engineer. Analyze this CI failure.

## CRITICAL RULES
1. **Target Files:** Identify up to 3 files that must be read to understand and fix the bug (e.g., the failing test file AND the suspected source code file).
2. **Fix Plan:** Provide a clear fix strategy. **KEEP IT EXTREMELY SHORT** (Maximum 2 brief sentences). NO bulky paragraphs. NO polite chat. Explain exactly what to edit.
3. **Holistic Audit:** Do not focus only on the crashing line. Fix ALL obvious syntax errors or logic bugs in these files.
4. **Security Hardening:** NEVER target, select, or modify ANY file located inside the '.github/' directory natively. The API tokens do not have workflow modification scopes and attempting to fix them will cause a fatal 404 crash.

## Repository: ${repo} | Branch: ${branch}

## Repository Files:
${repoFiles.slice(0, 50).join('\n')}
${ragContext}
## Error Logs (Last 4000 chars):
${errorLogs.length > 4000 ? errorLogs.slice(-4000) : errorLogs}

## Return ONLY a valid JSON object (no markdown formatting):
{
  "error_type": "string",
  "files_to_read": ["path/to/test_file.js", "path/to/source.js"],
  "root_cause": "EXACT error only. Maximum 1-2 short sentences. No large explanations.",
  "fix_plan": "Exact solution. Maximum 1-2 short sentences. Do not hallucinate massive paragraphs.",
  "confidence_score": 0.9
}`;

  let rca;
  try {
    // RCA strictly doesn't need many max tokens as we only ask for JSON
    const rcaText = await callAI(rcaPrompt, 1000);
    const cleanJson = rcaText.replace(/```[a-z]*\n|```/g, '').trim();
    rca = JSON.parse(cleanJson);
    console.log(`✅ RCA Complete. Target Files: ${rca.files_to_read?.join(', ')}`);
  } catch (e) {
    console.error('❌ RCA failed:', e.message);
    throw new Error(`AI RCA failed: ${e.message}`);
  }

  execution.rcaResult = {
    rootCause: rca.root_cause,
    targetFile: rca.files_to_read ? rca.files_to_read.join(', ') : 'unknown',
    fixPlan: rca.fix_plan,
    confidenceScore: rca.confidence_score || 0,
    errorType: rca.error_type
  };
  execution.status = 'ai_running';
  await execution.save();

  // ============================================
  // STEP 2: Read multiple files from GitHub
  // ============================================
  // Increased to 5 files to catch nested Python imports/config files perfectly!
  const filesToRead = (rca.files_to_read || []).slice(0, 5).filter(Boolean);
  if (filesToRead.length === 0) {
    throw new Error('No files identified by AI to read');
  }

  console.log(`📄 Step 2: Reading ${filesToRead.length} files from GitHub...`);
  
  const filesContext = [];
  try {
    const fetchPromises = filesToRead.map(async (filePath) => {
      const data = await getFileContent(githubToken, repo, filePath, branch);
      return { path: filePath, content: data.content, sha: data.sha };
    });
    const results = await Promise.all(fetchPromises);
    filesContext.push(...results);
  } catch (e) {
    throw new Error(`Failed to read source files: ${e.message}`);
  }

  // ============================================
  // STEP 3: Generate multi-file fix with AI
  // ============================================
  console.log('🔧 Step 3: Generating AI multi-file fix...');

  const fixPrompt = `
You are an Autonomous Senior Software Engineer. Fix a confirmed bug.

## CONTEXT
- **Repository:** ${repo}
- **Root Cause:** ${rca.root_cause}
- **Fix Plan:** ${rca.fix_plan}

## RULES
1. Return ONLY a valid JSON OBJECT containing a "files" array representing the files you fixed.
2. Format: { "files": [{"filePath": "path/string", "replacements": [{"startLine": number, "endLine": number, "replace": "new code"}]}] }
3. You MUST use the "replacements" array to specify blocks of lines to rewrite. "replace" must contain the exact new code that will substitute the original lines from "startLine" to "endLine" (inclusive).
4. "startLine" and "endLine" are 1-based, matching the line numbers provided in the SOURCE FILES Context.
5. **PYTHON/SYNTAX INDENTATION:** You MUST flawlessly preserve the exact indentation (spaces/tabs) of the block you are replacing. If fixing Python, missing spacing will cause IndentationErrors and fail the CI autonomously!
6. **HOLISTIC REPAIR:** Fix ALL obvious syntax errors or logic bugs in these files. Provide multiple replacement blocks if needed.
7. **JSON COMPLIANCE:** The JSON must be strictly valid. Do NOT use Python-style triple quotes (\`\"\"\"\`) to wrap your strings. Use standard double quotes (\`\"\`) and explicitly escape all newlines with \`\\n\`.
8. CRITICAL: To reduce tokens, **DO NOT output the entire file**. Only output the line blocks you are replacing!
9. **PYTHON IMPORT HACK:** If the error is a pytest 'ModuleNotFoundError', 'ImportError', or 'No module named...', ALWAYS inject this exact block at the very top of the failing test file: \`import sys, os; sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))\`. This solves the issue instantly!

## SOURCE FILES Context (with line numbers):
${filesContext.map(f => {
  const numberedContent = f.content.split('\n').map((line, idx) => `${idx + 1}: ${line}`).join('\n');
  return `--- FILE: ${f.path} ---\n${numberedContent}\n-----------------------`;
}).join('\n\n')}`;

  let fixedFiles = [];
  let jsonRetries = 3;
  
  while (jsonRetries > 0) {
    try {
      // Keep maxTokens at 3000 to avoid hitting the 6000 Tokens Per Minute limit!
      const fixText = await callAI(fixPrompt, 3000);
      const cleanFixJson = fixText.replace(/```[a-z]*\n|```/g, '').trim();
      const parsedData = JSON.parse(cleanFixJson);
      fixedFiles = parsedData.files || [];
      break; // Success! Break out of the retry loop.
    } catch (e) {
      jsonRetries--;
      if (jsonRetries === 0) {
        throw new Error(`AI generated malformed JSON heavily (SyntaxError): ${e.message}`);
      }
      console.warn(`   ⚠️ AI JSON parse failed (likely quote escaping issue). Retrying... (${e.message})`);
    }
  }

  if (!Array.isArray(fixedFiles) || fixedFiles.length === 0) {
    throw new Error('AI generated no file updates or invalid format');
  }

  // 🛡️ DEDUPLICATION ALGORITHM: Merge multiple JSON objects targeting the same file
  // If the AI hallucinates [ {file: A, replace: X}, {file: A, replace: Y} ], this merges them into {file: A, replace: [X,Y]}
  // This prevents the AI from overwriting its own code and stops multiple sequentially-crashing 409 GitHub Push requests!
  const mergedFilesMap = new Map();
  for (const fix of fixedFiles) {
    if (!fix.filePath || !Array.isArray(fix.replacements)) continue;
    if (mergedFilesMap.has(fix.filePath)) {
      mergedFilesMap.get(fix.filePath).replacements.push(...fix.replacements);
    } else {
      mergedFilesMap.set(fix.filePath, { filePath: fix.filePath, replacements: [...fix.replacements] });
    }
  }
  fixedFiles = Array.from(mergedFilesMap.values());

  // Ensure actual changes were applied accurately
  let actualChanges = 0;
  for (const fix of fixedFiles) {
    const original = filesContext.find(f => f.path === fix.filePath);
    if (!original) {
      fix.failedPatch = true;
      continue;
    }

    try {
      if (fix.replacements && Array.isArray(fix.replacements) && fix.replacements.length > 0) {
        let lines = original.content.split('\n');
        
        // Sort replacements descending to avoid shifting line numbers as we apply patches
        const sortedReplacements = [...fix.replacements].sort((a, b) => b.startLine - a.startLine);
        
        for (const r of sortedReplacements) {
          const startIdx = r.startLine - 1;
          const endIdx = r.endLine - 1;
          
          if (startIdx >= 0 && endIdx < lines.length && startIdx <= endIdx) {
            const replaceLines = r.replace.split('\n');
            lines.splice(startIdx, endIdx - startIdx + 1, ...replaceLines);
            actualChanges++;
          } else {
             throw new Error(`Invalid line range: ${r.startLine}-${r.endLine}`);
          }
        }
        
        // Save the patched content back onto the fix object so the native commit flow works
        fix.content = lines.join('\n');
      } else {
        fix.failedPatch = true; // No replacements found
      }
    } catch (e) {
      console.warn(`⚠️ Patch application failed for ${fix.filePath}: ${e.message}`);
      fix.failedPatch = true;
    }
  }

  // Purge any files where patches failed to apply cleanly
  fixedFiles = fixedFiles.filter(f => !f.failedPatch);

  if (fixedFiles.length === 0 || actualChanges === 0) {
    throw new Error('AI generated no valid patches, or patches failed to match source code.');
  }

  execution.status = 'ai_complete';
  await execution.save();
  console.log(`✅ AI generated fixes for ${fixedFiles.length} files`);

  // ============================================
  // STEP 4: Create branch, commit sequentially, PR
  // ============================================
  console.log('📤 Step 4: Creating branch, committing files, and opening PR...');

  const fixBranch = `fix/autoheal-${Date.now()}`;

  try {
    const baseSha = await getBaseSha(githubToken, repo, branch);
    await createBranch(githubToken, repo, fixBranch, baseSha);
    console.log(`  ✅ Branch created: ${fixBranch}`);

    const commitMsg = `🤖 AutoHeal Fix: ${(rca.root_cause || 'Bug fix').substring(0, 60)}`;
    
    // Commit each changed file sequentially to the same branch
    for (const fileFix of fixedFiles) {
      const original = filesContext.find(f => f.path === fileFix.filePath);
      const sha = original ? original.sha : undefined; // if undefined, it's a new file
      
      let retries = 3;
      while (retries > 0) {
        try {
          await updateFile(githubToken, repo, fileFix.filePath, fileFix.content, commitMsg, fixBranch, sha);
          console.log(`  ✅ Fix committed to ${fileFix.filePath}`);
          break;
        } catch (e) {
          if (e.response && e.response.status === 409 && retries > 1) {
            console.log(`  ⚠️ GitHub API Race Condition (409) detected on ${fileFix.filePath}. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            retries--;
          } else {
            throw e;
          }
        }
      }
    }

    const prTitle = `🤖 AutoHeal Fix: ${(rca.root_cause || 'Automated multi-file fix').substring(0, 60)}`;
    const prBody = `### 🤖 AutoHeal — AI-Generated Fix
    
**Root Cause:** ${rca.root_cause}
**Modified Files:** \n${fixedFiles.map(f => `- \`${f.filePath}\``).join('\n')}
**Fix Plan:** ${rca.fix_plan}

---
_Generated automatically by AutoHeal 2.0_`;

    // 🌟 SHADOW BRANCHING: We DO NOT open a Pull Request yet!
    // GitHub will run the CI on this new pushed branch. Our webhook will listen for the result.
    console.log(`  ✅ Shadow Branch pushed! Waiting for GitHub CI to run on this branch...`);

    execution.fixBranch = fixBranch;
    // We store the generated prTitle/prBody temporarily in errorType/errorMessage so webhook can read them later easily
    execution.errorMessage = prTitle;
    execution.errorLogs = prBody; 
    execution.status = 'ai_complete';
    await execution.save();

    return {
      success: true,
      fixBranch,
      targetFile: fixedFiles.map(f => f.filePath).join(', '),
      rootCause: rca.root_cause
    };
  } catch (e) {
    throw new Error(`Git branch push failed: ${e.message}`);
  }
}

module.exports = { runSelfHealingPipeline };
