import React, { useState, useMemo } from 'react';
import StatCard from '../components/dashboard/StatCard';
import PerformanceChart from '../components/dashboard/PerformanceChart';
import TradeViewModeSelector from '../components/common/TradeViewModeSelector';
import AgentTabs from '../components/common/AgentTabs';
import TradeDetailsModal from '../components/common/TradeDetailsModal';
import { useTradingData } from '../context/TradingDataContext';
import { useSettings } from '../context/SettingsContext';
import { useAgentManagement } from '../context/AgentManagementContext';
import { calculateAllAnalytics } from '../utils/tradingCalculations';
import { safeNumber, safeToFixed, safeCurrency } from '../utils/numberUtils';
import { Edit2, Trash2, Save, X, Filter, Download, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Modal from '../components/common/Modal';

const UnifiedDashboard = () => {
  const {
    analytics: allTimeAnalytics,
    performanceData,
    trades,
    tradeViewMode,
    getFilteredTrades,
    getTradesByAgent,
    deleteTrade,
    deleteTrades,
    updateTrade,
  } = useTradingData();
  const { startingBalance, settings } = useSettings();
  const { agents } = useAgentManagement();

  // View state
  const [activeAgentTab, setActiveAgentTab] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    timeframe: 'ALL', // '24H', '7D', '30D', 'ALL', 'CUSTOM'
    status: 'all', // 'all', 'open', 'closed'
    token: 'all',
    pnlType: 'all', // 'all', 'profit', 'loss'
  });
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: '',
  });

  // Trade table state
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState(null);
  const [selectedTrades, setSelectedTrades] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedTradeForDetails, setSelectedTradeForDetails] = useState(null);
  const ITEMS_PER_PAGE = 20;

  // Get agent-filtered trades first
  const baseTrades = useMemo(() => {
    if (tradeViewMode === 'per-agent-tabs') {
      if (activeAgentTab === 'all') return trades;
      return getTradesByAgent(activeAgentTab);
    }
    return getFilteredTrades();
  }, [tradeViewMode, activeAgentTab, trades, getFilteredTrades, getTradesByAgent]);

  // Apply all filters
  const filteredTrades = useMemo(() => {
    let filtered = [...baseTrades];

    // Timeframe filter
    if (filters.timeframe !== 'ALL') {
      const now = Date.now();

      if (filters.timeframe === 'CUSTOM') {
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
        };
        const cutoff = now - ranges[filters.timeframe];
        filtered = filtered.filter(t => new Date(t.timestamp).getTime() > cutoff);
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status.toLowerCase() === filters.status);
    }

    // Token filter
    if (filters.token !== 'all') {
      filtered = filtered.filter(t => t.token === filters.token);
    }

    // P&L type filter
    if (filters.pnlType === 'profit') {
      filtered = filtered.filter(t => t.pnl > 0);
    } else if (filters.pnlType === 'loss') {
      filtered = filtered.filter(t => t.pnl < 0);
    }

    return filtered;
  }, [baseTrades, filters, customDateRange]);

  // Recalculate analytics for filtered data
  const analytics = useMemo(() => {
    if (filters.timeframe === 'ALL' && filters.status === 'all' && filters.token === 'all' && filters.pnlType === 'all') {
      return allTimeAnalytics;
    }
    return calculateAllAnalytics(filteredTrades, startingBalance);
  }, [filteredTrades, filters, allTimeAnalytics, startingBalance]);

  // Current balance and 24h change
  const currentBalance = analytics.portfolioBalance || 10000;
  const yesterdayBalance = performanceData.length > 1
    ? performanceData[performanceData.length - 2].balance
    : currentBalance;
  const change24h = yesterdayBalance > 0
    ? ((currentBalance - yesterdayBalance) / yesterdayBalance * 100).toFixed(2)
    : 0;

  // Pagination
  const totalPages = Math.ceil(filteredTrades.length / ITEMS_PER_PAGE);
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Get unique tokens for filter
  const uniqueTokens = [...new Set(trades.map(t => t.token))].sort();

  // Helper: Get agent name (abbreviated)
  const getAgentName = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return 'Unk';
    const name = agent.name || 'Unknown';
    // Abbreviate long names: "NexGent AI Agent" -> "NexGent"
    if (name.length > 10) {
      return name.split(' ')[0].slice(0, 8);
    }
    return name;
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Agent', 'Token', 'Side', 'Quantity', 'Entry Price', 'Exit Price', 'P&L', 'P&L %', 'Fees', 'Status'];
    const rows = filteredTrades.map(t => [
      t.date,
      t.time,
      getAgentName(t.agentId),
      t.token,
      t.side,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.pnl,
      t.pnlPercent,
      t.fees,
      t.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Trade editing
  const startEdit = (trade) => {
    setEditingTradeId(trade.id);
    setEditForm({ ...trade });
  };

  const cancelEdit = () => {
    setEditingTradeId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    updateTrade(editingTradeId, editForm);
    setEditingTradeId(null);
    setEditForm({});
  };

  // Trade deletion
  const confirmDelete = (trade) => {
    setTradeToDelete(trade);
    setShowDeleteModal(true);
  };

  const handleDelete = () => {
    if (tradeToDelete) {
      deleteTrade(tradeToDelete.id);
      setShowDeleteModal(false);
      setTradeToDelete(null);
    }
  };

  // Multi-select
  const toggleSelectTrade = (tradeId) => {
    const newSelected = new Set(selectedTrades);
    if (newSelected.has(tradeId)) {
      newSelected.delete(tradeId);
    } else {
      newSelected.add(tradeId);
    }
    setSelectedTrades(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTrades.size === paginatedTrades.length) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(paginatedTrades.map(t => t.id)));
    }
  };

  const handleBulkDelete = () => {
    deleteTrades(Array.from(selectedTrades));
    setSelectedTrades(new Set());
    setShowBulkDeleteModal(false);
  };

  const confirmBulkDelete = () => {
    if (selectedTrades.size > 0) {
      setShowBulkDeleteModal(true);
    }
  };

  // Summary stats for filtered trades
  const summaryStats = {
    total: filteredTrades.length,
    totalPnL: filteredTrades.reduce((sum, t) => sum + t.pnl, 0),
    wins: filteredTrades.filter(t => t.pnl > 0).length,
    losses: filteredTrades.filter(t => t.pnl < 0).length,
    avgPnL: filteredTrades.length > 0
      ? filteredTrades.reduce((sum, t) => sum + t.pnl, 0) / filteredTrades.length
      : 0,
  };

  // Get top trades
  const getTopTrades = (n = 10, ascending = false) => {
    return [...filteredTrades]
      .sort((a, b) => ascending ? a.pnl - b.pnl : b.pnl - a.pnl)
      .slice(0, n);
  };

  // Render trade list table (for detail views)
  const renderTradeList = (tradeList, title) => (
    <div className="space-y-4">
      <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
        <p className="text-sm text-gray-400 mb-2">{title}</p>
        <p className="text-xl font-bold text-white">{tradeList.length} trades</p>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-gray-400">
          <thead className="bg-dark-900/50 text-xs uppercase tracking-wider text-gray-500 font-medium sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Token</th>
              {tradeViewMode !== 'active-agent' && <th className="px-4 py-3 text-left">Agent</th>}
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">P&L</th>
              <th className="px-4 py-3 text-right">P&L %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/30">
            {tradeList.map((trade, idx) => (
              <tr key={idx} className="hover:bg-dark-700/20">
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{trade.date}</td>
                <td className="px-4 py-3 text-white font-bold">{trade.token}</td>
                {tradeViewMode !== 'active-agent' && (
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/30">
                      {getAgentName(trade.agentId)}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-right text-gray-400">{trade.quantity.toFixed(4)}</td>
                <td className={`px-4 py-3 text-right font-bold ${trade.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right ${trade.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{parseFloat(trade.pnlPercent).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">{settings.botName || 'Trading Dashboard'}</h2>
          <p className="text-gray-400 mt-1 text-sm">Complete trading analytics and trade management</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 text-gray-300 border border-dark-700 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Filter size={16} />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </header>

      {/* Trade View Mode Selector */}
      <TradeViewModeSelector />

      {/* Agent Tabs (for per-agent-tabs mode) */}
      {tradeViewMode === 'per-agent-tabs' && (
        <AgentTabs onTabChange={setActiveAgentTab} showAllTab={true} />
      )}

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Filter size={16} /> Filters
            </h3>
            <button
              onClick={() => setFilters({ timeframe: 'ALL', status: 'all', token: 'all', pnlType: 'all' })}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Timeframe Filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Timeframe</label>
              <select
                value={filters.timeframe}
                onChange={(e) => setFilters({ ...filters, timeframe: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="24H">Last 24 Hours</option>
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
                <option value="ALL">All Time</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="all">All Trades</option>
                <option value="open">Open Only</option>
                <option value="closed">Closed Only</option>
              </select>
            </div>

            {/* Token Filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Token</label>
              <select
                value={filters.token}
                onChange={(e) => setFilters({ ...filters, token: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="all">All Tokens</option>
                {uniqueTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>

            {/* P&L Filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">P&L Type</label>
              <select
                value={filters.pnlType}
                onChange={(e) => setFilters({ ...filters, pnlType: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="all">All Trades</option>
                <option value="profit">Profitable Only</option>
                <option value="loss">Losses Only</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.timeframe === 'CUSTOM' && (
            <div className="mt-4 p-4 bg-dark-900/50 rounded-lg border border-dark-700">
              <label className="text-xs text-gray-400 mb-2 block">Custom Date Range</label>
              <div className="flex gap-3 items-center">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Filtered Trades</p>
          <p className="text-xl font-bold text-white">{summaryStats.total}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Total P&L</p>
          <p className={`text-xl font-bold ${summaryStats.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            ${summaryStats.totalPnL.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Wins</p>
          <p className="text-xl font-bold text-success">{summaryStats.wins}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Losses</p>
          <p className="text-xl font-bold text-danger">{summaryStats.losses}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Avg P&L</p>
          <p className={`text-xl font-bold ${summaryStats.avgPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            ${summaryStats.avgPnL.toFixed(2)}
          </p>
        </div>
      </div>

      {/* KPI Cards - Row 1: Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Portfolio Balance"
          value={currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          isMoney={true}
          trend={parseFloat(change24h)}
          subtext="vs last 24h"
          tooltip="Current total portfolio value"
        />
        <StatCard
          title="Total P&L"
          value={analytics.totalPnL?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          isMoney={true}
          subtext="All time profit/loss"
          tooltip="Total realized profit and loss"
        />
        <StatCard
          title="Win Rate"
          value={safeToFixed(analytics.winRate, 2)}
          subtext={`${analytics.wins || 0} wins / ${analytics.losses || 0} losses`}
          tooltip="Percentage of winning trades"
          format="percent"
          detailViewContent={renderTradeList([...filteredTrades].filter(t => t.pnl > 0).slice(0, 10), 'Recent Winning Trades')}
        />
        <StatCard
          title="Total Trades"
          value={(analytics.totalTrades || 0).toLocaleString()}
          subtext={`${analytics.wins || 0} profitable`}
          tooltip="Total number of closed trades"
        />
      </div>

      {/* KPI Cards - Row 2: Advanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sharpe Ratio"
          value={safeToFixed(analytics.sharpeRatio, 2)}
          subtext="Risk-adjusted return"
          tooltip="Measures return per unit of risk"
        />
        <StatCard
          title="Max Drawdown"
          value={safeToFixed(analytics.maxDrawdownPercent, 2)}
          trend={safeNumber(-Math.abs(safeNumber(analytics.maxDrawdownPercent)))}
          subtext="Largest peak-to-trough"
          tooltip="Maximum observed loss from peak"
          format="percent"
        />
        <StatCard
          title="Profit Factor"
          value={safeToFixed(analytics.profitFactor, 2)}
          subtext="Gross profit / gross loss"
          tooltip="Ratio of gross profit to gross loss"
        />
        <StatCard
          title="Avg Win / Loss"
          value={`$${safeToFixed(analytics.avgWin, 2)} / $${safeToFixed(Math.abs(safeNumber(analytics.avgLoss)), 2)}`}
          subtext="Per trade average"
          tooltip="Average profit per winning trade vs average loss per losing trade"
        />
      </div>

      {/* Performance Chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Performance Chart</h3>
        <PerformanceChart />
      </div>

      {/* Trade Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-dark-700/50 flex justify-between items-center">
          <div>
            <h3 className="text-md font-bold text-white">Complete Trade History</h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedTrades.size > 0
                ? `${selectedTrades.size} selected`
                : `Showing ${paginatedTrades.length} of ${filteredTrades.length} trades`}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedTrades.size > 0 && (
              <button
                onClick={confirmBulkDelete}
                className="flex items-center gap-2 text-xs bg-danger hover:bg-danger/80 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> Delete ({selectedTrades.size})
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 text-xs bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-dark-900/50 text-xs uppercase tracking-wider text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedTrades.size === paginatedTrades.length && paginatedTrades.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-accent focus:ring-accent focus:ring-offset-dark-900"
                  />
                </th>
                <th className="px-6 py-4">Date/Time</th>
                {tradeViewMode !== 'active-agent' && <th className="px-4 py-4">Agent</th>}
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4 text-right">Position</th>
                <th className="px-6 py-4 text-right">Entry</th>
                <th className="px-6 py-4 text-right">Exit</th>
                <th className="px-6 py-4 text-right">P&L</th>
                <th className="px-6 py-4 text-right">%</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/30">
              {paginatedTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="hover:bg-dark-700/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedTradeForDetails(trade)}
                >
                  {editingTradeId === trade.id ? (
                    // Edit Mode - simplified (unified trades shouldn't be edited)
                    <>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedTrades.has(trade.id)}
                          onChange={() => toggleSelectTrade(trade.id)}
                          className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-accent focus:ring-accent focus:ring-offset-dark-900"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-400">{trade.date}</div>
                        <div className="text-xs text-gray-500">{trade.time}</div>
                      </td>
                      {tradeViewMode !== 'active-agent' && (
                        <td className="px-4 py-4">
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] border border-blue-500/30">
                            {getAgentName(trade.agentId)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="text-white font-bold">{trade.token}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-400">
                        {(trade.entryPositionSol || trade.positionSize || 0).toFixed(3)} SOL
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-400">
                        ${(trade.entryPrice || 0).toFixed(6)}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-400">
                        ${(trade.exitPrice || 0).toFixed(6)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.pnl}
                          onChange={(e) => setEditForm({ ...editForm, pnl: parseFloat(e.target.value) })}
                          className="bg-dark-900 border border-dark-700 text-white px-2 py-1 rounded text-xs w-20 text-right"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-gray-400 text-xs">{(trade.pnlPercent || 0).toFixed(1)}%</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
                          {trade.type === 'unified' ? 'DONE' : trade.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={saveEdit}
                            className="text-success hover:text-success/80 transition-colors p-1"
                            title="Save"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-danger hover:text-danger/80 transition-colors p-1"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTrades.has(trade.id)}
                          onChange={() => toggleSelectTrade(trade.id)}
                          className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-accent focus:ring-accent focus:ring-offset-dark-900"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-300">{trade.date}</div>
                        <div className="text-xs text-gray-500">{trade.time}</div>
                      </td>
                      {tradeViewMode !== 'active-agent' && (
                        <td className="px-4 py-4">
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] border border-blue-500/30 whitespace-nowrap">
                            {getAgentName(trade.agentId)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="font-bold text-white">{trade.token}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300 text-xs">
                        {(trade.entryPositionSol || trade.positionSize || 0).toFixed(3)} SOL
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400 text-xs">
                        ${(trade.entryPrice || 0).toFixed(6)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400 text-xs">
                        ${(trade.exitPrice || 0).toFixed(6)}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold text-sm ${(trade.pnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono text-xs ${(trade.pnlPercent || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(trade.pnlPercent || 0) >= 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          trade.type === 'unified'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : trade.status === 'OPEN'
                            ? 'bg-accent/10 text-accent border border-accent/20'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}>
                          {trade.type === 'unified' ? 'DONE' : trade.status}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedTradeForDetails(trade)}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => confirmDelete(trade)}
                            className="text-danger hover:text-danger/80 transition-colors p-1"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-dark-700/50 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-dark-900 border border-dark-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-800 transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-dark-900 border border-dark-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-800 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Trade"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete this trade? This action cannot be undone.
          </p>
          {tradeToDelete && (
            <div className="bg-dark-900 p-4 rounded border border-dark-700">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Token:</div>
                <div className="text-white font-bold">{tradeToDelete.token}</div>
                <div className="text-gray-400">P&L:</div>
                <div className={tradeToDelete.pnl >= 0 ? 'text-success' : 'text-danger'}>
                  ${tradeToDelete.pnl.toFixed(2)}
                </div>
                <div className="text-gray-400">Date:</div>
                <div className="text-white">{tradeToDelete.date}</div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 bg-dark-900 border border-dark-700 text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors"
            >
              Delete Trade
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        title="Delete Multiple Trades"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete <span className="text-danger font-bold">{selectedTrades.size} trades</span>? This action cannot be undone.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-yellow-500">
              This will permanently remove {selectedTrades.size} {selectedTrades.size === 1 ? 'trade' : 'trades'} from your history.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowBulkDeleteModal(false)}
              className="px-4 py-2 bg-dark-900 border border-dark-700 text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors"
            >
              Delete {selectedTrades.size} Trades
            </button>
          </div>
        </div>
      </Modal>

      {/* Trade Details Modal */}
      {selectedTradeForDetails && (
        <TradeDetailsModal
          trade={selectedTradeForDetails}
          onClose={() => setSelectedTradeForDetails(null)}
        />
      )}
    </div>
  );
};

export default UnifiedDashboard;
