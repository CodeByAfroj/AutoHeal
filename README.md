# 🩹 AutoHeal 2.0 — AI-Powered Self-Healing CI/CD Platform

> Automatically detect, diagnose, and fix CI/CD failures using AI.

A full-stack platform where users connect their GitHub repositories and let AI automatically analyze test failures, generate code fixes, and open Pull Requests — all orchestrated through a beautiful real-time dashboard.

---

## 🏗 Architecture

```
GitHub Push → CI Fails → Webhook → Backend → Kestra Flow
  → AI RCA (Gemini 2.0) → Code Fix → Create PR → User Approves → Merged
```

| Layer | Technology |
|---|---|
| Frontend | React.js + Tailwind CSS v3 |
| Backend | Node.js + Express |
| Database | MongoDB |
| Orchestration | Kestra (Docker) |
| AI Engine | Google Gemini 2.0 Flash |
| Auth | GitHub OAuth 2.0 |
| Dev Tunnel | ngrok |

---

## 📂 Project Structure

```
AutoHeal2.0/
├── backend/           # Node.js + Express API server
│   ├── config/        # DB connection, Passport OAuth
│   ├── models/        # User, Repository, Execution schemas
│   ├── routes/        # Auth, repos, webhook, executions, approval
│   ├── middleware/     # JWT authentication
│   ├── utils/         # GitHub API, Kestra client, encryption
│   └── server.js      # Entry point (port 8000)
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/  # Sidebar, StatusBadge, Timeline, etc.
│       ├── contexts/    # AuthContext (JWT management)
│       └── pages/       # Login, Dashboard, Repos, Pipeline, Settings
├── kestra/            # Orchestration layer
│   ├── flows/         # Self-healing pipeline YAML
│   ├── Dockerfile     # Custom Kestra with AI plugin
│   └── docker-compose.yml  # Kestra + MongoDB services
└── .env.example       # Environment variable template
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **npm**
- **Docker & Docker Compose**
- **ngrok** (`brew install ngrok`)
- **GitHub OAuth App** ([create one](https://github.com/settings/developers))
- **Gemini API Key** ([get one](https://aistudio.google.com/apikey))

### 1. Clone & Configure

```bash
git clone <your-repo-url>
cd AutoHeal2.0
cp .env.example backend/.env
# Edit backend/.env with your actual keys
```

### 2. Start Infrastructure (Kestra + MongoDB)

```bash
cd kestra
docker compose up --build -d
```

This starts:
- **Kestra** on `http://localhost:8080`
- **MongoDB** on `localhost:27017`

### 3. Import Kestra Flow

1. Open `http://localhost:8080`
2. Go to **Flows** → **Import**
3. Import `kestra/flows/self-healing-pipeline.yaml`

### 4. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:8000`

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 6. Expose Backend with ngrok

```bash
ngrok http 8000
```

Copy the ngrok URL and update `NGROK_URL` in `backend/.env`.

---

## 🔐 GitHub OAuth Setup

1. Go to [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: AutoHeal 2.0
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:8000/auth/github/callback`
4. Copy **Client ID** and **Client Secret** to your `.env`

---

## 🧪 How It Works

1. **Login**: Sign in with GitHub OAuth
2. **Enable Repo**: Toggle self-healing on any of your repositories
3. **Push Buggy Code**: Push a commit that breaks CI
4. **Auto-Detection**: GitHub webhook notifies the backend
5. **AI Analysis**: Kestra orchestrates Gemini 2.0 to analyze the failure
6. **Code Fix**: AI generates a minimal code fix
7. **PR Created**: Fix is pushed to a new branch and a PR is opened
8. **Review & Approve**: View the timeline, diff, and approve/reject from the dashboard

---

## 📜 License

MIT
