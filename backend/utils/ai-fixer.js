const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getBaseSha, createBranch, getFileContent, updateFile, getRepoTree, deleteBranch } = require('./git-ops');
const FixCache = require('../models/FixCache');

async function callAI(prompt, maxTokens = 4000) {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  let attempts = 0;
  
  while (attempts < 3) {
    attempts++;
    console.log(`   🤖 AI Attempt ${attempts}...`);
    
    // 1. Try Groq (Primary)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const resp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: 'You are a precise SRE engineer.' }, { role: 'user', content: prompt }],
          temperature: 0, max_tokens: maxTokens
        });
        const content = resp.choices[0]?.message?.content;
        if (content) return content;
      } catch (e) {
        console.warn(`   ⚠️ Groq Attempt ${attempts} Failed: ${e.message}`);
      }
    }
    
    // 2. Try Gemini (Fallback)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        // Fallback cascade: try flash, then pro
        const modelName = attempts === 1 ? "gemini-1.5-flash" : "gemini-1.5-pro";
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (text) return text;
      } catch (err) {
        console.warn(`   ❌ Gemini (${attempts}) Failed: ${err.message}`);
      }
    }
    
    if (attempts < 3) await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`AI_UNAVAILABLE (All attempts failed. Check logs above for specific errors)`);
}

function safeParse(str, fallback) {
  try {
    // 1. Surgical Extraction: Find the JSON block between triple backticks
    const jsonMatch = str.match(/```json\s*([\s\S]*?)\s*```/) || str.match(/```\s*([\s\S]*?)\s*```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : str;

    // 2. Fallback: Find first { and last }
    if (!jsonMatch) {
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.substring(start, end + 1);
      }
    }

    // 3. Clean up and sanitize
    jsonStr = jsonStr.trim();
    jsonStr = jsonStr.replace(/"([^"]*)"/g, (match, content) => {
      return '"' + content.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });

    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('   ⚠️  JSON Parse failed, attempting fallback recovery...');
    return fallback;
  }
}

async function runSelfHealingPipeline(execution, githubToken) {
  const repo = execution.repoFullName;
  const baseBranch = execution.branch || 'main';
  const targetRef = execution.commitSha || baseBranch;
  const errorLogs = execution.errorLogs || '';

  try {
    console.log(`[AutoHeal] Analyzing CI failure for ${repo}...`);

    const { findRelevantCodeChunks } = require('./rag');
    // Increase context to 4000 chars to catch database errors that might occur earlier in logs
    const chunks = await findRelevantCodeChunks(errorLogs.slice(-4000), execution.repositoryId, 7);
    console.log(`   [RAG] Found ${chunks.length} relevant code chunks.`);

    let topFiles = [...new Set(chunks.map(c => c.filePath))].slice(0, 3);
    let repoTree = [];

    // Always fetch repo tree to provide full context and prevent hallucinations
    try {
      console.log('   📂 Fetching repository tree for global context...');
      const treeData = await getRepoTree(githubToken, repo, baseBranch);
      repoTree = treeData.tree.filter(item => item.type === 'blob').map(item => item.path);

      // 2. PRECISE SRE PIPELINE: Extract failing file + App anchor
      const logMsg = execution.errorLog?.message || '';
      const failMatch = logMsg.match(/FAIL\s+([a-zA-Z0-9._\-\/]+\.[a-z]+)/);
      const failedFile = failMatch ? failMatch[1].replace(/^server\//, '').replace(/^client\//, '') : null;
      
      const targetFiles = [];
      if (failedFile) {
        const realPath = repoTree.find(rp => rp === failedFile || rp.endsWith('/' + failedFile));
        if (realPath) targetFiles.push(realPath);
      }
      // Add app.js as anchor
      const appJs = repoTree.find(rp => rp.endsWith('app.js'));
      if (appJs && !targetFiles.includes(appJs)) targetFiles.push(appJs);

      // Merge with topFiles from RAG
      topFiles.forEach(tf => { if (!targetFiles.includes(tf)) targetFiles.push(tf); });

      // DATABASE AWARENESS: If logs mention DB terms, prioritize DB config/models
      const dbKeywords = ['mongo', 'db', 'mongoose', 'sql', 'database', 'connection', 'seed'];
      if (dbKeywords.some(k => errorLogs.toLowerCase().includes(k))) {
         const dbFiles = repoTree.filter(p => dbKeywords.some(k => p.toLowerCase().includes(k))).slice(0, 2);
         dbFiles.forEach(df => { if (!targetFiles.includes(df)) targetFiles.push(df); });
      }

      topFiles = targetFiles.slice(0, 6); // Allow one extra file for DB context

      if (topFiles.length === 0) {
        console.log('   ⚠️  RAG returned zero results. Suggesting files from tree...');
        const errorLower = errorLogs.toLowerCase();
        topFiles = repoTree.filter(p => {
          const name = p.toLowerCase();
          return errorLower.includes(name.split('/').pop()) ||
            (name.includes('workflow') && errorLower.includes('workflow')) ||
            (name.endsWith('.sh') && errorLower.includes('script'));
        }).slice(0, 5);
      }
    } catch (treeErr) {
      console.warn('   ⚠️ Failed to fetch repo tree:', treeErr.message);
    }

    const filesData = await Promise.all(topFiles.map(async (path) => {
      try {
        const data = await getFileContent(githubToken, repo, path, targetRef);
        const allLines = data.content.split('\n');
        
        // SMART CONTEXT (50/50 Rule):
        // Top 50 lines (Imports) + 50 lines around the error (Logic)
        const matchLine = chunks.find(c => c.filePath === path)?.line || 1;
        const header = allLines.slice(0, 50).map((l, i) => `${i + 1}: ${l}`);
        
        let body = [];
        if (allLines.length > 50) {
          const start = Math.max(50, matchLine - 25);
          const end = Math.min(allLines.length, matchLine + 25);
          body = allLines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`);
        }

        const finalContent = [
          "--- FILE START (Imports & Config) ---",
          ...header,
          body.length > 0 ? "\n... [middle lines skipped] ...\n" : "",
          body.length > 0 ? "--- ERROR CONTEXT ---" : "",
          ...body
        ].join('\n');

        return { path, content: finalContent, sha: data.sha };
      } catch (e) { return null; }
    })).then(fs => fs.filter(f => f !== null));
    const context = filesData.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');

    const masterPrompt = `
Analyze this CI error and provide a fix.
ERROR LOGS:
${errorLogs.slice(-4000)}

CODE CONTEXT (Existing files in the repo):
${context}

Provide a surgical fix in JSON format. 
RULES:
1. Focus ONLY on fixing logic errors, test failures, or bugs in the source code.
2. CRITICAL: If the error is a 'ReferenceError' in a TEST file, prioritize fixing the TEST file's imports before touching application code.
3. SYNTAX ENFORCEMENT: Match the existing style of the file. If a file uses 'import', use 'import'. If it uses 'require', use 'require'. NEVER mix both in one file.
4. ESM RULE: In files using 'import', all 'import' statements MUST be at the absolute top of the file. NEVER place function calls or logic above an import.
5. CRITICAL: RETURN ONLY THE JSON OBJECT. DO NOT INCLUDE ANY CONVERSATIONAL TEXT, EXAMPLES, OR NOTES.
5. DO NOT modify any files in the .github/ folder.
6. DO NOT introduce new external platforms or services.

${repoTree.length > 0 ? `REPO TREE (First 200 files):\n${repoTree.slice(0, 200).join('\n')}\n` : ''}

Provide a surgical fix in JSON format:
{
  "reasoning": "Explain exactly why this fix solves the error.",
  "root_cause": "Brief description of the bug.",
  "files": [{
    "filePath": "path/to/file",
    "replacements": [{
      "startLine": number,
      "endLine": number,
      "replace": "new code content exactly matching indentation"
    }]
  }]
}`;

    console.log('   Generating fix payload...');
    const result = await callAI(masterPrompt);
    console.log('   [AI Response Received]');
    const data = safeParse(result, { files: [] });

    if (!data.files || data.files.length === 0) {
      console.log('--- RAW AI RESPONSE START ---');
      console.log(result);
      console.log('--- RAW AI RESPONSE END ---');
      throw new Error('Could not generate fix files');
    }

    // Clean up file paths and validate using smart heuristics
    data.files = data.files.map(f => {
      // 1. Partial Match: 'src/app.js' -> 'server/src/app.js'
      const realPath = repoTree.find(rp => rp === f.filePath || rp.endsWith('/' + f.filePath));
      if (realPath) f.filePath = realPath;

      // 2. Cleanup match
      if (!repoTree.includes(f.filePath)) {
        const matches = f.filePath.match(/[a-zA-Z0-9._\-\/]+\.[a-zA-Z0-9]+/g);
        const bestMatch = matches?.find(m => repoTree.find(rp => rp === m || rp.endsWith('/' + m)));
        if (bestMatch) {
          const actual = repoTree.find(rp => rp === bestMatch || rp.endsWith('/' + bestMatch));
          if (actual) f.filePath = actual;
        }
      }
      return f;
    }).filter(f => {
      const exists = repoTree.includes(f.filePath);
      const isGithubWorkflow = f.filePath.startsWith('.github/');
      if (isGithubWorkflow) console.warn(`   🛡️ Blocking AI attempt to modify protected file: ${f.filePath}`);
      return exists && !isGithubWorkflow;
    });

    // 🛡️ DEDUPLICATE FILES BY PATH (Prevents 409 Conflicts if AI lists same file twice)
    const uniqueFiles = [];
    const seenPaths = new Set();
    for (const f of data.files) {
      if (!seenPaths.has(f.filePath)) {
        seenPaths.add(f.filePath);
        uniqueFiles.push(f);
      } else {
        // Merge replacements if path seen twice
        const existing = uniqueFiles.find(uf => uf.filePath === f.filePath);
        existing.replacements.push(...f.replacements);
      }
    }
    data.files = uniqueFiles;

    console.log('--- DEBUG: FULL REPO TREE ---');
    console.log(repoTree);
    console.log('--- DEBUG END ---');

    if (data.files.length === 0) {
      console.log('--- DEBUG: REPO TREE (First 20 files) ---');
      console.log(repoTree.slice(0, 20));
      console.log('--- DEBUG END ---');
      throw new Error('AI suggested files that do not exist in the repository.');
    }

    return await applyAndPushFix(data.files, execution, githubToken, data.root_cause || "Auto-Healing Fix", baseBranch, targetRef);
  } catch (e) {
    execution.status = 'error';
    execution.errorMessage = e.message;
    await execution.save();
    console.error(`[Error] ${e.message}`);
  }
}

async function applyAndPushFix(fixedFiles, execution, githubToken, rootCause, baseBranch, targetRef) {
  const repo = execution.repoFullName;
  const fixBranch = `fix/autoheal-${Date.now()}`;
  const baseSha = await getBaseSha(githubToken, repo, baseBranch);
  await createBranch(githubToken, repo, fixBranch, baseSha);

  let pushedAny = false;
  for (const f of fixedFiles) {
    try {
      const data = await getFileContent(githubToken, repo, f.filePath, targetRef);
      let lines = data.content.split('\n');

      f.replacements.sort((a, b) => b.startLine - a.startLine).forEach(r => {
        const start = r.startLine - 1;
        const end = r.endLine - 1;
        if (start >= 0 && start <= lines.length) {
          lines.splice(start, (end - start) + 1, ...r.replace.split('\n'));
        }
      });

      const newContent = lines.join('\n');
      if (newContent.trim() === data.content.trim()) {
        console.warn(`   ⚠️ AI suggested zero changes for ${f.filePath}.`);
        continue;
      }

      console.log(`   [GitOps] Pushing fix to ${f.filePath}...`);
      await updateFile(githubToken, repo, f.filePath, newContent, `AutoHeal: ${rootCause.substring(0, 50)}`, fixBranch, data.sha);
      pushedAny = true;
    } catch (e) {
      console.warn(`[Warning] Failed to update ${f.filePath}: ${e.message}`);
    }
  }

  if (!pushedAny) {
    await deleteBranch(githubToken, repo, fixBranch);
    throw new Error('AI_ZERO_CHANGES: The AI suggested no meaningful changes. Retrying...');
  }

  execution.fixBranch = fixBranch;
  execution.status = 'ai_complete';
  await execution.save();
  console.log(`[Success] Fix pushed to ${fixBranch}. Awaiting CI validation.`);
  return { success: true };
}

module.exports = { runSelfHealingPipeline };
