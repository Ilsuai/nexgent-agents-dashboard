import { Router } from 'express';
import { getDb, getUserId } from '../services/firebase.js';

const router = Router();

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

// Fetch live prices from DexScreener
async function fetchLivePrices(tokenAddresses) {
  const prices = {};
  const unique = [...new Set(tokenAddresses.filter(Boolean))];

  for (const address of unique.slice(0, 10)) {
    try {
      const response = await fetch(`${DEXSCREENER_API}/tokens/${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs?.length > 0) {
          const best = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          prices[address] = {
            priceUsd: parseFloat(best.priceUsd) || null,
            priceChange24h: best.priceChange?.h24 || null,
            liquidity: best.liquidity?.usd || null,
            volume24h: best.volume?.h24 || null,
            dex: best.dexId,
          };
        }
      }
    } catch { /* skip failed */ }
  }
  return prices;
}

// Combine BUY+SELL into unified trade entries
function unifyTrades(rawTrades) {
  const unified = [];
  const processedSellIds = new Set();
  const sorted = [...rawTrades].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const buys = sorted.filter(t => t.side === 'BUY');
  const sells = sorted.filter(t => t.side === 'SELL');
  const SOL_PRICE = 200;

  for (const buy of buys) {
    let sell = sells.find(s => s.linkedBuyTradeId === buy.id && !processedSellIds.has(s.id));
    if (!sell && buy.status === 'CLOSED') {
      sell = sells.find(s =>
        s.tokenAddress === buy.tokenAddress &&
        !processedSellIds.has(s.id) &&
        (s.timestamp || 0) >= (buy.timestamp || 0)
      );
    }

    const buyPos = buy.positionSize || 0;

    if (sell) {
      processedSellIds.add(sell.id);
      let exitPos, pnlSol, pnlPct;

      if (buy.exitPositionSol && buy.pnlPercent !== undefined) {
        exitPos = buy.exitPositionSol;
        pnlSol = buy.pnlSol || (exitPos - buyPos);
        pnlPct = buy.pnlPercent;
      } else {
        exitPos = sell.positionSize || 0;
        pnlSol = exitPos - buyPos;
        pnlPct = buyPos > 0 ? (pnlSol / buyPos) * 100 : 0;
      }

      unified.push({
        id: buy.id, type: 'unified', status: 'CLOSED', agentId: buy.agentId,
        token: buy.token || buy.tokenSymbol, tokenSymbol: buy.tokenSymbol || buy.token,
        tokenAddress: buy.tokenAddress, source: buy.source,
        entryPrice: buy.entryPrice || buy.executionPrice, entryTime: buy.entryTime || buy.timestamp,
        entryPositionSol: buyPos, entryTxSignature: buy.txSignature, entryDex: buy.dex,
        exitPrice: sell.exitPrice || sell.entryPrice, exitTime: sell.exitTime || sell.timestamp,
        exitPositionSol: exitPos, exitTxSignature: sell.txSignature, exitDex: sell.dex,
        pnl: pnlSol * SOL_PRICE, pnlSol, pnlPercent: pnlPct,
        timestamp: buy.timestamp, holdTime: (sell.timestamp || 0) - (buy.timestamp || 0),
        buyTradeId: buy.id, sellTradeId: sell.id,
      });
    } else if (buy.status === 'OPEN') {
      const entry = buy.entryPrice || buy.executionPrice || 0;
      const current = buy.livePrice || buy.currentPrice || entry;
      const pnlPct = entry > 0 ? ((current - entry) / entry) * 100 : 0;
      const pnlSol = buyPos * (pnlPct / 100);

      unified.push({
        id: buy.id, type: 'open', status: 'OPEN', agentId: buy.agentId,
        token: buy.token || buy.tokenSymbol, tokenSymbol: buy.tokenSymbol || buy.token,
        tokenAddress: buy.tokenAddress, entryPrice: entry, entryPositionSol: buyPos,
        currentPrice: current, pnl: pnlSol * SOL_PRICE, pnlSol, pnlPercent: pnlPct,
        timestamp: buy.timestamp, buyTradeId: buy.id,
      });
    } else if (buy.status === 'CLOSED' && buy.exitPositionSol) {
      const exitPos = buy.exitPositionSol;
      const pnlSol = buy.pnlSol || (exitPos - buyPos);
      const pnlPct = buy.pnlPercent || (buyPos > 0 ? (pnlSol / buyPos) * 100 : 0);

      unified.push({
        id: buy.id, type: 'unified', status: 'CLOSED', agentId: buy.agentId,
        token: buy.token || buy.tokenSymbol, tokenSymbol: buy.tokenSymbol || buy.token,
        tokenAddress: buy.tokenAddress, entryPrice: buy.entryPrice || buy.executionPrice,
        entryPositionSol: buyPos, exitPositionSol: exitPos,
        pnl: pnlSol * SOL_PRICE, pnlSol, pnlPercent: pnlPct,
        timestamp: buy.timestamp, combinedSell: true, buyTradeId: buy.id,
      });
    } else if (buy.status === 'FAILED') {
      unified.push({
        id: buy.id, type: 'failed', status: 'FAILED', agentId: buy.agentId,
        token: buy.token || buy.tokenSymbol, tokenSymbol: buy.tokenSymbol || buy.token,
        tokenAddress: buy.tokenAddress, pnl: 0, pnlPercent: 0,
        errorType: buy.errorType, errorMessage: buy.errorMessage,
        timestamp: buy.timestamp, buyTradeId: buy.id,
      });
    }
  }

  // Add unmatched SELLs
  for (const sell of sells) {
    if (!processedSellIds.has(sell.id)) {
      const failed = sell.status === 'FAILED' || sell.errorType;
      unified.push({
        id: sell.id, type: failed ? 'failed' : 'orphan_sell',
        status: failed ? 'FAILED' : 'CLOSED', agentId: sell.agentId,
        token: sell.token || sell.tokenSymbol, tokenSymbol: sell.tokenSymbol || sell.token,
        tokenAddress: sell.tokenAddress,
        exitPrice: failed ? null : (sell.exitPrice || sell.entryPrice),
        exitPositionSol: failed ? 0 : sell.positionSize,
        pnl: failed ? 0 : sell.pnl, pnlPercent: failed ? 0 : sell.pnlPercent,
        errorType: sell.errorType, errorMessage: sell.errorMessage,
        timestamp: sell.timestamp, sellTradeId: sell.id,
      });
    }
  }

  return unified.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// GET /api/trades/list
router.get('/list', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const limitCount = parseInt(req.query.limit) || 100;
    const returnRaw = req.query.raw === 'true';
    const includeLive = req.query.live !== 'false';
    const includeFailed = req.query.includeFailed === 'true';
    const agentId = req.query.agentId;

    let query = db.collection('users').doc(userId).collection('trades')
      .orderBy('timestamp', 'desc').limit(limitCount);

    const snapshot = await query.get();
    let rawTrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by agent if requested
    if (agentId) {
      rawTrades = rawTrades.filter(t => t.agentId === agentId);
    }

    // Fetch live prices for open positions
    if (includeLive) {
      const openAddresses = rawTrades.filter(t => t.status === 'OPEN').map(t => t.tokenAddress);
      if (openAddresses.length > 0) {
        const livePrices = await fetchLivePrices(openAddresses);
        rawTrades = rawTrades.map(t => {
          if (t.status === 'OPEN' && livePrices[t.tokenAddress]) {
            return { ...t, livePrice: livePrices[t.tokenAddress].priceUsd };
          }
          return t;
        });
      }
    }

    if (returnRaw) {
      return res.json({ success: true, trades: rawTrades, timestamp: new Date().toISOString() });
    }

    let trades = unifyTrades(rawTrades);
    if (!includeFailed) trades = trades.filter(t => t.status !== 'FAILED');

    res.json({ success: true, trades, rawCount: rawTrades.length, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/trades/import - Bulk import trades from CSV
router.post('/import', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const { trades, agentId } = req.body;

    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ success: false, error: 'trades must be a non-empty array' });
    }

    let saved = 0;
    let batch = db.batch();

    for (const trade of trades) {
      const id = trade.id || `trade_${Date.now()}_${saved}`;
      const ref = db.collection('users').doc(userId).collection('trades').doc(id);
      batch.set(ref, {
        ...trade,
        agentId: agentId || trade.agentId || 'imported',
        importedAt: new Date().toISOString(),
      }, { merge: true });
      saved++;

      if (saved % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    await batch.commit();

    res.json({ success: true, saved, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/trades/delete?id=xxx
router.delete('/delete', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();
    const { id } = req.query;

    if (!id) return res.status(400).json({ success: false, error: 'Missing trade id' });

    await db.collection('users').doc(userId).collection('trades').doc(id).delete();
    res.json({ success: true, message: `Trade ${id} deleted` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/trades/clear
router.delete('/clear', async (req, res) => {
  try {
    const db = getDb();
    const userId = getUserId();

    const snapshot = await db.collection('users').doc(userId).collection('trades').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ success: true, deleted: snapshot.docs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
