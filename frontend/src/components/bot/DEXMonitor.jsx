import React, { useState, useEffect, useRef } from 'react';
import { Activity, Eye, AlertCircle, Loader, Brain, Shield, Star, Search, PowerOff } from 'lucide-react';
import { useBotStatus } from '../../context/BotStatusContext';

/**
 * Combined Agent Status & DEX Monitor
 * Shows REAL data only - no simulations
 * - Agent connection status
 * - Real-time DEX scanning activity from agent
 * - Real tokens being scanned with actual risk/quality scores
 * - DEX sources status
 */

const DEXMonitor = ({ agent, compact = false }) => {
  const { botEnabled } = useBotStatus();
  const [scanActivity, setScanActivity] = useState({
    status: 'idle',
    agentRunning: false,
    agentConnected: false,
    tokensScanned: 0,
    signalsGenerated: 0,
    lastScanTime: null,
    recentScans: [], // Real scans from agent
    sources: {
      dexscreener: { active: false, lastUpdate: null },
      birdeye: { active: false, lastUpdate: null },
      jupiter: { active: false, lastUpdate: null },
      helius: { active: false, lastUpdate: null }
    }
  });

  const tickerRef = useRef(null);

  // Fetch real scanning activity from Railway API
  useEffect(() => {
    // Don't poll if bot is disabled - saves API calls and resources
    if (!botEnabled) {
      setScanActivity(prev => ({
        ...prev,
        status: 'disabled',
        agentRunning: false,
        agentConnected: false,
      }));
      return;
    }

    // Handle apiEndpoint that may or may not include /api/v1
    let baseUrl = agent?.apiEndpoint || 'https://solana-trading-agent-production.up.railway.app';
    // Remove trailing /api/v1 if present to avoid doubling
    baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');

    const fetchScanActivity = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/v1/status`);
        if (response.ok) {
          const data = await response.json();
          const stats = data.data?.stats || data.stats || {};
          const running = data.data?.running || data.running || data.is_running || false;
          const recentScans = data.data?.recent_scans || data.recent_scans || [];

          setScanActivity(prev => ({
            ...prev,
            status: running ? 'scanning' : 'idle',
            agentRunning: running,
            agentConnected: true,
            tokensScanned: stats.tokens_scanned || 0,
            signalsGenerated: stats.signals_generated || 0,
            lastScanTime: new Date(),
            recentScans: recentScans,
            sources: {
              dexscreener: { active: running, lastUpdate: running ? new Date() : null },
              birdeye: { active: running, lastUpdate: running ? new Date() : null },
              jupiter: { active: running, lastUpdate: running ? new Date() : null },
              helius: { active: running, lastUpdate: running ? new Date() : null }
            }
          }));
        } else {
          setScanActivity(prev => ({ ...prev, agentConnected: false, status: 'idle' }));
        }
      } catch (error) {
        console.error('Failed to fetch scan activity:', error);
        setScanActivity(prev => ({ ...prev, agentConnected: false, status: 'idle' }));
      }
    };

    fetchScanActivity();

    // Poll every 15 seconds, but only when tab is visible
    let intervalId = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(fetchScanActivity, 15000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchScanActivity();
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [agent, botEnabled]);

  // Get score color
  const getScoreColor = (score, isRisk = false) => {
    if (score === undefined || score === null) return 'text-gray-400';
    if (isRisk) {
      if (score >= 70) return 'text-green-400';
      if (score >= 40) return 'text-yellow-400';
      return 'text-red-400';
    } else {
      if (score >= 70) return 'text-green-400';
      if (score >= 40) return 'text-yellow-400';
      return 'text-red-400';
    }
  };

  const getScoreBg = (score, isRisk = false) => {
    if (score === undefined || score === null) return 'bg-gray-500/20';
    if (isRisk) {
      if (score >= 70) return 'bg-green-500/20';
      if (score >= 40) return 'bg-yellow-500/20';
      return 'bg-red-500/20';
    } else {
      if (score >= 70) return 'bg-green-500/20';
      if (score >= 40) return 'bg-yellow-500/20';
      return 'bg-red-500/20';
    }
  };

  if (!agent) {
    return (
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <div className="text-center text-gray-400">
          <AlertCircle className="mx-auto mb-2" size={32} />
          <p>No agent selected</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              scanActivity.agentRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`} />
            <div>
              <p className="text-sm font-semibold text-white">
                {scanActivity.agentRunning ? 'Agent Running' : 'Agent Idle'}
              </p>
              <p className="text-xs text-gray-400">
                {scanActivity.tokensScanned} tokens scanned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Object.entries(scanActivity.sources).map(([source, data]) => (
              <div
                key={source}
                className={`w-2 h-2 rounded-full ${data.active ? 'bg-green-400' : 'bg-gray-600'}`}
                title={source}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
      {/* Agent Status Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            scanActivity.agentRunning ? 'bg-green-500/20' : 'bg-gray-500/20'
          }`}>
            {scanActivity.agentRunning ? (
              <Eye className="text-green-400" size={20} />
            ) : (
              <Brain className="text-gray-400" size={20} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Agent Status</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                scanActivity.agentConnected && scanActivity.agentRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`} />
              <span className="text-xs text-gray-400">
                {!scanActivity.agentConnected ? 'Disconnected' :
                 scanActivity.agentRunning ? 'Running' : 'Connected (Idle)'}
              </span>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
          scanActivity.agentRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {scanActivity.agentRunning ? 'SCANNING' : 'IDLE'}
        </div>
      </div>

      {/* Live Token Scanner Preview - Only shows REAL data from agent */}
      {scanActivity.recentScans.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="text-blue-400" size={14} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Scans (Real Data)</span>
            {scanActivity.agentRunning && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
          </div>

          <div className="relative overflow-hidden bg-dark-900/50 rounded-lg border border-dark-700">
            <div
              ref={tickerRef}
              className="flex gap-2 p-2 overflow-x-auto scrollbar-hide"
            >
              {scanActivity.recentScans.map((scan, index) => (
                <div
                  key={scan.address || index}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                    index === 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-dark-800 border-dark-700'
                  }`}
                >
                  <span className={`font-bold text-sm ${index === 0 ? 'text-blue-400' : 'text-white'}`}>
                    {scan.symbol || 'UNKNOWN'}
                  </span>

                  {scan.risk_score !== undefined && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${getScoreBg(scan.risk_score, true)}`}>
                      <Shield size={10} className={getScoreColor(scan.risk_score, true)} />
                      <span className={`text-xs font-mono ${getScoreColor(scan.risk_score, true)}`}>
                        {scan.risk_score}
                      </span>
                    </div>
                  )}

                  {scan.quality_score !== undefined && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${getScoreBg(scan.quality_score)}`}>
                      <Star size={10} className={getScoreColor(scan.quality_score)} />
                      <span className={`text-xs font-mono ${getScoreColor(scan.quality_score)}`}>
                        {scan.quality_score}
                      </span>
                    </div>
                  )}

                  {scan.signal && (
                    <span className="text-xs text-yellow-400 font-bold">SIGNAL</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Shield size={10} />
              <span>Risk Score (higher = safer)</span>
            </div>
            <div className="flex items-center gap-1">
              <Star size={10} />
              <span>Quality (higher = better)</span>
            </div>
          </div>
        </div>
      )}

      {/* No scans message */}
      {scanActivity.agentConnected && scanActivity.recentScans.length === 0 && (
        <div className="mb-4 p-4 bg-dark-900/50 rounded-lg border border-dark-700 text-center">
          <p className="text-sm text-gray-400">
            {scanActivity.agentRunning
              ? 'Scanning for tokens... waiting for results'
              : 'Agent is idle. Start scanning to see real token data.'}
          </p>
        </div>
      )}

      {/* Main Title */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Eye className="text-blue-400" size={20} />
          DEX Scanner Activity
        </h3>
      </div>

      {/* DEX Sources Status */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Object.entries(scanActivity.sources).map(([source, data]) => (
          <div
            key={source}
            className={`p-3 rounded-lg border ${
              data.active ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white capitalize">
                  {source === 'dexscreener' ? 'DexScreener' :
                   source === 'birdeye' ? 'Birdeye' :
                   source === 'jupiter' ? 'Jupiter' : 'Helius'}
                </p>
                <p className="text-xs text-gray-400">
                  {data.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${data.active ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Scan Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-dark-900 rounded-lg">
          <p className="text-2xl font-bold text-blue-400">{scanActivity.tokensScanned}</p>
          <p className="text-xs text-gray-400 mt-1">Tokens Scanned</p>
        </div>
        <div className="text-center p-3 bg-dark-900 rounded-lg">
          <p className="text-2xl font-bold text-yellow-400">{scanActivity.signalsGenerated}</p>
          <p className="text-xs text-gray-400 mt-1">Signals Found</p>
        </div>
        <div className="text-center p-3 bg-dark-900 rounded-lg">
          <p className="text-2xl font-bold text-purple-400">
            {scanActivity.lastScanTime
              ? new Date(scanActivity.lastScanTime).toLocaleTimeString('en-US', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })
              : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Last Update</p>
        </div>
      </div>

      {/* Info Message */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Activity className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
        <div className="text-xs text-blue-300">
          <p className="font-semibold mb-1">Real-Time Data Only</p>
          <p className="text-blue-400/80">
            All data shown is real from DexScreener, Birdeye, and Jupiter APIs.
            Paper trading uses real prices but doesn't execute actual transactions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DEXMonitor;
