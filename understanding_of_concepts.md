# AutoHeal 2.0: Understanding Core Concepts

This document summarizes some of the core external integrations and networking architecture decisions keeping the AutoHeal 2.0 platform running.

---

## 1. OAuth vs. Webhooks (Why we use Localhost vs Ngrok)

A common point of confusion is why the GitHub OAuth App configuration uses `http://localhost:8000`, while the webhooks strictly require a public `ngrok` URL. The distinction comes down to **who** is talking to the server.

### Localhost for OAuth (Browser-to-Server)
When a user clicks "Login with GitHub", the authentication flow happens entirely inside **the user's web browser**. 
1. The browser navigates to GitHub's authorization page.
2. The user approves access.
3. GitHub instructs the user's browser to redirect to: `http://localhost:8000/auth/github/callback`.
4. Because the browser is running on the local machine alongside the development Node.js server, it resolves `localhost:8000` perfectly and returns the authorization code to the backend.

### Ngrok for Webhooks (Server-to-Server)
When a CI pipeline crashes on GitHub, the user's web browser is completely out of the picture.
1. An isolated server deep inside GitHub's data center detects the pipeline failure.
2. It attempts to send a `POST` payload containing the error details to the registered webhook URL.
3. If the URL is `http://localhost:8000`, the GitHub server will search its *own internal localhost loopback* and fail. 
4. Webhooks require `ngrok` to provide a secure, public-facing tunnel to expose the local development server to the internet. 

Without `ngrok`, GitHub cannot deliver pipeline failure alerts, leaving the AI completely blind to any bugs.

---

## 2. How Webhooks Are Created for specific Repositories

AutoHeal uses dynamic, programmatic webhook registration. Instead of making the user manually copy and paste URLs into GitHub settings, the backend creates them automatically when a repository is "Enabled".

Here is the exact step-by-step flow:

1. **User Action:** The user clicks "Enable" on a repository in the AutoHeal frontend dashboard.
2. **Hit the API:** The frontend fires a POST request to `/api/repos/:repoId/enable` on the backend.
3. **Decrypt Token:** The backend fetches the user's encrypted GitHub Access Token (originally granted during the OAuth login) from MongoDB and decrypts it.
4. **Determine the Public URL:** The backend looks at the `.env` file for the `NGROK_URL` (e.g., `https://xyz.ngrok-free.app`) and dynamically generates the webhook endpoint: `https://xyz.ngrok-free.app/webhook/github`.
5. **Call GitHub API:** The backend uses the `createWebhook()` function to send a REST API request directly to GitHub (`POST https://api.github.com/repos/{owner}/{repo}/hooks`). 
   - It specifically tells GitHub: *"Only alert me on the `workflow_run` event."*
   - It securely attaches a cryptographic secret (`WEBHOOK_SECRET`) so that when payloads arrive later, the backend can mathematically verify they genuinely came from GitHub and not a malicious actor.
6. **Save to Database:** If GitHub returns a success response, it provides a unique `webhookId`. AutoHeal saves this ID into the `Repository` document in MongoDB. This ensures that if the user clicks "Disable" in the future, the backend knows exactly which webhook ID to ask GitHub to delete.

---

## 3. How AI Finds and Fixes Errors in Large, Complex Projects

When dealing with a massive enterprise repository with hundreds of files and multiple CI pipelines, passing the entire codebase to an AI is impossible due to token limits. AutoHeal solves this using a sniper-like surgical approach called **Root Cause Analysis (RCA)**.

Here is how the AI navigates complex projects to generate fixes seamlessly:

### Step 1: The Breadcrumb Trail (Log Extraction)
When a pipeline fails, we utilize the `extractErrorLogs()` function. Huge CI logs can be thousands of lines of useless installation text (`npm install...`, `docker build...`). AutoHeal scans strictly for keywords like `error`, `Exception`, or `FAIL` and extracts just those lines along with 5 lines of surrounding context. The AI is handed the exact point of explosion.

### Step 2: The Map (Directory Tree)
AutoHeal fetches a live Directory Tree (a list of all paths in the repo) from GitHub and gives this strictly to the AI. The AI cross-references the stack trace from the extracted logs against the Directory Tree to map exactly what files are communicating. 

### Step 3: Multi-File Context Discovery
A critical rule is mathematically enforced into the AI's mind context: **"If a test fails, do NOT fix the test. Fix the source file."** The AI reads the stack trace, traces the execution flow, and selects up to 3 `files_to_read` (for example, the failing test file AND the source logic file). Reading multiple files concurrently gives the AI proper visibility into how the modules interact.

### Step 4: The Micro-Targeted Multi-File Fix
Instead of trying to comprehend the entire project, AutoHeal tells the AI: 
*"Here is the raw code for the exact files relevant to the crash. Here is why it's breaking. Return exactly the modified files as a JSON array."*
This hyper-focus ensures that the fix doesn't hallucinate or break other parts of the macro architecture. By fetching and modifying exactly the needed context via GitHub's API, the Self-Healing process scales to work on indefinitely large codebases while remaining fully aware of test expectations.

---

## 4. Scalability: Multi-Pipeline and Multi-Language Support

AutoHeal 2.0 is built to be a robust, enterprise-ready SaaS application that can handle highly complex project structures. 

### Supporting Repositories with Dozens of Pipelines
AutoHeal thrives in environments with massive CI/CD arrays. It achieves this by relying on GitHub's Event Webhooks (`workflow_run`). 
When a pipeline crashes, GitHub hands AutoHeal three crucial identifiers: the `run_id`, the `name` of the workflow, and the `repoFullName`. The back-end uses the specific `run_id` to download the job logs exclusively for the pipeline that crashed. Even if 49 other pipelines are running concurrently or succeeding, AutoHeal isolates strictly the one that failed, meaning no pipeline cross-contamination can occur.

### Complete Language Agnosticism (Java, Python, NPM, etc.)
AutoHeal is entirely natively language-agnostic. It does not matter what framework or language the codebase uses. Here is why:
1. **No Local Compilation:** The AutoHeal Node.js backend never attempts to parse, build, or run the target's code. 
2. **Standardized Text Communication:** The external CI systems (which natively know how to build Java via Maven or test Javascript via Jest) emit stack traces as standard text. AutoHeal grabs this raw text log and passes it to the AI.
3. **Omnilingual AI Models:** The LLMs powering the Root Cause Analysis (Groq Llama-3 or Google Gemini) have been trained on billions of lines of Python, Java, Go, JS, Rust, and more. 

When the AI receives a Python `pytest` failure log, it recognizes the Python traceback syntax automatically and rewrites the flawed target file in perfect Python. The architectural 4-step surgical workflow remains flawlessly identical across all programming architectures.

---

## 5. AI Safety: Infinite Loop Protection & Token Management

Running an autonomous AI self-healing pipeline carries two inherent risks that AutoHeal 2.0 neutralizes mathematically: **Infinite Ping-Pong Loops** and **API Rate Limiting**.

### Infinite Loop Prevention Circuit Breaker
If the AI-generated code fixes a bug but inadvertently breaks a different test, the CI pipeline will fail again. This triggers the GitHub Webhook, causing the AI to spin up another fix, which could fail again—launching an infinite pipeline execution loop.
To combat this, AutoHeal enforces an absolute **3-Execution Limit per Hour per Repository**. Before any webhook is processed, the backend queries MongoDB for recent executions. If the AI has already run 3 times in the last 60 minutes for that specific repository, it trips the circuit breaker, aborts the pipeline, and returns safely, freezing the loop.

### Token Budgeting (TPM Limits)
AI services (like Groq) enforce strict Tokens Per Minute (TPM) limits. AutoHeal maximizes accuracy while actively avoiding TPM rate limits using an aggressive surgical budgeting strategy:
- **Log Truncation:** Raw error logs are truncated to the most recent 6000 characters before sending.
- **Tree Capping:** Only a slice of the Repo Tree (top 40 files) is utilized for initial mapping.
- **Strict Context Limitation:** The pipeline strictly refuses to context-load more than 3 source code files simultaneously.
- **Dynamic `max_tokens` allocation:** The RCA phase is starved to exactly `1000` output tokens since it only generates a roadmap.
- **Unified Patch Architecture (Output Optimization):** To violently slash output token burn, the AI is explicitly forbidden from returning full-file code. Instead, it outputs localized JSON Search/Replace blocks (e.g., "Find lines 40-42, replace with these 2 lines"). The AutoHeal backend then natively applies these patches in memory before pushing the final artifact to GitHub. This cuts token consumption by over 90% for large files.

---

## 6. Zero-Infrastructure Testing: The "Shadow Branching" Workflow

One of the most revolutionary architectural optimizations in AutoHeal is **Shadow Branching**. Instead of executing computationally heavy CI test suites (like Docker, PyTest, or Node) locally on the AutoHeal Express server, AutoHeal gracefully offloads **100% of the testing compute infrastructure back to GitHub**.

### How Shadow Branching Works
1. **The Silent Push:** After the AI agent generates a code fix, the AutoHeal Node.js backend *does not open a Pull Request yet*. Instead, it seamlessly pushes the fixed code to a hidden, temporary branch on GitHub (e.g., `fix/autoheal-177...`).
2. **The Cloud-Worker Offload:** Because the branch was pushed to GitHub natively, **GitHub Actions** immediately spins up its own massive Ubuntu runners, installs all user dependencies, and runs the heavy testing pipelines against the AI's new code. AutoHeal's server enters a dormant waiting phase, burning zero CPU/RAM.
3. **The Webhook Listener:** Once Microsoft's GitHub infrastructure finishes running the tests, it fires a standard `workflow_run` webhook payload back to AutoHeal's API router.
4. **The Validation Gate:**
    - **If Tests Passed (✅):** AutoHeal intercepts the "success" payload and officially triggers the GitHub API to open a professional, finalized Pull Request for the Developer to merge.
    - **If Tests Failed (❌):** The AI hallucinated or wrote incorrect logic! AutoHeal intercepts the "failure" payload, **silently deletes the broken Shadow Branch**, and actively triggers a **Smart Retry Loop** to force the AI to try a completely new approach. 

### Why Shadow Branching is a Silver Bullet
- **Zero Server Overhead:** Simulating complex containerized CI environments locally on AWS or Heroku is a phenomenally expensive nightmare. Shadow Branching makes the AutoHeal brain completely weightless and incredibly cheap to host.
- **Trash Collection (No PR Pollution):** Developers universally hate waking up to unfinished, broken Pull Requests from amateur AI bots. Because the Shadow Branch is structurally hidden and aggressively destroyed if tests fail, Developers *only* ever see verified, 100% test-passing Pull Requests. AutoHeal hides the sausage-making process.
- **Decoupled Language Support:** AutoHeal doesn't need custom logic to figure out if it should execute `npm test`, `pytest`, or `mvn test`. It relies purely on the user's pre-existing GitHub Actions workflows as the absolute source of truth.

---

## 7. RAG (Retrieval-Augmented Generation) and Vector Search with MongoDB Atlas

To bypass expensive multi-file brute force context mapping (which wastes tokens and risks missing critical dependencies in massive codebases), AutoHeal 2.0 leverages **RAG** using **MongoDB Atlas Vector Search**.

### How Code Retrieval Works in AutoHeal
Instead of just guessing which file caused an error based on a file path string, AutoHeal mathematically graphs the internal codebase and searches it algebraically during a crash.

1. **The Abstract Syntax Tree (AST) Skeletonization & Chunking:**
   When a codebase is synced, AutoHeal does not store plain raw text. Instead, it runs an AST Parser (like `web-tree-sitter`) over the repository. The AST parses the code and strips away arbitrary formatting, breaking the files down strictly into individual logical "Chunks" (e.g., individual Class Methods or Functions).
   
2. **Generating Vector Embeddings:**
   Each Code Chunk is passed to a high-speed embedding model (like `Google text-embedding-004`). The AI mathematically maps the *semantic meaning* and *intent* of the code into an array of floating-point numbers (a Vector).

3. **Storage in MongoDB Atlas:**
   Because AutoHeal utilizes MongoDB Atlas, there is zero need for external vector databases like Pinecone or Qdrant. The Code Chunks and their associated Vector arrays are stored directly in a standard Mongoose Collection (`CodeChunk.js`).

### How to Create a Vector Index in MongoDB Atlas
To make MongoDB capable of understanding semantic queries, you must enable a Vector Index on the cluster from the Atlas web interface:
1. Log into MongoDB Atlas and open your active AutoHeal Cluster.
2. Navigate to **Atlas Search** -> **Create Search Index** -> **JSON Editor**.
3. Target the `autoheal` database and the `codechunks` collection.
4. Input the following index configuration:
```json
{
  "fields": [
    {
      "numDimensions": 768,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```
*(Note: Ensure `numDimensions` matches your exact embedding model's output).*

### The "Crash Retrieval" Pipeline
When the GitHub Webhook detects a CI failure, AutoHeal grabs the `TypeError` logs and converts the error text directly into an embedding vector. 
Using the `$vectorSearch` pipeline stage within Mongoose, MongoDB algebraically scans millions of Code Chunks in milliseconds to find the function whose Vector is most similar (smallest cosine distance) to the Crash Error Vector. 
AutoHeal instantly retrieves the exact broken function with surgical precision and hands it directly to the AI Fixer, eliminating the need to ever send massive, raw repository trees during the RCA phase!

---

## 8. The Automated Ingestion Engine (Stocking the Vector DB)

Vector Search (RAG) is useless if the database is empty. To make the system fully autonomous, AutoHeal utilizes a silent **Background Ingestion Engine** that automatically creates and manages your vector embeddings mathematically.

### How Code Gets Into MongoDB
When a user clicks **"Enable"** on a repository in the AutoHeal Dashboard:
1. **Instant UI Response:** The server instantly replies `200 OK` to the frontend. The UI toggles to green immediately so the user never has to wait.
2. **Background Threading:** The backend silently spawns an independent, non-blocking background worker (`ingestor.js`).
3. **Temporal Cloning:** The worker bypasses strict GitHub API rate limits by accessing the shell natively and running `git clone --depth 1` straight into the server's isolated `/tmp` directory. It securely downloads the entire repository in milliseconds.
4. **Recursive AST Filtering:** It crawls the downloaded repository, completely ignoring heavy infrastructure folders like `node_modules` or `.git`. It targets strictly logic files (`.js`, `.py`, `.java`, etc.).
5. **Slicing and Embedding:** Each file is fed into the `web-tree-sitter` AST parser. It slices the file up into individual Functions and Classes, fires each one to Google Gemini to get its 768-dimension Vector Array, and pushes it natively into MongoDB.
6. **Self-Destruction (Security):** The worker immediately triggers an `rm -rf` command, deleting the `/tmp` clone to aggressively protect server disk memory and comply with code privacy.

The Vector Database is now fully stocked, and the AutoHeal Agent is permanently armed with semantic codebase knowledge for future pipeline explosions!
