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

// Initialize Firebase Admin on startup
try {
  initFirebase();
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.error('❌ Firebase Admin init failed:', err.message);
  process.exit(1);
}

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nexgent-agents-dashboard-backend',
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

app.listen(PORT, () => {
  console.log(`🚀 Nexgent Agents Dashboard backend running on port ${PORT}`);
});
