import React, { useState, useMemo } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';
import { useTradingData } from '../../context/TradingDataContext';

const AgentTabs = ({ onTabChange, showAllTab = true }) => {
  const { agents } = useAgentManagement();
  const { getTradesByAgent, trades } = useTradingData();

  // Get enabled agents
  const enabledAgents = useMemo(() => {
    return agents.filter(a => a.enabled);
  }, [agents]);

  // State for active tab
  const [activeTab, setActiveTab] = useState(
    showAllTab ? 'all' : enabledAgents[0]?.id || null
  );

  // Count trades per agent
  const tradeCounts = useMemo(() => {
    const counts = {};
    enabledAgents.forEach(agent => {
      counts[agent.id] = getTradesByAgent(agent.id).length;
    });
    // All trades count
    counts['all'] = trades.length;
    return counts;
  }, [enabledAgents, getTradesByAgent, trades]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  if (enabledAgents.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 text-center text-gray-400 text-sm">
        No enabled agents. Enable an agent to view trades.
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 border-b border-gray-700/50 overflow-x-auto">
        {/* All Agents Tab */}
        {showAllTab && (
          <button
            onClick={() => handleTabClick('all')}
            className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all relative ${
              activeTab === 'all'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>All Agents</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'all'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {tradeCounts['all'] || 0}
              </span>
            </div>
          </button>
        )}

        {/* Individual Agent Tabs */}
        {enabledAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleTabClick(agent.id)}
            className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all relative ${
              activeTab === agent.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Connection Status Indicator */}
              <div className={`w-2 h-2 rounded-full ${
                agent.connectionStatus === 'connected' ? 'bg-green-500' :
                agent.connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />

              <span>{agent.name}</span>

              {/* Trade Count Badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === agent.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {tradeCounts[agent.id] || 0}
              </span>

              {/* Agent Type Badge */}
              <span className={`px-2 py-0.5 rounded text-xs border ${
                agent.type === 'live' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                agent.type === 'demo' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                agent.type === 'api' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                agent.type === 'webhook' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                'bg-gray-500/10 text-gray-400 border-gray-500/30'
              }`}>
                {agent.type === 'demo' ? 'simulation' : agent.type}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AgentTabs;
