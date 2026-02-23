import React from 'react';
import { useTradingData } from '../../context/TradingDataContext';
import { useAgentManagement } from '../../context/AgentManagementContext';

const TradeViewModeSelector = ({ showAgentFilter = true }) => {
  const { tradeViewMode, setTradeViewMode, activeAgentFilter, setActiveAgentFilter } = useTradingData();
  const { agents, selectedAgentId } = useAgentManagement();

  const viewModes = [
    {
      id: 'active-agent',
      label: 'Active Agent',
      description: 'Show only active agent trades',
    },
    {
      id: 'all-trades',
      label: 'All Trades',
      description: 'Show all trades with filters',
    },
    {
      id: 'per-agent-tabs',
      label: 'Per Agent',
      description: 'Separate tabs per agent',
    },
  ];

  const handleModeChange = (mode) => {
    setTradeViewMode(mode);

    // Auto-set active agent filter when switching to active-agent mode
    if (mode === 'active-agent' && selectedAgentId) {
      setActiveAgentFilter(selectedAgentId);
    }
  };

  return (
    <div className="mb-6">
      {/* View Mode Selector */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-sm font-medium text-gray-400">View Mode:</div>
        <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tradeViewMode === mode.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Filter Dropdown (for "All Trades" mode) */}
      {showAgentFilter && tradeViewMode === 'all-trades' && agents.length > 1 && (
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-gray-400">Filter by Agent:</div>
          <select
            value={activeAgentFilter || 'all'}
            onChange={(e) => setActiveAgentFilter(e.target.value === 'all' ? null : e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.stats?.totalTrades || 0} trades)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default TradeViewModeSelector;
