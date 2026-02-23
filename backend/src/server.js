import 'dotenv/config';
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { initFirebase } from './services/firebase.js';
import agentsRouter from './routes/agents.js';
import signalsRouter from './routes/signals.js';
import tradesRouter from './routes/trades.js';
import botRouter from './routes/bot.js';
import webhookRouter from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Track Firebase init state
let firebaseReady = false;
let firebaseError = null;

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// Health check — always responds so Railway can verify the server is up
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nexgent-agents-dashboard-backend',
    firebase: firebaseReady ? 'connected' : (firebaseError || 'initializing'),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/agents', agentsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/bot', botRouter);
app.use('/api/webhook', webhookRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Start server first so Railway health check passes immediately
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Nexgent Agents Dashboard backend running on port ${PORT}`);

  // Initialize Firebase after server is listening
  try {
    initFirebase();
    firebaseReady = true;
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    firebaseError = err.message;
    console.error('❌ Firebase Admin init failed:', err.message);
    console.error('   Set FIREBASE_SERVICE_ACCOUNT and FIREBASE_USER_ID in Railway Variables');
  }
});
