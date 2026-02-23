import { Router } from 'express';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

// GET /api/agents/list - Fetch agents from Firestore
// POST /api/agents/list - Save agents to Firestore
router.route('/list')
  .get(async (req, res) => {
    try {
      const db = getDb();
      const userId = getUserId();

      const snapshot = await db
        .collection('users').doc(userId)
        .collection('agents').get();

      const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      res.json({ success: true, agents, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  })
  .post(async (req, res) => {
    try {
      const db = getDb();
      const userId = getUserId();
      const { agents } = req.body;

      if (!Array.isArray(agents)) {
        return res.status(400).json({ success: false, error: 'agents must be an array' });
      }

      const batch = db.batch();

      // Clear existing agents
      const existing = await db.collection('users').doc(userId).collection('agents').get();
      existing.docs.forEach(doc => batch.delete(doc.ref));

      // Add new agents
      for (const agent of agents) {
        const ref = db.collection('users').doc(userId).collection('agents').doc(agent.id);
        batch.set(ref, { ...agent, updatedAt: new Date().toISOString() });
      }

      await batch.commit();

      res.json({ success: true, savedCount: agents.length, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

export default router;
