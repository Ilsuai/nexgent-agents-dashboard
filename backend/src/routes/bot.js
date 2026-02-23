import { Router } from 'express';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

// GET /api/bot/status
// POST /api/bot/status
router.route('/status')
  .get(async (req, res) => {
    try {
      const db = getDb();
      const userId = getUserId();
      const ref = db.collection('users').doc(userId).collection('settings').doc('bot');
      const doc = await ref.get();
      const data = doc.exists ? doc.data() : { enabled: true };

      res.json({
        success: true,
        botEnabled: data.enabled !== false,
        webhookEnabled: data.webhookEnabled !== false,
        lastUpdated: data.lastUpdated || null,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  })
  .post(async (req, res) => {
    try {
      const db = getDb();
      const userId = getUserId();
      const { enabled, webhookEnabled } = req.body;
      const ref = db.collection('users').doc(userId).collection('settings').doc('bot');

      const update = { lastUpdated: Date.now(), updatedBy: 'dashboard' };
      if (typeof enabled === 'boolean') update.enabled = enabled;
      if (typeof webhookEnabled === 'boolean') update.webhookEnabled = webhookEnabled;

      await ref.set(update, { merge: true });
      const doc = await ref.get();
      const data = doc.data();

      res.json({
        success: true,
        botEnabled: data.enabled !== false,
        webhookEnabled: data.webhookEnabled !== false,
        lastUpdated: data.lastUpdated,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

export default router;
