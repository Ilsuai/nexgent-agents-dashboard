import React, { useState } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';

const AgentCard = ({ agent, onEdit, onViewStats }) => {
  const { enableAgent, disableAgent, testConnection, deleteAgent } = useAgentManagement();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleToggleEnable = async () => {
    if (agent.enabled) {
      disableAgent(agent.id);
    } else {
      await enableAgent(agent.id);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(agent.id);
      setTestResult(result);

      // Clear result after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${agent.name}"? This cannot be undone.`)) {
      deleteAgent(agent.id);
    }
  };

  // Get status badge color
  const getStatusColor = () => {
    if (!agent.enabled) return 'bg-gray-500';

    switch (agent.connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!agent.enabled) return 'Disabled';

    switch (agent.connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getTypeLabel = () => {
    switch (agent.type) {
      case 'live':
        return 'Live Trading';
      case 'demo':
        return 'Simulation';
      case 'api':
        return 'API Integration';
      case 'webhook':
        return 'Webhook';
      default:
        return agent.type;
    }
  };

  const getTypeBadgeColor = () => {
    switch (agent.type) {
      case 'live':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'demo':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'api':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'webhook':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:border-gray-600/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{agent.name}</h3>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${agent.status === 'connecting' ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-gray-400">{getStatusText()}</span>
            </div>
          </div>

          {/* Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded border ${getTypeBadgeColor()}`}>
              {getTypeLabel()}
            </span>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="text-sm text-gray-400 mt-2">{agent.description}</p>
          )}
        </div>

        {/* Enable/Disable Toggle */}
        <button
          onClick={handleToggleEnable}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            agent.enabled
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
          }`}
        >
          {agent.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-700/50">
        <div>
          <div className="text-xs text-gray-500 mb-1">Total Trades</div>
          <div className="text-lg font-semibold text-white">
            {agent.stats?.totalTrades || 0}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Win Rate</div>
          <div className="text-lg font-semibold text-white">
            {agent.stats?.winRate || 0}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Total P&L</div>
          <div className={`text-lg font-semibold ${
            (agent.stats?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            ${(agent.stats?.totalPnL || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          testResult.success
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTestConnection}
          disabled={isTesting}
          className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={() => onViewStats(agent)}
          className="flex-1 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all border border-purple-500/30 text-sm font-medium"
        >
          View Stats
        </button>

        <button
          onClick={() => onEdit(agent)}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all text-sm font-medium"
        >
          Edit
        </button>

        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Last Activity */}
      {agent.lastActivity && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="text-xs text-gray-500">
            Last activity: {new Date(agent.lastActivity).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCard;
