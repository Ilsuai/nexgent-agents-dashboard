import React, { useState, useMemo, useRef } from 'react';
import { useTradingData } from '../context/TradingDataContext';
import { useAgentManagement } from '../context/AgentManagementContext';
import { useSettings } from '../context/SettingsContext';
import { Calendar, TrendingDown, BarChart2, Clock, DollarSign, Target, Filter, Share2, Download, X as XIcon, Users } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calculateAllAnalytics } from '../utils/tradingCalculations';
import ShareCard from '../components/analytics/ShareCard';
import Modal from '../components/common/Modal';
import TradeViewModeSelector from '../components/common/TradeViewModeSelector';
import AgentTabs from '../components/common/AgentTabs';
import AgentComparison from '../components/analytics/AgentComparison';
import html2canvas from 'html2canvas';

const Analytics = () => {
  const { trades, tradeViewMode, getFilteredTrades: getAgentFilteredTrades, getTradesByAgent } = useTradingData();
  const { agents } = useAgentManagement();
  const { startingBalance, settings, updateSettings } = useSettings();
  const shareCardRef = useRef(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [activeAgentTab, setActiveAgentTab] = useState('all');
  const [analyticsView, setAnalyticsView] = useState('performance'); // 'performance' or 'comparison'

  // Filters
  const [dateRange, setDateRange] = useState('30D');
  const [selectedTokens, setSelectedTokens] = useState([]);
  const [tradeType, setTradeType] = useState('ALL'); // ALL, WINS, LOSSES
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: '',
  });

  // Get unique tokens
  const uniqueTokens = useMemo(() => {
    return [...new Set(trades.map(t => t.token))].sort();
  }, [trades]);

  // Filter trades based on selections
  const filteredTrades = useMemo(() => {
    // First, get agent-filtered trades
    let filtered = tradeViewMode === 'per-agent-tabs'
      ? (activeAgentTab === 'all' ? [...trades] : [...getTradesByAgent(activeAgentTab)])
      : [...getAgentFilteredTrades()];

    // Date range filter
    if (dateRange !== 'ALL') {
      const now = Date.now();

      // Custom date range
      if (dateRange === 'CUSTOM') {
        if (customDateRange.start && customDateRange.end) {
          const startTime = new Date(customDateRange.start).getTime();
          const endTime = new Date(customDateRange.end).setHours(23, 59, 59, 999);
          filtered = filtered.filter(t => {
            const tradeTime = new Date(t.timestamp).getTime();
            return tradeTime >= startTime && tradeTime <= endTime;
          });
        }
      } else {
        const ranges = {
          '24H': 24 * 60 * 60 * 1000,
          '7D': 7 * 24 * 60 * 60 * 1000,
          '30D': 30 * 24 * 60 * 60 * 1000,
          '90D': 90 * 24 * 60 * 60 * 1000,
          '1Y': 365 * 24 * 60 * 60 * 1000,
        };
        const cutoff = now - ranges[dateRange];
        filtered = filtered.filter(t => new Date(t.timestamp).getTime() > cutoff);
      }
    }

    // Token filter
    if (selectedTokens.length > 0) {
      filtered = filtered.filter(t => selectedTokens.includes(t.token));
    }

    // Trade type filter
    if (tradeType === 'WINS') {
      filtered = filtered.filter(t => t.pnl > 0);
    } else if (tradeType === 'LOSSES') {
      filtered = filtered.filter(t => t.pnl < 0);
    }

    return filtered;
  }, [trades, dateRange, selectedTokens, tradeType, customDateRange]);

  // Calculate analytics for filtered data
  const analytics = useMemo(() => {
    return calculateAllAnalytics(filteredTrades, startingBalance);
  }, [filteredTrades, startingBalance]);

  // Profit Distribution Data
  const profitDistribution = useMemo(() => {
    const buckets = [
      { range: '< -$100', min: -Infinity, max: -100, count: 0 },
      { range: '-$100 to -$50', min: -100, max: -50, count: 0 },
      { range: '-$50 to -$25', min: -50, max: -25, count: 0 },
      { range: '-$25 to $0', min: -25, max: 0, count: 0 },
      { range: '$0 to $25', min: 0, max: 25, count: 0 },
      { range: '$25 to $50', min: 25, max: 50, count: 0 },
      { range: '$50 to $100', min: 50, max: 100, count: 0 },
      { range: '> $100', min: 100, max: Infinity, count: 0 },
    ];

    filteredTrades.forEach(trade => {
      const pnl = trade.pnl;
      for (const bucket of buckets) {
        if (pnl >= bucket.min && pnl < bucket.max) {
          bucket.count++;
          break;
        }
      }
    });

    return buckets;
  }, [filteredTrades]);

  // Trades by Hour
  const tradesByHour = useMemo(() => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      trades: 0,
      pnl: 0,
      wins: 0,
      losses: 0,
    }));

    filteredTrades.forEach(trade => {
      const hour = trade.hour !== undefined ? trade.hour : new Date(trade.timestamp).getHours();
      hourly[hour].trades++;
      hourly[hour].pnl += trade.pnl;
      if (trade.pnl > 0) hourly[hour].wins++;
      else if (trade.pnl < 0) hourly[hour].losses++;
    });

    return hourly;
  }, [filteredTrades]);

  // Monthly Returns
  const monthlyReturns = useMemo(() => {
    const monthlyData = {};

    filteredTrades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
      }

      monthlyData[monthKey].pnl += trade.pnl;
      monthlyData[monthKey].trades++;
      if (trade.pnl > 0) monthlyData[monthKey].wins++;
      else if (trade.pnl < 0) monthlyData[monthKey].losses++;
    });

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredTrades]);

  // Performance by Token
  const performanceByToken = useMemo(() => {
    const tokenStats = {};

    filteredTrades.forEach(trade => {
      if (!tokenStats[trade.token]) {
        tokenStats[trade.token] = {
          token: trade.token,
          trades: 0,
          pnl: 0,
          wins: 0,
          losses: 0,
        };
      }

      tokenStats[trade.token].trades++;
      tokenStats[trade.token].pnl += trade.pnl;
      if (trade.pnl > 0) tokenStats[trade.token].wins++;
      else if (trade.pnl < 0) tokenStats[trade.token].losses++;
    });

    return Object.values(tokenStats)
      .sort((a, b) => b.pnl - a.pnl)
      .map(stat => ({
        ...stat,
        winRate: stat.trades > 0 ? ((stat.wins / stat.trades) * 100).toFixed(1) : 0,
      }));
  }, [filteredTrades]);

  // Win/Loss Pie Chart Data
  const winLossPieData = [
    { name: 'Wins', value: analytics.wins || 0, color: '#10b981' },
    { name: 'Losses', value: analytics.losses || 0, color: '#ef4444' },
  ];

  const toggleToken = (token) => {
    setSelectedTokens(prev =>
      prev.includes(token)
        ? prev.filter(t => t !== token)
        : [...prev, token]
    );
  };

  // Generate share image
  const generateShareImage = async () => {
    if (!shareCardRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#0a0b0d',
        scale: 2,
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      setGeneratedImage(image);
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download image
  const downloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.download = `trading-bot-${dateRange}-${Date.now()}.png`;
    link.href = generatedImage;
    link.click();
  };

  // Share to Twitter/X
  const shareToTwitter = () => {
    const text = `🤖 My Trading Bot Performance - ${dateRange === '7D' ? 'Last 7 Days' : dateRange === '30D' ? 'Last 30 Days' : dateRange === '90D' ? 'Last 90 Days' : 'All Time'}

💰 P&L: ${analytics.totalPnL >= 0 ? '+' : ''}$${analytics.totalPnL?.toFixed(2)}
🎯 Win Rate: ${analytics.winRate?.toFixed(1)}%
📊 Trades: ${filteredTrades.length}
⚡ Profit Factor: ${analytics.profitFactor?.toFixed(2)}

#TradingBot #CryptoTrading #AlgoTrading`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  // Open share modal
  const handleShare = () => {
    setShowShareModal(true);
    setGeneratedImage(null);
    // Generate image after modal opens
    setTimeout(generateShareImage, 100);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white">Advanced Analytics</h2>
          <p className="text-gray-400 mt-1 text-sm">Deep dive into your trading performance with detailed charts and insights</p>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Share2 size={18} />
          Share Results
        </button>
      </header>

      {/* Trade View Mode Selector */}
      <TradeViewModeSelector />

      {/* Analytics View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAnalyticsView('performance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            analyticsView === 'performance'
              ? 'bg-accent text-white'
              : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
          }`}
        >
          <BarChart2 size={18} />
          Performance Analytics
        </button>
        <button
          onClick={() => setAnalyticsView('comparison')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            analyticsView === 'comparison'
              ? 'bg-accent text-white'
              : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
          }`}
        >
          <Users size={18} />
          Agent Comparison
        </button>
      </div>

      {analyticsView === 'performance' ? (
        <>
          {/* Agent Tabs (for per-agent-tabs mode) */}
          {tradeViewMode === 'per-agent-tabs' && (
            <AgentTabs
              onTabChange={setActiveAgentTab}
              showAllTab={true}
            />
          )}

          {/* Filters */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-accent" />
          <h3 className="text-md font-bold text-white">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Time Period</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              <option value="24H">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="90D">Last 90 Days</option>
              <option value="1Y">Last Year</option>
              <option value="ALL">All Time</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {/* Trade Type */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Trade Type</label>
            <select
              value={tradeType}
              onChange={(e) => setTradeType(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              <option value="ALL">All Trades</option>
              <option value="WINS">Winning Trades Only</option>
              <option value="LOSSES">Losing Trades Only</option>
            </select>
          </div>

          {/* Token Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">
              Tokens ({selectedTokens.length > 0 ? `${selectedTokens.length} selected` : 'All'})
            </label>
            <div className="relative">
              <select
                className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg text-sm"
                onChange={(e) => {
                  if (e.target.value) toggleToken(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Select tokens to filter...</option>
                {uniqueTokens.map(token => (
                  <option key={token} value={token}>
                    {token} {selectedTokens.includes(token) ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedTokens.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTokens.map(token => (
                  <span
                    key={token}
                    onClick={() => toggleToken(token)}
                    className="bg-accent/20 text-accent px-2 py-1 rounded text-xs cursor-pointer hover:bg-accent/30 transition-colors"
                  >
                    {token} ×
                  </span>
                ))}
                <button
                  onClick={() => setSelectedTokens([])}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'CUSTOM' && (
          <div className="mt-4 p-4 bg-dark-900/50 rounded-lg border border-dark-700">
            <label className="text-xs text-gray-400 mb-2 block">Custom Date Range</label>
            <div className="flex gap-3 items-center">
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
                placeholder="Start Date"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
                placeholder="End Date"
              />
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dark-700">
          <div>
            <p className="text-xs text-gray-400 mb-1">Filtered Trades</p>
            <p className="text-2xl font-bold text-white">{filteredTrades.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total P&L</p>
            <p className={`text-2xl font-bold ${analytics.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              ${analytics.totalPnL?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-accent">{analytics.winRate?.toFixed(1) || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Profit Factor</p>
            <p className="text-2xl font-bold text-white">{analytics.profitFactor?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-accent" />
            <h3 className="text-md font-bold text-white">Profit Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={profitDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2128" />
              <XAxis
                dataKey="range"
                stroke="#9ca3af"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0b0d', borderColor: '#3b82f6', borderRadius: '8px' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Win/Loss Ratio Pie */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-accent" />
            <h3 className="text-md font-bold text-white">Win/Loss Ratio</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={winLossPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {winLossPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0b0d', borderColor: '#3b82f6', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trades by Hour */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-accent" />
            <h3 className="text-md font-bold text-white">Performance by Hour</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradesByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2128" />
              <XAxis
                dataKey="hour"
                stroke="#9ca3af"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0b0d', borderColor: '#3b82f6', borderRadius: '8px' }}
              />
              <Bar dataKey="pnl" fill="#3b82f6" name="P&L ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Returns */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-accent" />
            <h3 className="text-md font-bold text-white">Monthly Returns</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyReturns}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2128" />
              <XAxis
                dataKey="month"
                stroke="#9ca3af"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0b0d', borderColor: '#3b82f6', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={2} name="P&L ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance by Token */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-accent" />
          <h3 className="text-md font-bold text-white">Performance by Token</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-400">
            <thead className="bg-dark-900/50 text-xs uppercase tracking-wider text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3 text-left">Token</th>
                <th className="px-4 py-3 text-right">Trades</th>
                <th className="px-4 py-3 text-right">Wins</th>
                <th className="px-4 py-3 text-right">Losses</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">Total P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/30">
              {performanceByToken.map((stat, idx) => (
                <tr key={idx} className="hover:bg-dark-700/20">
                  <td className="px-4 py-3 text-white font-bold">{stat.token}</td>
                  <td className="px-4 py-3 text-right">{stat.trades}</td>
                  <td className="px-4 py-3 text-right text-success">{stat.wins}</td>
                  <td className="px-4 py-3 text-right text-danger">{stat.losses}</td>
                  <td className="px-4 py-3 text-right">{stat.winRate}%</td>
                  <td className={`px-4 py-3 text-right font-bold ${stat.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                    {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={18} className="text-accent" />
          <h3 className="text-md font-bold text-white">Risk Metrics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Sharpe Ratio</p>
            <p className="text-2xl font-bold text-white">{analytics.sharpeRatio?.toFixed(2) || '0.00'}</p>
            <p className="text-xs text-gray-500 mt-1">
              {analytics.sharpeRatio >= 2 ? '🌟 Very Good' : analytics.sharpeRatio >= 1 ? '✓ Good' : '⚠ Needs Work'}
            </p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
            <p className="text-2xl font-bold text-danger">{analytics.maxDrawdownPercent?.toFixed(2) || '0.00'}%</p>
            <p className="text-xs text-gray-500 mt-1">${analytics.maxDrawdown?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Expectancy</p>
            <p className="text-2xl font-bold text-white">${analytics.expectancy?.toFixed(2) || '0.00'}</p>
            <p className="text-xs text-gray-500 mt-1">Per trade</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Avg Trade Duration</p>
            <p className="text-2xl font-bold text-white">{Math.floor((analytics.avgTradeDuration || 0) / 60)} min</p>
            <p className="text-xs text-gray-500 mt-1">~{analytics.avgTradeDuration || 0} seconds</p>
          </div>
        </div>
      </div>
        </>
      ) : (
        /* Agent Comparison View */
        <AgentComparison />
      )}

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="📊 Share Your Results">
        <div className="space-y-4">
          {/* Hidden ShareCard for rendering */}
          <div className="fixed -left-[9999px] -top-[9999px]">
            <div ref={shareCardRef}>
              <ShareCard
                analytics={analytics}
                timeframe={dateRange}
                botName={settings.botName || 'My Trading Bot'}
                signalProvider={settings.signalProvider || 'nexgent.ai'}
                filteredTrades={filteredTrades}
              />
            </div>
          </div>

          {/* Preview */}
          {isGenerating && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          )}

          {generatedImage && (
            <div className="space-y-4">
              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <img src={generatedImage} alt="Share preview" className="w-full rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadImage}
                  className="flex items-center justify-center gap-2 bg-dark-800 hover:bg-dark-700 text-white font-medium px-4 py-3 rounded-lg transition-colors border border-dark-700"
                >
                  <Download size={18} />
                  Download Image
                </button>
                <button
                  onClick={shareToTwitter}
                  className="flex items-center justify-center gap-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium px-4 py-3 rounded-lg transition-colors"
                >
                  <XIcon size={18} />
                  Share on X
                </button>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">💡 Tip</p>
                <p className="text-sm text-gray-300">
                  Download the image and share it on your favorite social media platforms. The post text will be copied when you click "Share on X"!
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Analytics;
