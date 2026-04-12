const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getBaseSha, createBranch, getFileContent, updateFile, createPR, getRepoTree } = require('./git-ops');

/**
 * Call AI with Groq (primary) or Gemini (fallback)
 * Groq free tier: 14,400 req/day — much more generous than Gemini
 */
async function callAI(prompt) {
  // Try Groq first (generous free tier)
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('   🧠 Using Groq (llama-3.3-70b-versatile)...');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 8000
      });
      console.log('   ✅ Groq response received');
      return response.choices[0]?.message?.content || '';
    } catch (e) {
      console.warn(`   ⚠️ Groq failed: ${e.message}, trying Gemini...`);
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
  // STEP 1: Root Cause Analysis
  // ============================================
  console.log('📊 Step 1: AI Root Cause Analysis...');

  // Get repo file list for context
  let repoFiles = [];
  try {
    repoFiles = await getRepoTree(githubToken, repo, branch);
  } catch (e) {
    console.warn('Could not fetch repo tree:', e.message);
  }

  const rcaPrompt = `
You are a Senior Site Reliability Engineer. Analyze this CI failure.

## CRITICAL RULES
1. **Distinguish Messenger vs. Culprit:** If a test file fails on an assertion,
   the bug is likely in the SOURCE CODE file, NOT the test file.
2. **Target File:** \`failed_file\` must be the SOURCE CODE file with the logic error.
3. **Fix Plan:** NEVER suggest changing the test expectation. Fix the logic in source code.

## Repository: ${repo}
## Branch: ${branch}

## Repository Files:
${repoFiles.slice(0, 50).join('\n')}

## Error Logs:
${errorLogs.substring(0, 12000)}

## Return ONLY a valid JSON object (no markdown, no explanation):
{
  "error_type": "string",
  "failed_file": "path/to/source/file",
  "failed_line": 0,
  "root_cause": "Clear description of the root cause",
  "fix_plan": "Specific plan to fix the bug",
  "confidence_score": 0.9
}`;

  let rca;
  try {
    const rcaText = await callAI(rcaPrompt);
    const cleanJson = rcaText.replace(/```json|```/g, '').trim();
    rca = JSON.parse(cleanJson);
    console.log(`✅ RCA Complete. Target: ${rca.failed_file}, Confidence: ${rca.confidence_score}`);
  } catch (e) {
    console.error('❌ RCA failed:', e.message);
    throw new Error(`AI RCA failed: ${e.message}`);
  }

  // Update execution with RCA result
  execution.rcaResult = {
    rootCause: rca.root_cause,
    targetFile: rca.failed_file,
    fixPlan: rca.fix_plan,
    confidenceScore: rca.confidence_score || 0,
    errorType: rca.error_type
  };
  execution.status = 'ai_running';
  await execution.save();

  // ============================================
  // STEP 2: Read target file from GitHub
  // ============================================
  const targetFile = rca.failed_file;
  if (!targetFile) {
    throw new Error('No target file identified by AI');
  }

  console.log(`📄 Step 2: Reading ${targetFile} from GitHub...`);

  let originalCode, fileSha;
  try {
    const fileData = await getFileContent(githubToken, repo, targetFile, branch);
    originalCode = fileData.content;
    fileSha = fileData.sha;
  } catch (e) {
    throw new Error(`Failed to read ${targetFile}: ${e.message}`);
  }

  // ============================================
  // STEP 3: Generate code fix with AI
  // ============================================
  console.log('🔧 Step 3: Generating AI fix...');

  const fixPrompt = `
You are an Autonomous Senior Software Engineer.

## MISSION
Fix a confirmed bug in the following file.

## CONTEXT
- **Repository:** ${repo}
- **File:** ${targetFile}
- **Root Cause:** ${rca.root_cause}
- **Fix Plan:** ${rca.fix_plan}

## RULES
1. Only fix the specific bug. Do NOT refactor unrelated code.
2. Keep ALL imports, class structures, comments, and formatting.
3. Return ONLY the complete, corrected source code.
4. Do NOT wrap in markdown code blocks.
5. Do NOT add explanations — just the raw code.

## ORIGINAL CODE:
${originalCode}`;

  let fixedCode;
  try {
    fixedCode = await callAI(fixPrompt);
    // Clean any accidental markdown wrapping
    fixedCode = fixedCode.replace(/^```[\w]*\n/, '').replace(/\n```$/, '').trim();
  } catch (e) {
    throw new Error(`AI fix generation failed: ${e.message}`);
  }

  if (fixedCode === originalCode) {
    throw new Error('AI generated identical code — no fix applied');
  }

  execution.status = 'ai_complete';
  await execution.save();
  console.log('✅ AI fix generated');

  // ============================================
  // STEP 4: Create branch, commit, and open PR
  // ============================================
  console.log('📤 Step 4: Creating branch and PR...');

  const fixBranch = `fix/autoheal-${Date.now()}`;

  try {
    // Get base SHA
    const baseSha = await getBaseSha(githubToken, repo, branch);

    // Create fix branch
    await createBranch(githubToken, repo, fixBranch, baseSha);
    console.log(`  ✅ Branch created: ${fixBranch}`);

    // Commit the fix
    const commitMsg = `🤖 AutoHeal Fix: ${(rca.root_cause || 'Bug fix').substring(0, 60)}`;
    await updateFile(githubToken, repo, targetFile, fixedCode, commitMsg, fixBranch, fileSha);
    console.log(`  ✅ Fix committed to ${targetFile}`);

    // Create PR
    const prTitle = `🤖 AutoHeal Fix: ${(rca.root_cause || 'Automated fix').substring(0, 60)}`;
    const prBody = `### 🤖 AutoHeal — AI-Generated Fix

**Root Cause:** ${rca.root_cause}
**Target File:** \`${targetFile}\`
**Fix Plan:** ${rca.fix_plan}
**Confidence:** ${Math.round((rca.confidence_score || 0) * 100)}%
**Error Type:** ${rca.error_type || 'Unknown'}

---
_Generated automatically by AutoHeal 2.0_`;

    const prData = await createPR(githubToken, repo, prTitle, prBody, fixBranch, branch);
    console.log(`  ✅ PR created: ${prData.html_url}`);

    // Update execution
    execution.fixBranch = fixBranch;
    execution.prNumber = prData.number;
    execution.prUrl = prData.html_url;
    execution.status = 'pr_created';
    await execution.save();

    return {
      success: true,
      prNumber: prData.number,
      prUrl: prData.html_url,
      fixBranch,
      targetFile,
      rootCause: rca.root_cause
    };
  } catch (e) {
    throw new Error(`PR creation failed: ${e.message}`);
  }
}

module.exports = { runSelfHealingPipeline };
