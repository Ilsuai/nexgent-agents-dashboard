import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Clock, Zap, Award, AlertCircle, Activity } from 'lucide-react';
import { useTradingData } from '../context/TradingDataContext';
import { useLivePrices } from '../hooks/useLivePrices';
import TradeDetailsModal from '../components/common/TradeDetailsModal';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Performance = () => {
  const { trades } = useTradingData();
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d, all

  // Get open trades for live price updates
  const openTrades = useMemo(() => {
    return trades.filter(t => t.status === 'OPEN' || t.status === 'open');
  }, [trades]);

  // Get live prices for open trades
  const livePrices = useLivePrices(openTrades);

  // Filter trades by time range (all trades from external signals)
  const filteredTrades = useMemo(() => {
    let agentTrades = trades;

    // Apply time filter
    const now = new Date();
    const cutoffTime = {
      '24h': new Date(now - 24 * 60 * 60 * 1000),
      '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
      'all': new Date(0)
    }[timeRange];

    agentTrades = agentTrades.filter(t => {
      const tradeTime = new Date(t.timestamp || t.entryTime);
      return tradeTime >= cutoffTime;
    });

    // Sort by most recent first
    return agentTrades.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.entryTime);
      const timeB = new Date(b.timestamp || b.entryTime);
      return timeB - timeA;
    });
  }, [trades, timeRange]);

  // Calculate performance metrics
  const metrics = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        avgTradeDuration: 0,
        currentStreak: 0,
        bestStreak: 0,
        worstStreak: 0
      };
    }

    const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED' || t.status === 'closed');
    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWinAmount = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let worstStreak = 0;
    let tempStreak = 0;

    closedTrades.forEach((trade, index) => {
      if (trade.pnl > 0) {
        tempStreak = tempStreak >= 0 ? tempStreak + 1 : 1;
      } else {
        tempStreak = tempStreak <= 0 ? tempStreak - 1 : -1;
      }

      if (index === 0) currentStreak = tempStreak;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
      if (tempStreak < worstStreak) worstStreak = tempStreak;
    });

    // Calculate average trade duration
    const tradesWithDuration = closedTrades.filter(t => t.entryTime && t.exitTime);
    const avgDuration = tradesWithDuration.length > 0
      ? tradesWithDuration.reduce((sum, t) => {
          const duration = new Date(t.exitTime) - new Date(t.entryTime);
          return sum + duration;
        }, 0) / tradesWithDuration.length
      : 0;

    return {
      totalTrades: closedTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      totalPnL,
      avgWin: wins.length > 0 ? totalWinAmount / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLossAmount / losses.length : 0,
      profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0,
      avgTradeDuration: avgDuration,
      currentStreak,
      bestStreak,
      worstStreak
    };
  }, [filteredTrades]);

  // Equity curve data
  const equityCurveData = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Equity',
          data: [],
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }]
      };
    }

    const sortedTrades = [...filteredTrades].reverse(); // oldest first
    const closedTrades = sortedTrades.filter(t => t.status === 'CLOSED' || t.status === 'closed');

    let runningBalance = 0;
    const equityPoints = closedTrades.map(trade => {
      runningBalance += trade.pnl || 0;
      return {
        time: new Date(trade.exitTime || trade.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        equity: runningBalance
      };
    });

    return {
      labels: equityPoints.map(p => p.time),
      datasets: [{
        label: 'Equity',
        data: equityPoints.map(p => p.equity),
        borderColor: metrics.totalPnL >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: metrics.totalPnL >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5
      }]
    };
  }, [filteredTrades, metrics.totalPnL]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: function(context) {
            const value = parseFloat(context.parsed.y) || 0;
            return `Equity: $${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: 8
        }
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: '#9CA3AF',
          callback: function(value) {
            const num = parseFloat(value) || 0;
            return '$' + num.toFixed(0);
          }
        }
      }
    }
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Performance Overview</h1>
          <p className="text-gray-400 mt-1">Real-time trading performance from NexGent AI signals</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-dark-800 rounded-lg p-1 border border-dark-700">
          {['24h', '7d', '30d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total P&L */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Total P&L</p>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              metrics.totalPnL >= 0 ? 'bg-success/20' : 'bg-danger/20'
            }`}>
              {metrics.totalPnL >= 0 ? (
                <TrendingUp className="text-success" size={20} />
              ) : (
                <TrendingDown className="text-danger" size={20} />
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold ${(metrics.totalPnL || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
            {(metrics.totalPnL || 0) >= 0 ? '+' : ''}${(metrics.totalPnL || 0).toFixed(2)}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Win Rate</p>
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Target className="text-blue-400" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{(metrics.winRate || 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-2">
            {metrics.winningTrades}W / {metrics.losingTrades}L
          </p>
        </div>

        {/* Profit Factor */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Profit Factor</p>
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="text-purple-400" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            {(metrics.profitFactor || 0) >= 999 ? '∞' : (metrics.profitFactor || 0).toFixed(2)}
          </p>
        </div>

        {/* Total Trades */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Total Trades</p>
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Activity className="text-yellow-400" size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{metrics.totalTrades}</p>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="text-accent" size={24} />
          Equity Curve
        </h2>
        <div className="h-80">
          {filteredTrades.length > 0 ? (
            <Line data={equityCurveData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">No trade data available for selected time range</p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Average Win/Loss */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="text-accent" size={20} />
            Average Trade
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Win</span>
              <span className="text-success font-semibold">+${(metrics.avgWin || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Loss</span>
              <span className="text-danger font-semibold">-${(metrics.avgLoss || 0).toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-dark-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Risk/Reward</span>
                <span className="text-white font-semibold">
                  {(metrics.avgLoss || 0) > 0 ? ((metrics.avgWin || 0) / (metrics.avgLoss || 1)).toFixed(2) : '∞'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Best/Worst Trade */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Award className="text-accent" size={20} />
            Best & Worst
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Largest Win</span>
              <span className="text-success font-semibold">+${(metrics.largestWin || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Largest Loss</span>
              <span className="text-danger font-semibold">${(metrics.largestLoss || 0).toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-dark-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Best Streak</span>
                <span className="text-success font-semibold">{metrics.bestStreak} wins</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Activity */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="text-accent" size={20} />
            Activity Stats
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Duration</span>
              <span className="text-white font-semibold">{formatDuration(metrics.avgTradeDuration)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Current Streak</span>
              <span className={`font-semibold ${metrics.currentStreak > 0 ? 'text-success' : metrics.currentStreak < 0 ? 'text-danger' : 'text-gray-400'}`}>
                {metrics.currentStreak > 0 ? `${metrics.currentStreak} wins` : metrics.currentStreak < 0 ? `${Math.abs(metrics.currentStreak)} losses` : 'None'}
              </span>
            </div>
            <div className="pt-3 border-t border-dark-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Signal Source</span>
                <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
                  NexGent AI
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Open Trades */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="text-success animate-pulse" size={24} />
          Live Open Trades
        </h2>

        {filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'open').length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-400">No open trades</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-dark-700">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Token</th>
                  <th className="pb-3 font-medium">Side</th>
                  <th className="pb-3 font-medium">Entry Price</th>
                  <th className="pb-3 font-medium">Current Price</th>
                  <th className="pb-3 font-medium">Quantity</th>
                  <th className="pb-3 font-medium">Unrealized P&L</th>
                  <th className="pb-3 font-medium">P&L %</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'open').map((trade) => {
                  // Get live price from multiple sources: hook, API response, or entry price
                  const currentPrice = parseFloat(livePrices[trade.id]) || parseFloat(trade.livePrice) || parseFloat(trade.currentPrice) || parseFloat(trade.entryPrice) || 0;
                  const entryPrice = parseFloat(trade.entryPrice) || parseFloat(trade.executionPrice) || 0;

                  // Try multiple sources for quantity
                  let quantity = parseFloat(trade.quantity) || parseFloat(trade.amount) || parseFloat(trade.tokenAmount) || 0;

                  // If no quantity stored, estimate from position size and entry price
                  if (quantity === 0 && trade.entryPositionSol && entryPrice > 0) {
                    // entryPositionSol is in SOL, entryPrice is in USD
                    // Rough estimate: positionSol * SOL_USD_PRICE / token_USD_price
                    // For now, use the API's pre-calculated values if available
                    quantity = 0; // Will use API pnl instead
                  }

                  // Use API's pre-calculated P&L values when available (more accurate)
                  const apiPnlPercent = parseFloat(trade.pnlPercent);
                  const apiPnlSol = parseFloat(trade.pnlSol);

                  // Calculate unrealized P&L - prefer API values
                  let unrealizedPnLPercent = !isNaN(apiPnlPercent) ? apiPnlPercent : (entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0);
                  let unrealizedPnL = !isNaN(apiPnlSol) ? apiPnlSol : (currentPrice - entryPrice) * quantity;

                  // If unrealizedPnL is 0 but we have entry position and pnlPercent, estimate P&L
                  if (unrealizedPnL === 0 && trade.entryPositionSol && !isNaN(apiPnlPercent)) {
                    // P&L in SOL ≈ entryPositionSol * (pnlPercent / 100)
                    unrealizedPnL = parseFloat(trade.entryPositionSol) * (apiPnlPercent / 100);
                  }

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className="border-b border-dark-700/50 hover:bg-dark-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 text-gray-300 text-sm">
                        {new Date(trade.timestamp || trade.entryTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 text-white font-medium">
                        {trade.token || trade.tokenSymbol}
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          trade.side === 'BUY' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300 text-sm">
                        ${(entryPrice || 0).toFixed(6)}
                      </td>
                      <td className="py-3 text-white font-semibold">
                        <div className="flex items-center gap-2">
                          ${(currentPrice || 0).toFixed(6)}
                          {livePrices[trade.id] && (
                            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-gray-300 text-sm">
                        <div>
                          <p className="font-semibold">{(quantity || 0).toFixed(4)}</p>
                          <p className="text-xs text-gray-500">{trade.token || 'Token'}</p>
                        </div>
                      </td>
                      <td className={`py-3 font-bold ${(unrealizedPnL || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(unrealizedPnL || 0) >= 0 ? '+' : ''}${(unrealizedPnL || 0).toFixed(2)}
                      </td>
                      <td className={`py-3 font-bold ${(unrealizedPnLPercent || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(unrealizedPnLPercent || 0) >= 0 ? '+' : ''}{(unrealizedPnLPercent || 0).toFixed(2)}%
                      </td>
                      <td className="py-3">
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 animate-pulse">
                          LIVE
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Closed Trades - Unified View */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-accent" size={24} />
          Recent Trades
        </h2>

        {filteredTrades.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-400">No trades in selected time range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-dark-700">
                  <th className="pb-3 font-medium">Entry Time</th>
                  <th className="pb-3 font-medium">Token</th>
                  <th className="pb-3 font-medium">Entry</th>
                  <th className="pb-3 font-medium">Exit</th>
                  <th className="pb-3 font-medium">Position (SOL)</th>
                  <th className="pb-3 font-medium">P&L</th>
                  <th className="pb-3 font-medium">P&L %</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.filter(t => t.status === 'CLOSED' || t.status === 'closed').slice(0, 20).map((trade) => {
                  const isProfitable = (trade.pnl || 0) >= 0;
                  const entryPrice = parseFloat(trade.entryPrice) || 0;
                  const exitPrice = parseFloat(trade.exitPrice) || 0;
                  const positionSol = trade.entryPositionSol || trade.positionSize || 0;
                  const pnlPercent = trade.pnlPercent || 0;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className="border-b border-dark-700/50 hover:bg-dark-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 text-gray-300 text-sm">
                        {new Date(trade.entryTime || trade.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 text-white font-medium">
                        {trade.token || trade.tokenSymbol}
                      </td>
                      <td className="py-3 text-gray-300 text-sm">
                        ${entryPrice > 0 ? entryPrice.toFixed(8) : 'N/A'}
                      </td>
                      <td className="py-3 text-gray-300 text-sm">
                        ${exitPrice > 0 ? exitPrice.toFixed(8) : 'N/A'}
                      </td>
                      <td className="py-3 text-gray-300 text-sm font-semibold">
                        {positionSol.toFixed(4)} SOL
                      </td>
                      <td className={`py-3 font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                        {isProfitable ? '+' : ''}${typeof trade.pnl === 'number' ? trade.pnl.toFixed(2) : '0.00'}
                      </td>
                      <td className={`py-3 font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                        {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          trade.type === 'unified'
                            ? 'bg-purple-500/20 text-purple-400'
                            : trade.status === 'CLOSED' || trade.status === 'closed'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {trade.type === 'unified' ? 'COMPLETE' : trade.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade Details Modal */}
      {selectedTrade && (
        <TradeDetailsModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
};

export default Performance;
