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

  const rcaPrompt = `
You are a Senior Site Reliability Engineer. Analyze this CI failure.

## CRITICAL RULES
1. **Target Files:** Identify up to 3 files that must be read to understand and fix the bug (e.g., the failing test file AND the suspected source code file).
2. **Fix Plan:** Provide a clear fix strategy. NEVER suggest changing a test expectation just to pass a test; fix the underlying logic.
3. **Holistic Audit:** Do not just focus on the single line that temporarily crashed the CI. Instruct the fix agent to broadly audit and fix ALL obvious syntax errors or logic bugs in these files to prevent future failures.

## Repository: ${repo} | Branch: ${branch}

## Repository Files:
${repoFiles.slice(0, 40).join('\n')}

## Error Logs:
${errorLogs.substring(0, 6000)}

## Return ONLY a valid JSON object (no markdown formatting):
{
  "error_type": "string",
  "files_to_read": ["path/to/test_file.js", "path/to/source.js"],
  "root_cause": "Clear description of the root cause",
  "fix_plan": "Specific plan to fix the bug",
  "confidence_score": 0.9
}`;

  let rca;
  try {
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
  const filesToRead = (rca.files_to_read || []).slice(0, 3).filter(Boolean);
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
2. Format: { "files": [{"filePath": "path/string", "content": "ENTIRE MODIFIED FILE WITH ALL BUGS FIXED"}] }
3. "content" MUST be the full, complete file (keep all original imports, code, and structures intact). Do NOT output snippets!
4. **HOLISTIC REPAIR:** While resolving the Root Cause is your primary goal, you MUST boldly review the entire file for ANY other syntax errors, typos, or logic bugs (e.g., missed operators, bad returns) and fix ALL of them in the final code. Do not wait for the pipeline to fail again!
5. **JSON COMPLIANCE:** The JSON must be strictly valid. Do NOT use Python-style triple quotes (\`\"\"\"\`) to wrap your strings. Use standard double quotes (\`\"\`) and explicitly escape all newlines with \`\\n\`.

## SOURCE FILES Context:
${filesContext.map(f => `--- FILE: ${f.path} ---\n${f.content}\n-----------------------`).join('\n\n')}`;

  let fixedFiles = [];
  try {
    // Keep maxTokens at 3000 to avoid hitting the 6000 Tokens Per Minute limit!
    const fixText = await callAI(fixPrompt, 3000);
    const cleanFixJson = fixText.replace(/```[a-z]*\n|```/g, '').trim();
    const parsedData = JSON.parse(cleanFixJson);
    fixedFiles = parsedData.files || [];
  } catch (e) {
    throw new Error(`AI fix code generation failed: ${e.message}`);
  }

  if (!Array.isArray(fixedFiles) || fixedFiles.length === 0) {
    throw new Error('AI generated no file updates or invalid format');
  }

  // Ensure an actual change was made natively (no complex patching needed)
  let actualChanges = 0;
  for (const fix of fixedFiles) {
    const original = filesContext.find(f => f.path === fix.filePath);
    if (!original) {
      fix.failedPatch = true;
      continue;
    }

    if (fix.content && fix.content !== original.content && fix.content.trim() !== '') {
      actualChanges++;
    } else {
      fix.failedPatch = true; // No change actually made
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
      await updateFile(githubToken, repo, fileFix.filePath, fileFix.content, commitMsg, fixBranch, sha);
      console.log(`  ✅ Fix committed to ${fileFix.filePath}`);
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
