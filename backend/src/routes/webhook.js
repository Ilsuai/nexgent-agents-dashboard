import { Router } from 'express';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

/**
 * POST /api/webhook/signal
 * Receives trade signals from Nexgent AI and stores them in Firestore.
 * Trade execution happens on the Nexgent AI side — this endpoint just logs signals.
 */
router.post('/signal', async (req, res) => {
  const receivedAt = Date.now();

  try {
    const db = getDb();
    const userId = getUserId();
    const signal = req.body;

    if (!signal || typeof signal !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid signal payload' });
    }

    // Check bot/webhook enabled status
    const settingsDoc = await db
      .collection('users').doc(userId)
      .collection('settings').doc('bot').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    if (settings.enabled === false || settings.webhookEnabled === false) {
      return res.status(200).json({
        success: false,
        status: 'rejected',
        reason: settings.enabled === false ? 'bot_disabled' : 'webhook_disabled',
      });
    }

    // Store signal in Firestore
    const signalId = signal.id ? String(signal.id) : `sig_${receivedAt}`;
    const signalRef = db.collection('users').doc(userId).collection('signals').doc(signalId);

    await signalRef.set({
      ...signal,
      signalReceivedAt: receivedAt,
      status: 'received',
      processedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`📡 Signal received: ${signal.tokenSymbol || signal.token || signalId}`);

    res.json({
      success: true,
      signalId,
      status: 'received',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/webhook/test - Health check for webhook
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Nexgent Agents Dashboard webhook is active',
    timestamp: new Date().toISOString(),
  });
});

export default router;
