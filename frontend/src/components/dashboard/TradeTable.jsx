import React, { useState, useMemo } from 'react';
import { ExternalLink, X, Filter, Download, XIcon } from 'lucide-react';
import { useTradingData } from '../../context/TradingDataContext';
import Modal from '../common/Modal';
import { formatTradeDate, formatTradeTime } from '../../utils/normalizeTrade';

// Helper functions to safely handle numeric values
const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

const safeToFixed = (val, decimals = 2, fallback = '0.00') => {
  const num = safeNumber(val, null);
  if (num === null) return fallback;
  return num.toFixed(decimals);
};

const TradeTable = ({ trades: propTrades, limit = 10 }) => {
  const { trades: contextTrades } = useTradingData();
  const trades = propTrades || contextTrades;

  // State for filters and modal
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    token: 'all',
    pnlType: 'all',
  });
  const [selectedTrade, setSelectedTrade] = useState(null);

  // Get unique tokens for filter
  const uniqueTokens = useMemo(() => {
    return [...new Set(trades.map(t => t.token))].sort();
  }, [trades]);

  // Apply filters
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];

    // Status filter (using UPPERCASE status values)
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
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
  }, [trades, filters]);

  // Show only recent trades (limit)
  const recentTrades = filteredTrades.slice(0, limit);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Token', 'Side', 'Quantity', 'Entry Price', 'Exit Price', 'P&L', 'P&L %', 'Fees', 'Status'];
    const rows = recentTrades.map(t => [
      t.date,
      t.time,
      t.token,
      t.side,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.pnl,
      t.pnlPercent,
      t.fees || 0,
      t.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recent_trades_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-dark-700/50 flex justify-between items-center bg-dark-800/30">
        <div>
           <h3 className="text-md font-bold text-white flex items-center gap-2">
             Recent Trades
             <span className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
             </span>
           </h3>
           <p className="text-xs text-gray-500 mt-1">
             {filters.status !== 'all' || filters.token !== 'all' || filters.pnlType !== 'all'
               ? `Showing ${recentTrades.length} of ${filteredTrades.length} filtered trades`
               : `Latest ${recentTrades.length} trading bot activity`}
           </p>
        </div>
        <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-xs border px-3 py-1.5 rounded transition-colors ${
                showFilters ? 'bg-accent border-accent text-white' : 'bg-dark-900 border-dark-700 text-gray-400 hover:text-white'
              }`}
            >
                <Filter size={12} /> Filters
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 text-xs bg-dark-900 border border-dark-700 px-3 py-1.5 rounded text-gray-400 hover:text-white transition-colors"
            >
                <Download size={12} /> CSV
            </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-dark-900/50 border-b border-dark-700/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-1.5 rounded text-sm"
              >
                <option value="all">All</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Token</label>
              <select
                value={filters.token}
                onChange={(e) => setFilters({ ...filters, token: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-1.5 rounded text-sm"
              >
                <option value="all">All Tokens</option>
                {uniqueTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">P&L Type</label>
              <select
                value={filters.pnlType}
                onChange={(e) => setFilters({ ...filters, pnlType: e.target.value })}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-1.5 rounded text-sm"
              >
                <option value="all">All</option>
                <option value="profit">Profit Only</option>
                <option value="loss">Loss Only</option>
              </select>
            </div>
          </div>

          {(filters.status !== 'all' || filters.token !== 'all' || filters.pnlType !== 'all') && (
            <button
              onClick={() => setFilters({ status: 'all', token: 'all', pnlType: 'all' })}
              className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-dark-900/50 text-xs uppercase tracking-wider text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4">Date/Time</th>
              <th className="px-6 py-4">Token</th>
              <th className="px-6 py-4 text-right">Quantity</th>
              <th className="px-6 py-4 text-right">Entry Price</th>
              <th className="px-6 py-4 text-right">PnL (USD)</th>
              <th className="px-6 py-4 text-right">Change</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/30">
            {recentTrades.map((trade, idx) => (
              <tr
                key={trade.id || idx}
                onClick={() => setSelectedTrade(trade)}
                className="hover:bg-dark-700/20 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-white text-sm">{formatTradeDate(trade.timestamp)}</span>
                    <span className="text-gray-400 text-xs">{formatTradeTime(trade.timestamp)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white group-hover:text-accent transition-colors">{trade.token}</span>
                    <ExternalLink size={10} className="text-gray-600 hover:text-accent cursor-pointer" />
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-mono text-gray-300">
                  {safeToFixed(trade.quantity, 4)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-gray-400">
                  ${safeToFixed(trade.entryPrice, 4)}
                </td>
                <td className={`px-6 py-4 text-right font-mono font-bold ${safeNumber(trade.pnl) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {safeNumber(trade.pnl) >= 0 ? '+' : ''}${safeToFixed(Math.abs(safeNumber(trade.pnl)), 2)}
                </td>
                <td className={`px-6 py-4 text-right font-mono text-xs ${safeNumber(trade.pnlPercent) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {safeNumber(trade.pnlPercent) >= 0 ? '+' : ''}{safeToFixed(trade.pnlPercent, 2)}%
                </td>
                <td className="px-6 py-4 text-center">
                    {trade.status === 'OPEN' ? (
                         <button className="bg-dark-900 border border-dark-700 hover:border-danger/50 hover:text-danger text-[10px] px-2 py-1 rounded transition-colors flex items-center mx-auto uppercase">
                            <X size={10} className="mr-1"/> Close
                         </button>
                    ) : (
                        <span className="text-[10px] text-gray-600 uppercase border border-gray-800 px-2 py-1 rounded">Closed</span>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trade Details Modal */}
      {selectedTrade && (
        <Modal
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          title="Trade Details"
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-dark-700">
              <div>
                <h4 className="text-2xl font-bold text-white">{selectedTrade.token}</h4>
                <p className="text-sm text-gray-400 mt-1">{selectedTrade.date} at {selectedTrade.time}</p>
              </div>
              <div className={`text-3xl font-black ${safeNumber(selectedTrade.pnl) >= 0 ? 'text-success' : 'text-danger'}`}>
                {safeNumber(selectedTrade.pnl) >= 0 ? '+' : ''}${safeToFixed(selectedTrade.pnl, 2)}
              </div>
            </div>

            {/* Trade Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Side</p>
                <p className={`text-lg font-bold ${selectedTrade.side === 'BUY' ? 'text-success' : 'text-danger'}`}>
                  {selectedTrade.side}
                </p>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className="text-lg font-bold text-white">{selectedTrade.status}</p>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Quantity</p>
                <p className="text-lg font-bold text-white">{safeToFixed(selectedTrade.quantity, 4)}</p>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Entry Price</p>
                <p className="text-lg font-bold text-white">${safeToFixed(selectedTrade.entryPrice, 4)}</p>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Exit Price</p>
                <p className="text-lg font-bold text-white">${selectedTrade.exitPrice ? safeToFixed(selectedTrade.exitPrice, 4) : 'N/A'}</p>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">P&L %</p>
                <p className={`text-lg font-bold ${safeNumber(selectedTrade.pnl) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {safeNumber(selectedTrade.pnl) >= 0 ? '+' : ''}{safeToFixed(selectedTrade.pnlPercent, 2)}%
                </p>
              </div>

              {selectedTrade.fees !== undefined && (
                <div className="bg-dark-900 p-4 rounded-lg border border-dark-700 col-span-2">
                  <p className="text-xs text-gray-400 mb-1">Fees</p>
                  <p className="text-lg font-bold text-white">${safeToFixed(selectedTrade.fees, 2)}</p>
                </div>
              )}
            </div>

            {/* Additional Details */}
            {selectedTrade.id && (
              <div className="bg-dark-900/50 p-3 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Trade ID</p>
                <p className="text-xs font-mono text-gray-300">{selectedTrade.id}</p>
              </div>
            )}

            {selectedTrade.timestamp && (
              <div className="bg-dark-900/50 p-3 rounded-lg border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Timestamp</p>
                <p className="text-xs font-mono text-gray-300">{new Date(selectedTrade.timestamp).toLocaleString()}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TradeTable;
