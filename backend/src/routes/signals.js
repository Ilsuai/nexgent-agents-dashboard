import { Router } from 'express';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

// GET /api/signals/list - Fetch signals from Firestore
router.get('/list', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const limitCount = parseInt(req.query.limit) || 50;
    const agentId = req.query.agentId;

    let query = db
      .collection('users').doc(userId)
      .collection('signals')
      .orderBy('signalReceivedAt', 'desc')
      .limit(limitCount);

    if (agentId) {
      query = query.where('agentId', '==', agentId);
    }

    const snapshot = await query.get();
    const signals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
      total: signals.length,
      executed: signals.filter(s => s.status === 'executed').length,
      rejected: signals.filter(s => s.status === 'rejected').length,
      failed: signals.filter(s => s.status === 'failed').length,
      processing: signals.filter(s => s.status === 'processing').length,
    };

    res.json({ success: true, signals, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/signals/import - Bulk import signals from CSV data
router.post('/import', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const { signals, agentId } = req.body;

    if (!Array.isArray(signals) || signals.length === 0) {
      return res.status(400).json({ success: false, error: 'signals must be a non-empty array' });
    }

    const batch = db.batch();
    let saved = 0;

    for (const signal of signals) {
      const id = signal.id ? String(signal.id) : `sig_${Date.now()}_${saved}`;
      const ref = db.collection('users').doc(userId).collection('signals').doc(id);
      batch.set(ref, {
        ...signal,
        agentId: agentId || signal.agentId || 'imported',
        importedAt: new Date().toISOString(),
      }, { merge: true });
      saved++;

      // Firestore batch limit is 500
      if (saved % 450 === 0) {
        await batch.commit();
      }
    }

    await batch.commit();

    res.json({ success: true, saved, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/signals/clear - Clear all signals
router.delete('/clear', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();

    const snapshot = await db.collection('users').doc(userId).collection('signals').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ success: true, deleted: snapshot.docs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
