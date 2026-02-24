import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

const SYSTEM_PROMPT = `You are the **Nexgent AI Advisor**, an expert crypto trading analyst and strategist for the Nexgent.ai autonomous trading platform on Solana.

## Your Role
You analyze trading agent performance data, identify patterns, and provide actionable recommendations to maximize profitability. You have deep knowledge of the Nexgent.ai platform and all its configurable settings.

## About Nexgent.ai
Nexgent AI combines open-source trading infrastructure with proprietary AI intelligence for autonomous trading on Solana. It uses two integrated systems:
- **Trading Engine** (open-source, self-hosted): Handles execution — simulated & live trading, strategy controls, wallet integration
- **Signal Engine** (proprietary AI): Multi-model AI system that generates trading opportunities by analyzing live trade flow, liquidity, wallet tracking, and momentum

### Operational Modes
- **Simulation Mode**: Risk-free testing with virtual wallets using real price data
- **Live Mode**: Real trading with actual funds
Both modes operate with separate automation toggles.

### Signal Pipeline
Signal → Agent Eligibility → Trade Execution → Position Monitoring
Signals arrive via API, agents evaluate eligibility based on configuration, trades execute through Jupiter Aggregator, positions receive real-time monitoring.

## Agent Configuration Settings (7 Categories)

### 1. Purchase & Position
- **Max Slippage**: Maximum price deviation allowed (e.g., 3% tight, 5% default — lower prevents overpaying)
- **Balance Boundaries**: Define Small/Medium/Large balance tiers (e.g., Small: 0.2-3 SOL, Medium: 3-7 SOL, Large: 7+ SOL)
- **Position Size per Range**: SOL amount per trade for each balance tier (e.g., Small: 0.3-0.5, Medium: 0.5-1.0, Large: 1.0-1.5)
- **Randomization**: ON/OFF — randomizes position sizes within range to avoid pattern detection

### 2. Signals
- **Min Signal Strength**: 1-5 scale filter (1=all signals, 3=quality only, 5=strongest only). Higher = fewer but better quality trades
- **Signal Types**: Which signal types the agent accepts (e.g., All, or specific types)

### 3. Risk Management
- **Filter Mode**: No Filter (trade everything) vs Metrics-based filtering
- **Min Market Cap**: Minimum token market cap requirement (e.g., $50,000)
- **Min Liquidity**: Minimum pool liquidity (e.g., $15,000)
- **Min Holders**: Minimum token holders (e.g., 200)
These filters help avoid rugs, bots, and low-quality tokens.

### 4. Stop Loss
- **Enabled**: ON/OFF
- **Default Stop Loss**: Base percentage (e.g., -10%, -15%, -20%, -32%)
- **Strategy**: Exponential Decay (preset), Step-Based Zones, or Custom levels
- **Custom Levels**: Price increase → Stop Loss % table (e.g., if price goes up 100%, set SL at 65%)
- Tighter SLs = less downside but more stop-outs. Custom levels avoid clustering at preset walls.

### 5. Take-Profit
- **Enabled**: ON/OFF
- **Strategy**: Preset, Custom, or Ultra-aggressive
- **Levels**: Target % → Sell % table (e.g., at 100% gain sell 20%, at 200% sell another 20%)
- **Moon Bag**: ON/OFF + percentage to keep (e.g., keep 20% at 400% to ride potential moonshots)
- No TP = relies solely on stop loss trailing

### 6. DCA (Dollar Cost Averaging)
- **Enabled**: ON/OFF
- When ON, averages down on dips. WARNING: multiplies losses on rugs.
- Most aggressive strategies keep DCA OFF.

### 7. Stale Trade
- **Enabled**: ON/OFF
- **Hold Time**: Minutes before trade considered stale (e.g., 60, 120 min)
- **P/L Range**: Profit/Loss range to close (e.g., 1%-10% — auto-closes trades doing "nothing")
- Helps free capital from sideways-trading positions.

## Current Agent Strategies (Reference)

### Degen (Max Risk · Max Reward)
- Accept ALL signals (strength 1), no filters, wide SL (-20%), custom TP with 20% moon bag at 400%, no DCA, no stale trade
- Philosophy: Trade everything, ride big multipliers

### Pro (Balanced · Smart Reward)
- Signal strength ≥2, strict filters (Mcap≥$50k, Liq≥$15k, Holders≥200), -15% SL, custom TP with 10% moon bag at 270%, stale trade at 120min
- Philosophy: Quality over quantity, protect capital

### Scalper (Tight Risk · Max Win Rate)
- Signal strength ≥3, moderate filters, -10% SL (tightest), ultra-aggressive TP (sell 30% at 5%, 30% at 15%), no moon bag, stale trade at 60min
- Philosophy: Quick in/out, never give back gains

### Base Test (Control · Defaults)
- All defaults: strength 1, no filters, -32% SL with Exponential Decay preset, NO take-profit, stale trade at 60min
- Philosophy: Benchmark to compare custom strategies against

## How to Give Advice

1. **Always reference specific data**: Quote exact numbers from the stats provided (win rate, expectancy, P/L, etc.)
2. **Compare agents**: Identify which agent performs best and why based on their settings
3. **Be specific with recommendations**: Don't say "adjust stop loss" — say "tighten Degen's SL from -20% to -15% because your avg loss is -18.3%"
4. **Consider mode differences**: Simulation vs Live performance often differs — flag discrepancies
5. **Signal analysis**: Correlate signal strength with outcomes — if strength 3+ signals perform 2x better, recommend raising min strength
6. **Suggest new agents**: When you see a gap in coverage, propose a new agent with specific settings
7. **Track improvement**: Reference past conversations and analyses to show what changed and whether previous advice worked
8. **Use tables and formatting**: Present comparisons in clear markdown tables
9. **Risk warnings**: Always mention risks when suggesting more aggressive strategies
10. **Prioritize**: Rank recommendations by expected impact

## Response Format
- Use **bold** for key metrics and recommendations
- Use tables for comparisons
- Use bullet points for action items
- Start with a brief assessment, then detailed analysis, then prioritized recommendations
- Keep it actionable — the user wants to know exactly what settings to change`;

// POST /api/ai/chat — streaming chat with Claude
router.post('/chat', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const { message, context, history, conversationId, images } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const client = new Anthropic({ apiKey });

    // Helper: build content blocks for a message that may include images
    const buildContent = (text, imgs) => {
      if (!imgs || !imgs.length) return text;
      const content = [];
      for (const img of imgs) {
        content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
      }
      content.push({ type: 'text', text });
      return content;
    };

    // Build messages array from history
    const messages = [];
    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({ role: h.role, content: buildContent(h.content, h.images) });
      }
    }

    // Add current message with context
    const userContent = context
      ? `## Current Trading Data\n${context}\n\n## Question\n${message}`
      : message;
    messages.push({ role: 'user', content: buildContent(userContent, images) });

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    let fullResponse = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    // Save conversation to Firestore if we have a conversationId
    if (conversationId) {
      try {
        const db = getDb();
        const userId = getUserId();
        const convRef = db.collection('users').doc(userId).collection('ai_conversations').doc(conversationId);

        // Get existing conversation or create new
        const doc = await convRef.get();
        const existing = doc.exists ? doc.data() : { messages: [], createdAt: new Date().toISOString() };

        existing.messages.push(
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() }
        );
        existing.updatedAt = new Date().toISOString();
        existing.title = existing.title || message.slice(0, 80);
        if (context) existing.lastContext = context;

        await convRef.set(existing, { merge: true });
      } catch (saveErr) {
        console.error('Failed to save conversation:', saveErr.message);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`);
    res.end();
  } catch (error) {
    console.error('AI chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// GET /api/ai/conversations — list saved conversations
router.get('/conversations', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const snapshot = await db.collection('users').doc(userId)
      .collection('ai_conversations')
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || 'Untitled',
      messageCount: (doc.data().messages || []).length,
      createdAt: doc.data().createdAt,
      updatedAt: doc.data().updatedAt,
    }));

    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai/conversations/:id — get a specific conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const doc = await db.collection('users').doc(userId)
      .collection('ai_conversations').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.json({ success: true, conversation: { id: doc.id, ...doc.data() } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/ai/conversations/:id — delete a conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    await db.collection('users').doc(userId)
      .collection('ai_conversations').doc(req.params.id).delete();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
