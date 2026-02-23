import React, { useState, useMemo } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';
import { useTradingData } from '../../context/TradingDataContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, Activity, Award } from 'lucide-react';
import AgentStatusBadge from '../common/AgentStatusBadge';

const AgentComparison = () => {
  const { agents } = useAgentManagement();
  const { getTradesByAgent } = useTradingData();
  const [selectedAgents, setSelectedAgents] = useState([]);

  // Calculate stats for an agent
  const calculateAgentStats = (agentId) => {
    const trades = getTradesByAgent(agentId);
    const closedTrades = trades.filter(t => t.status === 'closed');

    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        avgHoldTime: 0,
        bestTrade: 0,
        worstTrade: 0,
        equity: []
      };
    }

    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl <= 0);
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    // Calculate equity curve
    let runningBalance = 0;
    const equity = closedTrades
      .sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime))
      .map(trade => {
        runningBalance += trade.pnl || 0;
        return {
          date: new Date(trade.exitTime).toLocaleDateString(),
          balance: runningBalance
        };
      });

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,
      totalPnL,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgHoldTime: closedTrades.reduce((sum, t) => {
        const duration = new Date(t.exitTime) - new Date(t.entryTime);
        return sum + duration;
      }, 0) / closedTrades.length / 3600000, // Convert to hours
      bestTrade: Math.max(...closedTrades.map(t => t.pnl || 0)),
      worstTrade: Math.min(...closedTrades.map(t => t.pnl || 0)),
      equity
    };
  };

  // Toggle agent selection
  const toggleAgent = (agentId) => {
    if (selectedAgents.includes(agentId)) {
      setSelectedAgents(selectedAgents.filter(id => id !== agentId));
    } else if (selectedAgents.length < 4) {
      setSelectedAgents([...selectedAgents, agentId]);
    }
  };

  // Get stats for selected agents
  const agentStats = useMemo(() => {
    return selectedAgents.map(agentId => {
      const agent = agents.find(a => a.id === agentId);
      const stats = calculateAgentStats(agentId);
      return { agent, stats };
    });
  }, [selectedAgents, agents]);

  // Prepare comparison chart data
  const comparisonData = useMemo(() => {
    if (agentStats.length === 0) return [];

    return [
      {
        metric: 'Total Trades',
        ...agentStats.reduce((acc, { agent, stats }) => {
          acc[agent.name] = stats.totalTrades;
          return acc;
        }, {})
      },
      {
        metric: 'Win Rate %',
        ...agentStats.reduce((acc, { agent, stats }) => {
          acc[agent.name] = stats.winRate.toFixed(1);
          return acc;
        }, {})
      },
      {
        metric: 'Total P&L',
        ...agentStats.reduce((acc, { agent, stats }) => {
          acc[agent.name] = stats.totalPnL.toFixed(2);
          return acc;
        }, {})
      },
      {
        metric: 'Profit Factor',
        ...agentStats.reduce((acc, { agent, stats }) => {
          acc[agent.name] = stats.profitFactor === Infinity ? 999 : stats.profitFactor.toFixed(2);
          return acc;
        }, {})
      }
    ];
  }, [agentStats]);

  // Prepare equity curve data
  const equityData = useMemo(() => {
    if (agentStats.length === 0) return [];

    // Get all unique dates across all agents
    const allDates = new Set();
    agentStats.forEach(({ stats }) => {
      stats.equity.forEach(point => allDates.add(point.date));
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) =>
      new Date(a) - new Date(b)
    );

    // Build combined data
    return sortedDates.map(date => {
      const dataPoint = { date };
      agentStats.forEach(({ agent, stats }) => {
        const point = stats.equity.find(p => p.date === date);
        if (point) {
          dataPoint[agent.name] = point.balance;
        } else {
          // Use last known value or 0
          const prevPoints = stats.equity.filter(p => new Date(p.date) < new Date(date));
          dataPoint[agent.name] = prevPoints.length > 0
            ? prevPoints[prevPoints.length - 1].balance
            : 0;
        }
      });
      return dataPoint;
    });
  }, [agentStats]);

  // Color palette for agents
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Agent Selection */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Select Agents to Compare (up to 4)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              disabled={!selectedAgents.includes(agent.id) && selectedAgents.length >= 4}
              className={`p-4 rounded-lg border transition-all ${
                selectedAgents.includes(agent.id)
                  ? 'bg-accent/20 border-accent'
                  : 'bg-dark-900 border-dark-700 hover:border-dark-600'
              } ${!selectedAgents.includes(agent.id) && selectedAgents.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <AgentStatusBadge agent={agent} showLabel={false} size="sm" />
                <span className="text-xs text-gray-500">{agent.type}</span>
              </div>
              <p className="text-sm font-medium text-white truncate">{agent.name}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedAgents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Activity className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">Select agents above to compare their performance</p>
        </div>
      ) : (
        <>
          {/* Metrics Comparison Table */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="text-accent" size={20} />
              Performance Metrics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left text-sm text-gray-400 pb-3 pr-4">Metric</th>
                    {agentStats.map(({ agent }, idx) => (
                      <th key={agent.id} className="text-center text-sm pb-3 px-4" style={{ color: colors[idx] }}>
                        {agent.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Total Trades</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.totalTrades} className="py-3 text-center text-white font-medium">
                        {stats.totalTrades}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Win Rate</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.winRate} className="py-3 text-center text-white font-medium">
                        {stats.winRate.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Total P&L</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.totalPnL} className={`py-3 text-center font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Avg Win</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.avgWin} className="py-3 text-center text-green-400">
                        ${stats.avgWin.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Avg Loss</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.avgLoss} className="py-3 text-center text-red-400">
                        ${stats.avgLoss.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Profit Factor</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.profitFactor} className="py-3 text-center text-white font-medium">
                        {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Best Trade</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.bestTrade} className="py-3 text-center text-green-400">
                        ${stats.bestTrade.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-dark-700/50">
                    <td className="py-3 text-gray-400">Worst Trade</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.worstTrade} className="py-3 text-center text-red-400">
                        ${stats.worstTrade.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 text-gray-400">Avg Hold Time</td>
                    {agentStats.map(({ stats }) => (
                      <td key={stats.avgHoldTime} className="py-3 text-center text-white">
                        {stats.avgHoldTime.toFixed(1)}h
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Equity Curves Comparison */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-accent" size={20} />
              Equity Curves
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {agentStats.map(({ agent }, idx) => (
                  <Line
                    key={agent.id}
                    type="monotone"
                    dataKey={agent.name}
                    stroke={colors[idx]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics Bar Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Award className="text-accent" size={20} />
                Win Rate Comparison
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agentStats.map(({ agent, stats }, idx) => ({
                  name: agent.name,
                  'Win Rate': stats.winRate,
                  color: colors[idx]
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Bar dataKey="Win Rate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="text-accent" size={20} />
                Total P&L Comparison
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agentStats.map(({ agent, stats }, idx) => ({
                  name: agent.name,
                  'P&L': stats.totalPnL,
                  color: colors[idx]
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="P&L">
                    {agentStats.map((entry, index) => (
                      <Bar key={`bar-${index}`} dataKey="P&L" fill={colors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentComparison;
