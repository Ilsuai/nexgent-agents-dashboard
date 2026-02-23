import React from 'react';
import { X, TrendingUp, TrendingDown, Clock, ExternalLink, AlertCircle, Zap, XCircle } from 'lucide-react';
import { useAgentManagement } from '../../context/AgentManagementContext';

const TradeDetailsModal = ({ trade, onClose }) => {
  const { agents } = useAgentManagement();

  if (!trade) return null;

  const isFailed = trade.status === 'FAILED' || trade.type === 'failed';
  const isOpen = trade.status === 'OPEN' || trade.type === 'open';
  const isProfitable = !isFailed && (trade.pnl ?? 0) >= 0;
  const agent = agents.find(a => a.id === trade.agentId);

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Format hold time from milliseconds
  const formatHoldTime = (ms) => {
    if (!ms || ms <= 0) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Calculate P&L including fees
  const entryFee = trade.entryFeeSol || 0;
  const exitFee = trade.exitFeeSol || 0;
  const totalFees = trade.totalFees || (entryFee + exitFee);
  const grossPnlSol = trade.pnlSol || 0;
  const netPnlSol = grossPnlSol - totalFees;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-dark-700">

        {/* Header */}
        <div className={`p-5 border-b-4 ${isFailed ? 'border-red-500' : isProfitable ? 'border-success' : 'border-danger'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isFailed ? 'bg-red-500/20' : isProfitable ? 'bg-success/20' : 'bg-danger/20'
              }`}>
                {isFailed ? <XCircle className="text-red-400" size={20} /> :
                 isProfitable ? <TrendingUp className="text-success" size={20} /> :
                 <TrendingDown className="text-danger" size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{trade.token || trade.tokenSymbol}</h2>
                <p className="text-xs text-gray-400">
                  {isFailed ? <span className="text-red-400">FAILED</span> :
                   isOpen ? <span className="text-blue-400">OPEN POSITION</span> :
                   trade.type === 'unified' ? 'Complete Trade' : trade.status}
                  {agent && <span className="ml-2 text-blue-400">• {agent.name}</span>}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Signal Received Timestamp */}
        {(trade.signalReceivedAt || trade._buyTrade?.signalReceivedAt) && (
          <div className="px-5 py-3 bg-blue-500/10 border-b border-blue-500/20">
            <div className="flex items-center gap-2 text-sm">
              <Zap size={14} className="text-blue-400" />
              <span className="text-gray-400">Signal Received:</span>
              <span className="text-blue-400 font-mono">
                {formatTime(trade.signalReceivedAt || trade._buyTrade?.signalReceivedAt)}
              </span>
            </div>
          </div>
        )}

        {/* Failed Trade Error */}
        {isFailed && (
          <div className="p-5 bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-red-400 font-semibold text-sm">Trade Execution Failed</p>
                <p className="text-red-300/80 text-xs mt-1">{trade.errorMessage || 'Unknown error'}</p>
                {trade.tradeFailedAt && (
                  <p className="text-red-300/60 text-xs mt-1">Failed at: {formatTime(trade.tradeFailedAt)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* P&L Summary - Only show for non-failed trades */}
        {!isFailed && (
        <div className="p-5 bg-dark-900/50 border-b border-dark-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">{isOpen ? 'Unrealized P&L' : 'Net P&L'}</p>
              <p className={`text-2xl font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                {isProfitable ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}
              </p>
              {trade.pnlSol !== undefined && trade.pnlSol !== null && (
                <p className={`text-xs ${isProfitable ? 'text-success/70' : 'text-danger/70'}`}>
                  {isProfitable ? '+' : ''}{trade.pnlSol.toFixed(4)} SOL
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Return</p>
              <p className={`text-2xl font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                {isProfitable ? '+' : ''}{(trade.pnlPercent ?? 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{isOpen ? 'Current Price' : 'Hold Time'}</p>
              <p className="text-2xl font-bold text-white">
                {isOpen ? `$${(trade.livePrice || trade.currentPrice || 0).toFixed(6)}` : formatHoldTime(trade.holdTime)}
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Transactions */}
        <div className="p-5 space-y-4">

          {/* BUY Transaction - Show for unified and open trades, not for orphan/failed sells */}
          {!isFailed && (trade.type === 'unified' || trade.type === 'open' || trade.entryPrice > 0) && (
          <div className="bg-success/5 border border-success/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-success" size={16} />
                <span className="font-bold text-success">BUY</span>
              </div>
              {trade.entryDex && (
                <span className="text-xs text-gray-500">DEX: {trade.entryDex}</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Price</p>
                <p className="text-white font-mono">${(trade.entryPrice || 0).toFixed(8)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="text-white font-mono">{(trade.entryPositionSol || trade.positionSize || 0).toFixed(4)} SOL</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fee</p>
                <p className="text-yellow-400 font-mono">{(trade.entryFeeSol || 0).toFixed(6)} SOL</p>
              </div>
            </div>

            {/* BUY Timestamps with Solscan link */}
            <div className="mt-3 pt-3 border-t border-success/20">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Zap size={10} className="text-blue-400" />
                    <span className="text-[10px] text-gray-500">Signal:</span>
                    <span className="text-[10px] text-blue-400 font-mono">{formatTime(trade.signalReceivedAt || trade._buyTrade?.signalReceivedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={10} className="text-gray-500" />
                    <span className="text-[10px] text-gray-500">Executed:</span>
                    <span className="text-[10px] text-gray-300 font-mono">{formatTime(trade.entryTime || trade.timestamp)}</span>
                  </div>
                </div>
                {(trade.entryTxSignature || trade.txSignature) && (
                  <a
                    href={`https://solscan.io/tx/${trade.entryTxSignature || trade.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded"
                    title="View on Solscan"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>
          )}

          {/* SELL Transaction - Only show for unified/closed trades with exit data */}
          {!isFailed && (trade.type === 'unified' || (trade.exitTime && trade.exitPrice > 0)) && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="text-danger" size={16} />
                  <span className="font-bold text-danger">SELL</span>
                </div>
                {trade.exitDex && (
                  <span className="text-xs text-gray-500">DEX: {trade.exitDex}</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-white font-mono">${(trade.exitPrice || 0).toFixed(8)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-white font-mono">{(trade.exitPositionSol || 0).toFixed(4)} SOL</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fee</p>
                  <p className="text-yellow-400 font-mono">{(trade.exitFeeSol || 0).toFixed(6)} SOL</p>
                </div>
              </div>

              {/* SELL Timestamps with Solscan link */}
              <div className="mt-3 pt-3 border-t border-danger/20">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Zap size={10} className="text-blue-400" />
                      <span className="text-[10px] text-gray-500">Signal:</span>
                      <span className="text-[10px] text-blue-400 font-mono">{formatTime(trade._sellTrade?.signalReceivedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={10} className="text-gray-500" />
                      <span className="text-[10px] text-gray-500">Executed:</span>
                      <span className="text-[10px] text-gray-300 font-mono">{formatTime(trade.exitTime)}</span>
                    </div>
                  </div>
                  {trade.exitTxSignature && (
                    <a
                      href={`https://solscan.io/tx/${trade.exitTxSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded"
                      title="View on Solscan"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fee Summary - Only show for non-failed trades */}
          {!isFailed && (
          <div className="bg-dark-900 rounded-xl p-4 border border-dark-700">
            <h4 className="text-sm font-bold text-white mb-3">Fee Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Entry Fee</p>
                <p className="text-yellow-400 font-mono">{(trade.entryFeeSol || 0).toFixed(6)} SOL</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Exit Fee</p>
                <p className="text-yellow-400 font-mono">{(trade.exitFeeSol || 0).toFixed(6)} SOL</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Fees</p>
                <p className="text-yellow-400 font-bold">{totalFees.toFixed(6)} SOL</p>
              </div>
            </div>
          </div>
          )}

          {/* Token Info */}
          {trade.tokenAddress && (
            <div className="bg-dark-900 rounded-xl p-4 border border-dark-700">
              <h4 className="text-sm font-bold text-white mb-2">Token</h4>
              <a
                href={`https://solscan.io/token/${trade.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-mono break-all"
              >
                {trade.tokenAddress}
                <ExternalLink size={12} className="flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Trade ID */}
          <div className="text-center pt-2 border-t border-dark-700">
            <p className="text-xs text-gray-500">Trade ID: <span className="font-mono">{trade.id}</span></p>
          </div>
        </div>

        {/* Close Button */}
        <div className="p-4 border-t border-dark-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeDetailsModal;
