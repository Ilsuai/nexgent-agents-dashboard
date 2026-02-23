/**
 * SignalActivityLog - Shows recent signal activity
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  ExternalLink,
} from 'lucide-react';

const SignalActivityLog = () => {
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({ total: 0, executed: 0, rejected: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSignals = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/signals/list?limit=50');
      if (response.ok) {
        const data = await response.json();
        setSignals(data.signals || []);
        setStats(data.stats || { total: 0, executed: 0, rejected: 0, failed: 0 });
        setError(null);
      } else {
        setError('Failed to fetch signals');
      }
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSignals();

    // Poll every 30 seconds, but only when tab is visible
    let interval = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(fetchSignals, 30000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchSignals();
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'executed':
        return <CheckCircle className="text-success" size={16} />;
      case 'rejected':
        return <XCircle className="text-yellow-400" size={16} />;
      case 'failed':
        return <AlertTriangle className="text-danger" size={16} />;
      case 'processing':
        return <Clock className="text-blue-400 animate-pulse" size={16} />;
      default:
        return <Activity className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'executed': return 'bg-success/20 text-success';
      case 'rejected': return 'bg-yellow-500/20 text-yellow-400';
      case 'failed': return 'bg-danger/20 text-danger';
      case 'processing': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="text-accent" size={24} />
          <div>
            <h3 className="text-lg font-bold text-white">Signal Activity</h3>
            <p className="text-xs text-gray-400">Recent signals received from providers</p>
          </div>
        </div>
        <button
          onClick={fetchSignals}
          disabled={isLoading}
          className="p-2 rounded-lg bg-surface hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-surface rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
        <div className="bg-surface rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{stats.executed}</p>
          <p className="text-xs text-gray-400">Executed</p>
        </div>
        <div className="bg-surface rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.rejected}</p>
          <p className="text-xs text-gray-400">Rejected</p>
        </div>
        <div className="bg-surface rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-danger">{stats.failed}</p>
          <p className="text-xs text-gray-400">Failed</p>
        </div>
      </div>

      {/* Signal List */}
      {error ? (
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto text-danger mb-2" size={32} />
          <p className="text-danger text-sm">{error}</p>
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="mx-auto text-gray-500 mb-3" size={48} />
          <p className="text-gray-400">No signals received yet</p>
          <p className="text-xs text-gray-500 mt-1">Signals will appear here when your providers send them</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="bg-surface rounded-lg p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {signal.action === 'BUY' ? (
                    <ArrowUpCircle className="text-success" size={18} />
                  ) : (
                    <ArrowDownCircle className="text-danger" size={18} />
                  )}
                  <span className="font-semibold text-white">{signal.tokenSymbol || 'UNKNOWN'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    signal.action === 'BUY' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                  }`}>
                    {signal.action}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(signal.status)}`}>
                    {signal.status}
                  </span>
                  {getStatusIcon(signal.status)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="text-gray-300 ml-1">{signal.amount} SOL</span>
                </div>
                <div>
                  <span className="text-gray-500">Source:</span>
                  <span className="text-gray-300 ml-1">{signal.source || 'webhook'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Time:</span>
                  <span className="text-gray-300 ml-1">{formatTime(signal.signalReceivedAt)}</span>
                </div>
              </div>

              {signal.error && (
                <div className="mt-2 text-xs text-danger bg-danger/10 rounded px-2 py-1">
                  {signal.error}
                </div>
              )}

              {signal.reason && signal.status === 'rejected' && (
                <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                  Reason: {signal.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignalActivityLog;
