import React, { useMemo } from 'react';
import { useTradingData } from '../../context/TradingDataContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const AgentStatistics = ({ agent, onClose }) => {
  const { getTradesByAgent } = useTradingData();

  // Get agent's trades
  const agentTrades = useMemo(() => {
    return getTradesByAgent(agent.id);
  }, [agent.id, getTradesByAgent]);

  const closedTrades = useMemo(() => {
    return agentTrades.filter(t => t.status === 'CLOSED');
  }, [agentTrades]);

  // Calculate detailed statistics
  const stats = useMemo(() => {
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        profitFactor: 0,
        avgTradeDuration: 0,
      };
    }

    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    return {
      totalTrades: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / closedTrades.length) * 100,
      totalPnL,
      avgWin,
      avgLoss,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      avgTradeDuration: closedTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / closedTrades.length,
    };
  }, [closedTrades]);

  // Calculate equity curve (simplified)
  const equityCurve = useMemo(() => {
    let equity = 0;
    return closedTrades
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((trade, index) => {
        equity += trade.pnl;
        return {
          trade: index + 1,
          equity: parseFloat(equity.toFixed(2)),
          date: new Date(trade.timestamp).toLocaleDateString(),
        };
      })
      .slice(-30); // Last 30 trades
  }, [closedTrades]);

  // P&L distribution
  const pnlDistribution = useMemo(() => {
    const bins = {};
    closedTrades.forEach(trade => {
      const bin = Math.floor(trade.pnl / 10) * 10;
      bins[bin] = (bins[bin] || 0) + 1;
    });

    return Object.entries(bins)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([bin, count]) => ({
        range: `$${bin}`,
        count,
      }));
  }, [closedTrades]);

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">{agent.name} - Statistics</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {closedTrades.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No trades yet</div>
              <div className="text-sm text-gray-500">
                This agent hasn't generated any trades yet
              </div>
            </div>
          ) : (
            <>
              {/* Overview Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Total Trades</div>
                  <div className="text-2xl font-semibold text-white">{stats.totalTrades}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                  <div className="text-2xl font-semibold text-white">{stats.winRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {stats.wins}W / {stats.losses}L
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Total P&L</div>
                  <div className={`text-2xl font-semibold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${stats.totalPnL.toFixed(2)}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Profit Factor</div>
                  <div className={`text-2xl font-semibold ${stats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.profitFactor.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Detailed Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Avg Win</div>
                  <div className="text-lg font-semibold text-green-400">${stats.avgWin.toFixed(2)}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Avg Loss</div>
                  <div className="text-lg font-semibold text-red-400">${stats.avgLoss.toFixed(2)}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Largest Win</div>
                  <div className="text-lg font-semibold text-green-400">${stats.largestWin.toFixed(2)}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Largest Loss</div>
                  <div className="text-lg font-semibold text-red-400">${stats.largestLoss.toFixed(2)}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Avg Duration</div>
                  <div className="text-lg font-semibold text-white">{formatDuration(stats.avgTradeDuration)}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Avg P&L</div>
                  <div className={`text-lg font-semibold ${(stats.totalPnL / stats.totalTrades) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${(stats.totalPnL / stats.totalTrades).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              {equityCurve.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="text-sm font-medium text-gray-300 mb-4">Equity Curve (Last 30 Trades)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="trade" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="equity"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* P&L Distribution */}
              {pnlDistribution.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="text-sm font-medium text-gray-300 mb-4">P&L Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={pnlDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="range" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent Trades */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Recent Trades</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {closedTrades.slice(0, 10).map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-white">{trade.token}</div>
                        <div className="text-xs text-gray-500">{trade.side}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-400">
                          {new Date(trade.timestamp).toLocaleDateString()}
                        </div>
                        <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${trade.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentStatistics;
