/**
 * Trade Normalizer v3.0
 * Single source of truth for trade schema
 */

const isLikelySymbol = (value) => {
  if (!value || typeof value !== 'string') return false;
  return value.length < 15 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
};

const safeFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const normalizeTimestamp = (timestamp) => {
  if (!timestamp) return Date.now();
  if (typeof timestamp === 'number') {
    return timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  }
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

const generateTradeId = (trade) => {
  const token = trade.token || trade.symbol || 'X';
  const time = normalizeTimestamp(trade.timestamp || trade.created_at);
  const price = trade.entryPrice || trade.entry_price || 0;
  return `${token}-${time}-${Math.round(price * 1000000)}`;
};

export const normalizeStatus = (status) => {
  if (!status) return 'OPEN';
  const s = String(status).toUpperCase().trim();
  const map = {
    'OPEN': 'OPEN', 'OPENED': 'OPEN', 'ACTIVE': 'OPEN', 'RUNNING': 'OPEN',
    'CLOSED': 'CLOSED', 'CLOSE': 'CLOSED', 'COMPLETED': 'CLOSED', 'DONE': 'CLOSED',
    'PENDING': 'PENDING', 'CANCELLED': 'CANCELLED', 'CANCELED': 'CANCELLED',
    'FAILED': 'FAILED', 'ERROR': 'FAILED',
  };
  return map[s] || 'OPEN';
};

export const normalizeTrade = (trade, agentId = 'unknown') => {
  if (!trade) return null;
  const rawToken = trade.token || trade.tokenSymbol || trade.symbol || 'UNKNOWN';
  const tokenAddress = trade.tokenAddress || trade.token_address || trade.mint || null;

  // Check if this is a unified trade from the API
  const isUnifiedTrade = trade.type === 'unified' || trade.type === 'open' || trade.type === 'orphan_sell';

  // Handle webhook trade format (executionPrice, tokenAmount, livePrice)
  const entryPrice = safeFloat(trade.entryPrice || trade.entry_price || trade.executionPrice || trade.signalPrice);
  const exitPrice = safeFloat(trade.exitPrice || trade.exit_price);
  const currentPrice = safeFloat(trade.currentPrice || trade.current_price || trade.livePrice || entryPrice);

  // Token amount / quantity (webhook uses tokenAmount)
  const amount = safeFloat(trade.amount || trade.quantity || trade.tokenAmount || trade.entryQuantity || trade.size);

  // Position size in SOL - prefer unified trade fields
  const positionSize = safeFloat(trade.entryPositionSol || trade.positionSize || trade.position_size || 0.1);

  // Fee handling - use actual fee values from unified trades, otherwise estimate
  const entryFeeSol = safeFloat(trade.entryFeeSol || trade.feeSol || trade.entryFee || trade.entry_fee);
  const exitFeeSol = safeFloat(trade.exitFeeSol || trade.exitFee || trade.exit_fee);
  const totalFees = safeFloat(trade.totalFees || trade.total_fees) || (entryFeeSol + exitFeeSol);

  // Calculate PnL values
  const pnl = safeFloat(trade.pnl || trade.profit);
  const pnlSol = safeFloat(trade.pnlSol);
  const grossPnl = pnl + totalFees; // Gross is before fees
  const pnlPercent = safeFloat(trade.pnlPercent || trade.pnl_percent || trade.profit_percent);

  // Generate DexScreener URL if we have token address
  const dexScreenerUrl = trade.dexScreenerUrl || trade.dex_screener_url ||
    (tokenAddress ? `https://dexscreener.com/solana/${tokenAddress}` : null);

  // Handle webhook timestamps (signalReceivedAt, tradeExecutedAt)
  const timestamp = normalizeTimestamp(trade.timestamp || trade.created_at || trade.openTime || trade.tradeExecutedAt);
  const entryTime = normalizeTimestamp(trade.entryTime || trade.entry_time || trade.openTime || trade.open_time || trade.tradeExecutedAt || timestamp);
  const exitTime = trade.exitTime || trade.exit_time || trade.closeTime || trade.close_time
    ? normalizeTimestamp(trade.exitTime || trade.exit_time || trade.closeTime || trade.close_time)
    : null;

  // Signal timing info (from webhook or unified trade)
  const signalReceivedAt = trade.signalReceivedAt
    ? normalizeTimestamp(trade.signalReceivedAt)
    : (trade._buyTrade?.signalReceivedAt ? normalizeTimestamp(trade._buyTrade.signalReceivedAt) : null);
  const tradeExecutedAt = trade.tradeExecutedAt ? normalizeTimestamp(trade.tradeExecutedAt) : null;
  const processingTimeMs = safeFloat(trade.processingTimeMs || trade.processing_time_ms);

  return {
    id: trade.id || trade.tradeId || trade.trade_id || generateTradeId(trade),
    agentId: trade.agentId || trade.agent_id || agentId,
    token: isLikelySymbol(rawToken) ? rawToken.toUpperCase() : rawToken,
    tokenSymbol: isLikelySymbol(rawToken) ? rawToken.toUpperCase() : rawToken,
    tokenAddress,
    status: normalizeStatus(trade.status),
    side: (trade.side || trade.type || 'BUY').toUpperCase(),

    // Unified trade type
    type: trade.type || null,

    // Prices
    entryPrice,
    currentPrice: safeFloat(trade.currentPrice || trade.current_price || entryPrice),
    exitPrice,

    // P&L
    pnl,
    pnlSol,
    pnlPercent,
    pnlPct: pnlPercent,
    grossPnl,

    // Quantities
    amount,
    quantity: amount,
    positionSize,

    // Unified trade position sizes (in SOL)
    entryPositionSol: safeFloat(trade.entryPositionSol || trade.positionSize),
    exitPositionSol: safeFloat(trade.exitPositionSol),
    entryQuantity: safeFloat(trade.entryQuantity || trade.quantity),
    exitQuantity: safeFloat(trade.exitQuantity),

    // Time fields
    timestamp,
    entryTime,
    exitTime,
    openTime: entryTime,
    closeTime: exitTime,
    holdTime: trade.holdTime || null,

    // Fee breakdown (in SOL)
    entryFeeSol,
    exitFeeSol,
    entryFee: entryFeeSol,
    exitFee: exitFeeSol,
    totalFees,
    fees: totalFees,

    // Transaction signatures
    entryTxSignature: trade.entryTxSignature || trade.txSignature || trade.tx_signature || null,
    exitTxSignature: trade.exitTxSignature || null,
    txSignature: trade.txSignature || trade.tx_signature || trade.signature || null,

    // DEX info
    entryDex: trade.entryDex || trade.dex || 'Jupiter',
    exitDex: trade.exitDex || trade.dex || null,
    dex: trade.dex || trade.exchange || 'Jupiter',
    dexScreenerUrl,

    // Strategy & Analysis
    strategy: trade.strategy || trade.strategyTag || trade.strategy_tag || 'AUTO',
    strategyUsed: trade.strategyUsed || trade.strategy_used || trade.strategy || 'Momentum Trading',
    signalStrength: parseInt(trade.signalStrength || trade.signal_strength || 0, 10),
    entryReasoning: trade.entryReasoning || trade.entry_reasoning || trade.reasoning || null,
    exitReasoning: trade.exitReasoning || trade.exit_reasoning || null,

    // Risk management
    stopLoss: safeFloat(trade.stopLoss || trade.stop_loss),
    takeProfit: safeFloat(trade.takeProfit || trade.take_profit),
    exitReason: trade.exitReason || trade.exit_reason || null,

    // Analysis scores
    riskScore: safeFloat(trade.riskScore || trade.risk_score),
    qualityScore: safeFloat(trade.qualityScore || trade.quality_score),
    analysis: trade.analysis || null,

    // Mode
    paperTrade: trade.paperTrade ?? trade.paper_trade ?? true,

    // Signal timing (from webhook)
    signalReceivedAt,
    tradeExecutedAt,
    processingTimeMs,
    signalPrice: safeFloat(trade.signalPrice),
    livePrice: safeFloat(trade.livePrice),

    // Slippage
    entrySlippage: trade.entrySlippage || trade.slippageUsed || null,
    exitSlippage: trade.exitSlippage || null,

    // Raw trade references (for unified trades)
    _buyTrade: trade._buyTrade || null,
    _sellTrade: trade._sellTrade || null,
    buyTradeId: trade.buyTradeId || null,
    sellTradeId: trade.sellTradeId || null,

    // Error tracking (for failed trades)
    errorType: trade.errorType || null,
    errorMessage: trade.errorMessage || null,
    tradeFailedAt: trade.tradeFailedAt ? normalizeTimestamp(trade.tradeFailedAt) : null,
  };
};

export const normalizeTrades = (trades, agentId = 'unknown') => {
  if (!Array.isArray(trades)) return [];
  return trades.map(t => normalizeTrade(t, agentId)).filter(Boolean);
};

export const formatTradeDate = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTradeTime = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const formatTradeDateTime = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const getPaperTradeLabel = (paperTrade) => {
  if (paperTrade === true) return 'Paper';
  if (paperTrade === false) return 'Live';
  return 'Unknown';
};

export default { normalizeTrade, normalizeTrades, normalizeStatus, normalizeTimestamp, formatTradeDate, formatTradeTime, formatTradeDateTime, getPaperTradeLabel };
