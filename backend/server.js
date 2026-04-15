require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const passport = require('./config/passport');

// Route imports
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');
const webhookRoutes = require('./routes/webhook').router; 
const executionRoutes = require('./routes/executions');
const approvalRoutes = require('./routes/approval');
const { runWatchdog } = require('./utils/watchdog');

const app = express();
const PORT = process.env.PORT || 8000;

const Execution = require('./models/Execution');

// ============================================
// Database Connection & Boot Sweep
// ============================================
connectDB().then(async () => {
  try {
    // 🧹 Sweep up any 'Ghost Pipelines' that got stuck when Node restarted mid-execution
    const orphans = await Execution.updateMany(
      { status: { $in: ['ci_failed', 'logs_processed', 'ai_running', 'validating_shadow'] } },
      { $set: { status: 'error', errorMessage: 'Pipeline forcefully terminated (Backend Restarted).' } }
    );
    if (orphans.modifiedCount > 0) {
      console.log(`  🧹 Swept ${orphans.modifiedCount} stuck/orphaned pipelines from the previous session.`);
    }
  } catch (err) {
    console.warn('Failed to run orphan sweep:', err.message);
  }

  // 🐕 Launch the Periodic Watchdog (Every 5 minutes)
  runWatchdog(); // Run once on boot
  setInterval(runWatchdog, 1000 * 60 * 5); 
});

// ============================================
// Middleware
// ============================================

// CORS — allow frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing — JSON for most routes
// Note: webhook route uses raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/webhook/github') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// Session (needed for Passport OAuth flow)
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/autoheal',
    ttl: 24 * 60 * 60
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// Routes
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AutoHeal 2.0 Backend',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.use('/auth', authRoutes);

// API routes (protected)
app.use('/api/repos', repoRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/executions', approvalRoutes);

// Webhook route (public — verified via signature)
app.use('/webhook/github', webhookRoutes);

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🩹 AutoHeal 2.0 Backend               ║
  ║   Running on http://localhost:${PORT}       ║
  ║                                          ║
  ║   Health:  http://localhost:${PORT}/health   ║
  ║   Auth:    http://localhost:${PORT}/auth     ║
  ║   Webhook: http://localhost:${PORT}/webhook  ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
