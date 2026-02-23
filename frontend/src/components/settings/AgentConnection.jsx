import React, { useState, useMemo } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';
import { Activity, CheckCircle, XCircle, RefreshCw, Zap, Power, PowerOff, TrendingUp } from 'lucide-react';

const AgentConnection = () => {
  const {
    agents,
    selectedAgentId,
    connectAgent,
    disconnectAgent
  } = useAgentManagement();

  const [isConnecting, setIsConnecting] = useState(false);

  // Get the selected agent or fall back to first available
  const currentAgent = useMemo(() => {
    return agents.find(a => a.id === selectedAgentId) || agents[0] || null;
  }, [agents, selectedAgentId]);

  const handleConnect = async () => {
    if (!currentAgent) {
      console.error('❌ No agent available');
      alert('No agent found. Please refresh the page.');
      return;
    }

    setIsConnecting(true);
    try {
      console.log(`🔌 Starting connection process...`);
      console.log(`   Agent ID: ${currentAgent.id}`);
      console.log(`   Agent Type: ${currentAgent.type}`);
      console.log(`   Agent Name: ${currentAgent.name}`);

      // Connect using AgentManagementContext (handles both demo and live agents)
      console.log(`📡 Calling connectAgent(${currentAgent.id})...`);
      await connectAgent(currentAgent.id);
      console.log(`✅ connectAgent() completed`);

      // Demo agents work independently and emit trades directly
      // Live agents connect via WebSocket and sync to Firebase
      console.log(`${currentAgent.type === 'demo' ? '🧪 Demo' : '🤖 Live'} mode - trades sync to Firebase`);

      console.log(`✅ ${currentAgent.name} connected successfully!`);
      console.log(`📊 Simulator should now be generating trades...`);
    } catch (error) {
      console.error('❌ Failed to connect to agent:', error);
      alert(`Failed to connect to ${currentAgent.name}. ${error.message || 'Please try again.'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (currentAgent) {
      disconnectAgent(currentAgent.id);
    }
  };

  // Check connection status
  const isConnected = currentAgent?.connectionStatus === 'connected';
  const isEnabled = currentAgent?.enabled;

  // Get connection status details
  const getStatusText = () => {
    if (!currentAgent) return 'No Agent';
    if (isConnected) return 'Connected';
    if (currentAgent.status === 'connecting') return 'Connecting...';
    if (isEnabled) return 'Ready';
    return 'Disabled';
  };

  const getStatusColor = () => {
    if (!currentAgent) return 'text-gray-400';
    if (isConnected) return 'text-success';
    if (currentAgent.status === 'connecting') return 'text-yellow-400';
    if (isEnabled) return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Zap className={`${isConnected ? 'text-accent' : 'text-gray-400'}`} size={24} />
          <div>
            <h3 className="text-lg font-bold text-white">Trading Agent Connection</h3>
            <p className="text-xs text-gray-400 mt-1">
              {currentAgent?.type === 'demo'
                ? 'Simulated trading with intelligent strategy'
                : 'Connect to your live Solana trading agent'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-2 text-success text-sm">
              <CheckCircle size={16} />
              Connected
            </span>
          ) : currentAgent?.status === 'connecting' ? (
            <span className="flex items-center gap-2 text-yellow-400 text-sm">
              <RefreshCw className="animate-spin" size={16} />
              Connecting
            </span>
          ) : isEnabled ? (
            <span className="flex items-center gap-2 text-blue-400 text-sm">
              <Activity size={16} />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-2 text-gray-400 text-sm">
              <XCircle size={16} />
              Disabled
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Agent Info */}
        {currentAgent && (
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Agent Name</p>
                <p className="text-white font-semibold">{currentAgent.name}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Type</p>
                <p className="text-white font-semibold capitalize">
                  {currentAgent.type === 'demo' ? '🧪 Demo (Simulated)' : '🤖 Live Trading'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Status</p>
                <p className={`font-semibold ${getStatusColor()}`}>
                  {getStatusText()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Last Activity</p>
                <p className="text-white text-xs">
                  {currentAgent.lastActivity
                    ? new Date(currentAgent.lastActivity).toLocaleTimeString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Agent Stats (if connected) */}
        {isConnected && currentAgent?.stats && (
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-xs mb-3 font-semibold uppercase">Agent Statistics</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Total Trades</p>
                <p className="text-white font-bold text-lg">{currentAgent.stats.totalTrades || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Win Rate</p>
                <p className="text-success font-bold text-lg">
                  {currentAgent.stats.winRate?.toFixed(1) || '0.0'}%
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total P&L</p>
                <p className={`font-bold text-lg ${(currentAgent.stats.totalPnL ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(currentAgent.stats.totalPnL ?? 0) >= 0 ? '+' : ''}${(currentAgent.stats.totalPnL ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Demo Agent Info */}
        {currentAgent?.type === 'demo' && !isConnected && (
          <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
            <div className="flex items-start gap-3">
              <TrendingUp className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-blue-300 font-semibold text-sm mb-1">
                  Intelligent Demo Trading
                </p>
                <p className="text-blue-200/80 text-xs leading-relaxed">
                  This demo agent uses advanced market simulation with:
                </p>
                <ul className="text-blue-200/70 text-xs space-y-1 mt-2 ml-1">
                  <li>• <span className="text-blue-200">Dynamic stop loss</span> based on volatility & support levels</li>
                  <li>• <span className="text-blue-200">Multiple take profit targets</span> (15%-40%) with partial exits</li>
                  <li>• <span className="text-blue-200">Technical analysis</span>: RSI, momentum, trend detection</li>
                  <li>• <span className="text-blue-200">Risk management</span>: Position sizing, trailing stops, stale trade detection</li>
                  <li>• <span className="text-blue-200">Continuous scanning</span> of 8 Solana tokens every second</li>
                  <li>• <span className="text-blue-200">82% target win rate</span> with high-quality signal filtering</li>
                </ul>
                <p className="text-blue-200/60 text-xs mt-2 italic">
                  Click "Start Agent" below to begin simulated trading. No terminal or backend required!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting || !currentAgent}
              className="flex-1 bg-accent hover:bg-accent/80 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Connecting...
                </>
              ) : (
                <>
                  <Power size={16} />
                  {currentAgent?.type === 'demo' ? 'Start Agent' : 'Connect to Agent'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex-1 bg-danger/10 hover:bg-danger/20 border border-danger/50 text-danger px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <PowerOff size={16} />
              {currentAgent?.type === 'demo' ? 'Stop Agent' : 'Disconnect'}
            </button>
          )}
        </div>

        {/* Quick Start Guide */}
        {!isConnected && (
          <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700/50">
            <p className="text-xs text-gray-400 mb-2 font-semibold">🚀 Quick Start:</p>
            <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
              {currentAgent?.type === 'demo' ? (
                <>
                  <li>Click <span className="text-accent font-semibold">"Start Agent"</span> above to begin demo trading</li>
                  <li>Watch live simulated trades appear in the Dashboard</li>
                  <li>View DEX scanner activity in real-time</li>
                  <li>Analyze performance with detailed trade history</li>
                  <li className="text-gray-500 italic">No backend or terminal required - everything runs in your browser!</li>
                </>
              ) : (
                <>
                  <li>Ensure your Railway trading agent is deployed and running</li>
                  <li>Verify the API endpoint is correct in agent settings</li>
                  <li>Click <span className="text-accent font-semibold">"Connect to Agent"</span> above</li>
                  <li>Live trades will sync automatically</li>
                </>
              )}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentConnection;
