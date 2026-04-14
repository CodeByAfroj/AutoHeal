const Parser = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

/**
 * Initialize tree-sitter and parse a file into a skeleton (signatures only)
 * and extract chunks for Vector Search embedding.
 */
async function parseAndChunkFile(code, language = 'javascript') {
  try {
    if (typeof Parser.init === 'function') {
      await Parser.init();
    } else {
      console.warn(`[AST] Parser.init not available. Falling back to FullFile chunks.`);
      return { skeleton: code, chunks: [{ name: 'FullFile', content: code }] };
    }
  } catch (e) {
    console.warn(`[AST] Parser integration skipped: ${e.message}`);
    return { skeleton: code, chunks: [{ name: 'FullFile', content: code }] };
  }
  
  const parser = new Parser();
  
  // NOTE: You must download tree-sitter-javascript.wasm to your /utils folder
  // You can grab it via npm: npm install web-tree-sitter
  // and locate the wasm files from the tree-sitter language repos.
  let wasmPath;
  if (language === 'javascript') {
    wasmPath = path.join(__dirname, 'tree-sitter-javascript.wasm');
  } else {
    throw new Error(`AST parser for language ${language} not configured yet.`);
  }

  if (!fs.existsSync(wasmPath)) {
    console.warn(`[AST] Missing ${wasmPath}. Returning full code instead of chunking.`);
    return { skeleton: code, chunks: [{ name: 'FullFile', content: code }] };
  }

  const Lang = await Parser.Language.load(wasmPath);
  parser.setLanguage(Lang);

  const tree = parser.parse(code);
  
  // Query to find functions, arrow functions, and classes
  const queryString = `
    (function_declaration) @func
    (lexical_declaration (variable_declarator (arrow_function))) @arrow
    (class_declaration) @class
    (method_definition) @method
  `;
  
  let query;
  try {
    query = Lang.query(queryString);
  } catch(e) {
    console.error("Syntax logic for AST query failed", e);
    return { skeleton: code, chunks: [] };
  }
  
  const captures = query.captures(tree.rootNode);
  
  let skeleton = "";
  const chunks = [];

  // Used to prevent overlapping captures (e.g., method inside class)
  const processedNodes = new Set();

  captures.forEach(capture => {
    const node = capture.node;
    if (processedNodes.has(node.id)) return;
    processedNodes.add(node.id);

    // Get the name/signature
    const fullText = node.text;
    const bodyStartIdx = fullText.indexOf('{');
    
    let signature = fullText;
    if (bodyStartIdx !== -1) {
       signature = fullText.substring(0, bodyStartIdx).trim() + " { ... }";
    }

    // Determine a name for the chunk
    let name = 'Anonymous';
    if (capture.name === 'func' || capture.name === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) name = nameNode.text;
    } else if (capture.name === 'method') {
       const nameNode = node.childForFieldName('name');
       if (nameNode) name = nameNode.text;
    }

    skeleton += `[${capture.name}] ${signature}\n`;
    chunks.push({
      name: name,
      content: fullText
    });
  });

  return { skeleton, chunks };
}

module.exports = { parseAndChunkFile };
