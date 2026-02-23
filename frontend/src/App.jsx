import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import UnifiedDashboard from './pages/UnifiedDashboard';
import ImportData from './pages/ImportData';
import AIAnalysis from './pages/AIAnalysis';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Agents from './pages/Agents';
import Performance from './pages/Performance';
import BotSetup from './pages/BotSetup';
import { TradingDataProvider } from './context/TradingDataContext';
import { AgentManagementProvider, useAgentManagement } from './context/AgentManagementContext';
import { SettingsProvider } from './context/SettingsContext';
import { WalletContextProvider } from './context/WalletContext';
import { BotStatusProvider } from './context/BotStatusContext';
import { ChevronDown, Plus, Power, PowerOff, BarChart3 } from 'lucide-react';
import AgentStatusBadge from './components/common/AgentStatusBadge';

// Agent Selector Component
const AgentSelector = () => {
  const { agents, selectedAgent, selectAgent, addAgent, enableAgent, disableAgent, connectAgent, disconnectAgent } = useAgentManagement();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  const handleAddAgent = () => {
    if (newAgentName.trim()) {
      addAgent({ name: newAgentName, type: 'simulated' });
      setNewAgentName('');
      setShowAddForm(false);
    }
  };

  const handleToggleConnection = (e, agentId) => {
    e.stopPropagation();
    // Always get fresh agent state from the context
    const freshAgent = agents.find(a => a.id === agentId);
    if (!freshAgent) return;

    console.log('Toggle connection for agent:', freshAgent.name, {
      enabled: freshAgent.enabled,
      connectionStatus: freshAgent.connectionStatus
    });

    if (freshAgent.connectionStatus === 'connected') {
      console.log('Disconnecting agent...');
      disconnectAgent(agentId);
    } else if (freshAgent.enabled) {
      console.log('Connecting agent...');
      connectAgent(agentId);
    } else {
      console.log('Enabling agent...');
      enableAgent(agentId);
    }
  };

  const handleViewStats = (e, agentId) => {
    e.stopPropagation();
    selectAgent(agentId);
    setShowDropdown(false);
    // Note: This assumes the user can navigate to analytics or agents page to see stats
  };

  // Get agent type badge color
  const getTypeBadgeColor = (type) => {
    switch (type) {
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

  // Group agents by type
  const groupedAgents = agents.reduce((acc, agent) => {
    if (!acc[agent.type]) {
      acc[agent.type] = [];
    }
    acc[agent.type].push(agent);
    return acc;
  }, {});

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        <AgentStatusBadge agent={selectedAgent || { enabled: false, connectionStatus: 'disconnected' }} showLabel={false} showTooltip={false} size="sm" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">{selectedAgent?.name || 'Select Agent'}</span>
          {selectedAgent && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${getTypeBadgeColor(selectedAgent.type)}`}>
              {selectedAgent.type}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`ml-2 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {Object.entries(groupedAgents).map(([type, typeAgents]) => (
            <div key={type} className="p-2 border-b border-dark-700 last:border-b-0">
              <div className="text-xs text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded border ${getTypeBadgeColor(type)}`}>
                  {type}
                </span>
                <span className="text-gray-500">({typeAgents.length})</span>
              </div>
              {typeAgents.map(agent => (
                <div
                  key={agent.id}
                  className={`group rounded transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'bg-accent/20'
                      : 'hover:bg-dark-700'
                  }`}
                >
                  <button
                    onClick={() => {
                      selectAgent(agent.id);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <AgentStatusBadge agent={agent} showLabel={false} showTooltip={true} size="sm" />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-medium truncate ${
                          selectedAgent?.id === agent.id ? 'text-accent' : 'text-gray-300'
                        }`}>
                          {agent.name}
                        </span>
                        {agent.stats && (
                          <span className="text-xs text-gray-500">
                            {agent.stats.totalTrades} trades • {agent.stats.winRate?.toFixed(1)}% WR
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleToggleConnection(e, agent.id)}
                        className={`p-1.5 rounded transition-colors ${
                          agent.connectionStatus === 'connected'
                            ? 'hover:bg-red-500/20 text-red-400'
                            : agent.enabled
                            ? 'hover:bg-blue-500/20 text-blue-400'
                            : 'hover:bg-green-500/20 text-green-400'
                        }`}
                        title={
                          agent.connectionStatus === 'connected'
                            ? 'Disconnect'
                            : agent.enabled
                            ? 'Connect'
                            : 'Enable'
                        }
                      >
                        {agent.connectionStatus === 'connected' ? (
                          <PowerOff size={14} />
                        ) : (
                          <Power size={14} />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleViewStats(e, agent.id)}
                        className="p-1.5 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                        title="View Stats"
                      >
                        <BarChart3 size={14} />
                      </button>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-dark-700 p-2">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-dark-700 rounded transition-colors"
              >
                <Plus size={16} />
                Add New Agent
              </button>
            ) : (
              <div className="p-2">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Agent name..."
                  className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded text-sm mb-2"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddAgent()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddAgent}
                    className="flex-1 bg-accent text-white px-3 py-1 rounded text-xs hover:bg-accent-dark transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewAgentName('');
                    }}
                    className="flex-1 bg-dark-900 text-gray-400 px-3 py-1 rounded text-xs hover:bg-dark-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="flex min-h-screen font-sans selection:bg-accent/30">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Top Bar / Breadcrumb */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center text-sm text-gray-500">
              <span className="text-gray-600">Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-white capitalize">{activePage.replace('-', ' ')}</span>
            </div>

            {/* Agent Selector */}
            <AgentSelector />
          </div>

          {/* Content Router */}
          {activePage === 'dashboard' && <UnifiedDashboard />}
          {activePage === 'performance' && <Performance />}
          {activePage === 'analytics' && <Analytics />}
          {activePage === 'bot-setup' && <BotSetup />}
          {activePage === 'agents' && <Agents />}
          {activePage === 'import' && <ImportData />}
          {activePage === 'ai-analysis' && <AIAnalysis />}
          {activePage === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <BotStatusProvider>
        <WalletContextProvider>
          <AgentManagementProvider>
            <TradingDataProvider>
              <AppContent />
            </TradingDataProvider>
          </AgentManagementProvider>
        </WalletContextProvider>
      </BotStatusProvider>
    </SettingsProvider>
  );
}

export default App;
