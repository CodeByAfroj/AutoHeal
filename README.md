# 🩹 AutoHeal 2.0 — AI-Powered Self-Healing CI/CD Platform

AutoHeal 2.0 is a full-stack SaaS platform that **automatically detects CI/CD failures**, **diagnoses root causes using AI**, and **generates pull requests with fixes** — all without human intervention.


## 🖼️ Product Showcase

<p align="center">
  <img src="frontend/public/Landing.png" width="100%" alt="AutoHeal Landing">
  <br>
  <b>The Command Center</b>: A high-fidelity, interactive hub for autonomous CI.
</p>

<p align="center">
  <img src="frontend/public/repo.png" width="48%" alt="Repository Management">
  <img src="frontend/public/pipeline.png" width="48%" alt="Pipeline Flow">
  <br>
  <b>Seamless Control</b>: Manage repository connections and monitor live healing pipelines in real-time.
</p>

<p align="center">
  <img src="frontend/public/running_pipeline.png" width="100%" alt="Running Pipeline">
  <br>
  <b>Live RCA</b>: Detailed AI-driven root cause analysis and fix generation in action.
</p>

---

## 🚀 How It Works

```
Push Code → CI Fails → GitHub Webhook → AutoHeal Backend
                                              ↓
                                    Fetch Failure Logs
                                              ↓
                                    AI Root Cause Analysis (Groq/Gemini)
                                              ↓
                                    AI Code Fix Generation
                                              ↓
                                    Create Branch → Commit Fix → Open PR
                                              ↓
                                    User Approves/Rejects from Dashboard
```

## ✨ Features

- **🔐 GitHub OAuth Login** — Secure authentication with encrypted tokens
- **📦 Repository Management** — Enable/disable self-healing per repo
- **🔔 Webhook Integration** — Automatic CI failure detection via GitHub webhooks
- **🧠 Semantic Vector Search (RAG)** — 100% offline, local codebase mapping using Hugging Face's `all-MiniLM-L6-v2` via Xenova (Zero API limits)
- **🤖 AI-Powered RCA** — Root cause analysis using Groq (llama-3.3-70b) with Smart Fallbacks
- **🔧 Autonomous Fix Generation** — Generates and natively patches code inside memory without full-file rewrites
- **📤 Automated PR Creation** — Creates branch, commits fix, opens PR on GitHub
- **👻 Shadow Branching** — Offloads 100% of pipeline validation testing to GitHub Actions
- **♻️ Smart Retry Loops** — Intelligently loops fix-attempts automatically if test validations fail
- **✅ Approve/Reject Flow** — Merge or close AI-generated PRs from the dashboard
- **📊 Real-Time Dashboard** — Live pipeline status, stats, and execution history

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│     Login │ Dashboard │ Repos │ Pipelines │ Settings │
└────────────────────────┬────────────────────────────┘
                         │ JWT Auth
┌────────────────────────┴────────────────────────────┐
│                  Backend (Node.js/Express)            │
│                                                      │
│  Auth Routes ──── Repo Routes ──── Webhook Handler   │
│       │               │                │             │
│       │               │          ┌─────┴──────┐     │
│       │               │          │  AI Fixer   │     │
│       │               │          │ (Groq API)  │     │
│       │               │          └─────┬──────┘     │
│       │               │                │             │
│       │               │          ┌─────┴──────┐     │
│       │               │          │  Git Ops    │     │
│       │               │          │ (GitHub API)│     │
│       │               │          └────────────┘     │
│       ▼               ▼                              │
│            MongoDB Atlas (Encrypted Storage)         │
└──────────────────────────────────────────────────────┘
```

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS, Framer Motion, Lucide React |
| Backend | Node.js, Express, Passport.js, JWT, Mongoose |
| Database | MongoDB Atlas (Standard + `$vectorSearch` indexes) |
| Core AI | Groq (llama-3.3-70b-versatile) |
| Offline Embeddings | Xenova Transformers WebAssembly (`all-MiniLM-L6-v2`), `web-tree-sitter` (AST) |
| Security | AES-256-GCM encryption, HMAC webhook verification |
| Tunnel | ngrok (for local development) |

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- GitHub OAuth App
- Groq API key (free at [console.groq.com](https://console.groq.com))
- ngrok (for webhook delivery in dev)

### 1. Clone & Install

```bash
git clone https://github.com/CodeByAfroj/AutoHeal.git
cd AutoHeal

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
# GitHub OAuth App (https://github.com/settings/developers)
# Callback URL: http://localhost:8000/auth/github/callback
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# MongoDB Atlas (Ensure you have a Search Index setup for Vectors!)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/autoheal

# JWT Secret (any random string)
JWT_SECRET=your_random_jwt_secret_here

# Encryption Key (64 hex chars = 32 bytes for AES-256)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Groq API Key (free at https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_groq_key

# Gemini API Key (No longer strictly required!)
GEMINI_API_KEY=

# ngrok URL (update after starting ngrok)
NGROK_URL=https://your-tunnel.ngrok-free.app

# Webhook Secret
WEBHOOK_SECRET=your_webhook_secret

# Frontend
FRONTEND_URL=http://localhost:5173
PORT=8000
```

### 3. Start Services

```bash
# Terminal 1: ngrok tunnel
ngrok http 8000

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 4. Enable Self-Healing

1. Open `http://localhost:5173` → Sign in with GitHub
2. Go to **Repositories** → Enable a repo
3. Push buggy code → CI fails → AutoHeal creates a fix PR automatically!

## 📁 Project Structure

```
AutoHeal/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── passport.js        # GitHub OAuth strategy
│   ├── middleware/
│   │   └── auth.js            # JWT authentication
│   ├── models/
│   │   ├── Execution.js       # Pipeline execution records
│   │   ├── Repository.js      # Enabled repositories
│   │   └── User.js            # User profiles
│   ├── routes/
│   │   ├── approval.js        # PR approve/reject
│   │   ├── auth.js            # GitHub OAuth flow
│   │   ├── executions.js      # Pipeline history & status
│   │   ├── repos.js           # Repository management
│   │   └── webhook.js         # CI failure webhook handler
│   ├── utils/
│   │   ├── ai-fixer.js        # AI RCA + fix pipeline (Groq/Gemini)
│   │   ├── crypto.js          # AES-256-GCM encryption
│   │   ├── git-ops.js         # GitHub branch/commit/PR operations
│   │   └── github.js          # GitHub API helpers
│   └── server.js              # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # Auth context provider
│   │   └── pages/             # Dashboard, Repos, Pipelines, etc.
│   └── index.html
└── README.md
```

## 🔒 Security

- **Token Encryption**: GitHub access tokens encrypted with AES-256-GCM
- **Webhook Verification**: HMAC-SHA256 signature validation
- **JWT Sessions**: Stateless auth with 7-day expiry
- **No secrets in code**: All credentials via environment variables

## 📄 License

MIT

---

Built with ❤️ by Team CodeFlux
