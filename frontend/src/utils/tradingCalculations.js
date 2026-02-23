/**
 * Trading Calculations and Analytics
 * Calculates metrics, performance data, and analytics from trades
 */

/**
 * Calculate comprehensive metrics from trades
 */
export function calculateMetrics(trades, startingBalance = 700) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      totalPnL: 0,
      winRate: 0,
      wins: 0,
      losses: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      portfolioBalance: startingBalance,
      totalFees: 0,
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);

  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;

  const portfolioBalance = startingBalance + totalPnL;

  return {
    totalTrades: trades.length,
    totalPnL,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    profitFactor,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    portfolioBalance,
    totalFees,
  };
}

/**
 * Calculate Sharpe Ratio
 * @param {Array} trades - Array of trade objects
 * @param {number} riskFreeRate - Annual risk-free rate (default 4%)
 */
export function calculateSharpeRatio(trades, riskFreeRate = 0.04) {
  if (!trades || trades.length < 2) return 0;

  // Calculate daily returns
  const returns = trades.map(t => t.pnlPercent / 100);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualize (assuming 365 trading days)
  const annualizedReturn = avgReturn * 365;
  const annualizedStdDev = stdDev * Math.sqrt(365);

  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate Sortino Ratio (like Sharpe but only considers downside volatility)
 */
export function calculateSortinoRatio(trades, riskFreeRate = 0.04) {
  if (!trades || trades.length < 2) return 0;

  const returns = trades.map(t => t.pnlPercent / 100);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Only consider negative returns for downside deviation
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return 999; // No downside = very high Sortino

  const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  const annualizedReturn = avgReturn * 365;
  const annualizedDownsideDev = downsideDeviation * Math.sqrt(365);

  return (annualizedReturn - riskFreeRate) / annualizedDownsideDev;
}

/**
 * Calculate Maximum Drawdown
 */
export function calculateMaxDrawdown(trades, startingBalance = 700) {
  if (!trades || trades.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let currentBalance = startingBalance;

  sortedTrades.forEach(trade => {
    currentBalance += trade.pnl;

    if (currentBalance > peak) {
      peak = currentBalance;
    }

    const drawdown = peak - currentBalance;
    const drawdownPercent = (drawdown / peak) * 100;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  });

  return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Calculate Calmar Ratio (Return / Max Drawdown)
 */
export function calculateCalmarRatio(trades, startingBalance = 700) {
  if (!trades || trades.length === 0) return 0;

  const totalReturn = trades.reduce((sum, t) => sum + t.pnl, 0);
  const { maxDrawdown } = calculateMaxDrawdown(trades, startingBalance);

  if (maxDrawdown === 0) return totalReturn > 0 ? 999 : 0;

  // Annualized return
  const annualizedReturn = (totalReturn / startingBalance) * 365 / trades.length;

  return annualizedReturn / (maxDrawdown / startingBalance);
}

/**
 * Generate equity curve data
 */
export function generateEquityCurve(trades, days = 90, startingBalance = 700) {
  if (!trades || trades.length === 0) {
    // Return empty array with just starting balance for today
    return [{
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: startingBalance,
    }];
  }

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Get date range from actual trade data
  const firstDate = new Date(sortedTrades[0].timestamp);
  const lastDate = new Date(sortedTrades[sortedTrades.length - 1].timestamp);

  // Use today as the end date if it's after the last trade
  const today = new Date();
  const endDate = today > lastDate ? today : lastDate;

  // Calculate total days in the range
  const totalDays = Math.ceil((endDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  // Create daily buckets for ALL days in the range
  const dailyData = [];
  let balance = startingBalance;
  let tradeIndex = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(firstDate.getTime() + i * 24 * 60 * 60 * 1000);

    // Use UTC date parts to avoid timezone issues with Australian timestamps
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Accumulate all trades for this day
    let dayPnL = 0;
    while (tradeIndex < sortedTrades.length) {
      const trade = sortedTrades[tradeIndex];
      const tradeDate = new Date(trade.timestamp);
      const tradeYear = tradeDate.getUTCFullYear();
      const tradeMonth = String(tradeDate.getUTCMonth() + 1).padStart(2, '0');
      const tradeDay = String(tradeDate.getUTCDate()).padStart(2, '0');
      const tradeDateStr = `${tradeYear}-${tradeMonth}-${tradeDay}`;

      if (tradeDateStr === dateStr) {
        dayPnL += trade.pnl;
        tradeIndex++;
      } else if (tradeDateStr > dateStr) {
        break; // Move to next day
      } else {
        tradeIndex++; // Skip trades before this date (shouldn't happen with sorted data)
      }
    }

    balance += dayPnL;

    // Format as MM/DD for display
    const displayMonth = date.getUTCMonth() + 1;
    const displayDay = date.getUTCDate();

    dailyData.push({
      date: `${displayMonth}/${displayDay}`,
      balance: Math.round(balance * 100) / 100,
    });
  }

  // Return the most recent 'days' worth of data for display
  return dailyData.slice(-days);
}

/**
 * Generate hourly equity curve (last 24 hours)
 */
export function generateHourlyEquityCurve(trades, startingBalance = 700) {
  if (!trades || trades.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      balance: startingBalance,
    }));
  }

  // Get trades from last 24 hours
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentTrades = trades
    .filter(t => new Date(t.timestamp) >= last24h)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (recentTrades.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      balance: startingBalance + trades.reduce((sum, t) => sum + t.pnl, 0),
    }));
  }

  // Calculate starting balance (all trades before last 24h)
  const previousTrades = trades.filter(t => new Date(t.timestamp) < last24h);
  let balance = startingBalance + previousTrades.reduce((sum, t) => sum + t.pnl, 0);

  const hourlyData = [];
  for (let i = 0; i < 24; i++) {
    const hourStart = new Date(last24h.getTime() + i * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    // Get trades for this hour
    const hourTrades = recentTrades.filter(t => {
      const tradeTime = new Date(t.timestamp);
      return tradeTime >= hourStart && tradeTime < hourEnd;
    });

    const hourPnL = hourTrades.reduce((sum, t) => sum + t.pnl, 0);
    balance += hourPnL;

    hourlyData.push({
      time: `${String(i).padStart(2, '0')}:00`,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return hourlyData;
}

/**
 * Calculate profit distribution for histogram
 */
export function calculateProfitDistribution(trades) {
  if (!trades || trades.length === 0) return [];

  const buckets = [
    { range: '< -$50', min: -Infinity, max: -50, count: 0 },
    { range: '-$50 to -$25', min: -50, max: -25, count: 0 },
    { range: '-$25 to $0', min: -25, max: 0, count: 0 },
    { range: '$0 to $25', min: 0, max: 25, count: 0 },
    { range: '$25 to $50', min: 25, max: 50, count: 0 },
    { range: '> $50', min: 50, max: Infinity, count: 0 },
  ];

  trades.forEach(trade => {
    const pnl = trade.pnl;
    for (const bucket of buckets) {
      if (pnl >= bucket.min && pnl < bucket.max) {
        bucket.count++;
        break;
      }
    }
  });

  return buckets;
}

/**
 * Calculate trades by hour of day
 */
export function calculateTradesByHour(trades) {
  if (!trades || trades.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      trades: 0,
      pnl: 0,
    }));
  }

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    trades: 0,
    pnl: 0,
  }));

  trades.forEach(trade => {
    const hour = trade.hour !== undefined ? trade.hour : new Date(trade.timestamp).getHours();
    hourlyData[hour].trades++;
    hourlyData[hour].pnl += trade.pnl;
  });

  return hourlyData;
}

/**
 * Calculate monthly returns
 */
export function calculateMonthlyReturns(trades) {
  if (!trades || trades.length === 0) return [];

  const monthlyData = {};

  trades.forEach(trade => {
    const date = new Date(trade.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        trades: 0,
        pnl: 0,
        wins: 0,
        losses: 0,
      };
    }

    monthlyData[monthKey].trades++;
    monthlyData[monthKey].pnl += trade.pnl;
    if (trade.pnl > 0) monthlyData[monthKey].wins++;
    else if (trade.pnl < 0) monthlyData[monthKey].losses++;
  });

  return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculate all analytics from trades
 */
export function calculateAllAnalytics(trades, startingBalance = 700) {
  const metrics = calculateMetrics(trades, startingBalance);
  const sharpeRatio = calculateSharpeRatio(trades);
  const sortinoRatio = calculateSortinoRatio(trades);
  const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(trades, startingBalance);
  const calmarRatio = calculateCalmarRatio(trades, startingBalance);

  return {
    ...metrics,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownPercent,
    calmarRatio,
    expectancy: metrics.wins > 0 ? (metrics.avgWin * metrics.wins - metrics.avgLoss * metrics.losses) / metrics.totalTrades : 0,
  };
}
