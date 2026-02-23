/**
 * ExternalAgentManager - Manage External Trading Agents
 * Add, configure, and monitor external signal providers
 */

import React, { useState } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';
import { generateApiKey, generateWebhookUrl, maskApiKey } from '../../services/apiKeyManager';
import {
  Plus,
  Webhook,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Settings,
  ExternalLink,
  Zap,
  AlertTriangle,
  Activity
} from 'lucide-react';

// External Agent Card Component
const ExternalAgentCard = ({ agent, onToggleTrading, onRegenerateKey, onDelete }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const webhookUrl = generateWebhookUrl(agent.id);

  return (
    <div className="bg-surface-light rounded-lg p-4 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            agent.tradingEnabled ? 'bg-accent/20' : 'bg-gray-500/20'
          }`}>
            <Webhook className={agent.tradingEnabled ? 'text-accent' : 'text-gray-400'} size={20} />
          </div>
          <div>
            <h4 className="font-medium text-white">{agent.name}</h4>
            <p className="text-xs text-gray-400">
              {agent.stats?.totalSignals || 0} signals received
            </p>
          </div>
        </div>

        {/* Trading Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Trading</span>
          <button
            onClick={() => onToggleTrading(agent.id, !agent.tradingEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              agent.tradingEnabled ? 'bg-accent' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                agent.tradingEnabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">Webhook URL</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-surface rounded px-3 py-2 text-xs text-gray-300 font-mono overflow-hidden text-ellipsis">
            {webhookUrl}
          </code>
          <button
            onClick={() => handleCopy(webhookUrl, 'url')}
            className="p-2 rounded bg-surface hover:bg-white/10 transition-colors"
          >
            {copiedField === 'url' ? (
              <Check size={14} className="text-success" />
            ) : (
              <Copy size={14} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">API Key</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-surface rounded px-3 py-2 text-xs text-gray-300 font-mono">
            {showApiKey ? agent.apiKey : maskApiKey(agent.apiKey)}
          </code>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="p-2 rounded bg-surface hover:bg-white/10 transition-colors"
          >
            {showApiKey ? (
              <EyeOff size={14} className="text-gray-400" />
            ) : (
              <Eye size={14} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={() => handleCopy(agent.apiKey, 'key')}
            className="p-2 rounded bg-surface hover:bg-white/10 transition-colors"
          >
            {copiedField === 'key' ? (
              <Check size={14} className="text-success" />
            ) : (
              <Copy size={14} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface rounded p-2 text-center">
          <p className="text-lg font-bold text-white">{agent.stats?.totalSignals || 0}</p>
          <p className="text-xs text-gray-400">Signals</p>
        </div>
        <div className="bg-surface rounded p-2 text-center">
          <p className="text-lg font-bold text-success">{agent.stats?.executedSignals || 0}</p>
          <p className="text-xs text-gray-400">Executed</p>
        </div>
        <div className="bg-surface rounded p-2 text-center">
          <p className="text-lg font-bold text-white">{agent.stats?.totalTrades || 0}</p>
          <p className="text-xs text-gray-400">Trades</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <button
          onClick={() => onRegenerateKey(agent.id)}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded bg-surface hover:bg-white/10 transition-colors text-sm text-gray-300"
        >
          <RefreshCw size={14} />
          Regenerate Key
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// Add Agent Modal
const AddAgentModal = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-white mb-4">Add External Agent</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., TradingView Bot"
              className="w-full bg-surface-light border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Momentum strategy signals"
              className="w-full bg-surface-light border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              After creating the agent, you'll receive a webhook URL and API key to use with your external trading bot.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
const ExternalAgentManager = () => {
  const { agents, addAgent, updateAgent, deleteAgent } = useAgentManagement();
  const [showAddModal, setShowAddModal] = useState(false);

  // Filter only webhook/external agents
  const externalAgents = agents.filter(a => a.type === 'webhook' || a.type === 'api');

  const handleAddAgent = async (agentData) => {
    const apiKey = generateApiKey();
    const newAgent = {
      ...agentData,
      type: 'webhook',
      apiKey,
      tradingEnabled: false, // Disabled by default for safety
      enabled: true,
      stats: {
        totalSignals: 0,
        executedSignals: 0,
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
      },
    };

    addAgent(newAgent);
  };

  const handleToggleTrading = (agentId, enabled) => {
    updateAgent(agentId, { tradingEnabled: enabled });
  };

  const handleRegenerateKey = (agentId) => {
    const newKey = generateApiKey();
    updateAgent(agentId, { apiKey: newKey });
  };

  const handleDeleteAgent = (agentId) => {
    if (window.confirm('Are you sure you want to delete this agent? This cannot be undone.')) {
      deleteAgent(agentId);
    }
  };

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Webhook className="text-accent" size={24} />
          <div>
            <h3 className="text-lg font-bold text-white">External Agents</h3>
            <p className="text-xs text-gray-400">
              Connect external bots to send trade signals
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors text-sm"
        >
          <Plus size={16} />
          Add Agent
        </button>
      </div>

      {/* Agent List */}
      {externalAgents.length === 0 ? (
        <div className="text-center py-8">
          <Webhook className="mx-auto text-gray-500 mb-3" size={48} />
          <p className="text-gray-400 mb-2">No external agents configured</p>
          <p className="text-xs text-gray-500 mb-4">
            Add an external agent to receive trade signals from TradingView, custom bots, or other sources.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-sm"
          >
            <Plus size={16} />
            Add Your First Agent
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {externalAgents.map(agent => (
            <ExternalAgentCard
              key={agent.id}
              agent={agent}
              onToggleTrading={handleToggleTrading}
              onRegenerateKey={handleRegenerateKey}
              onDelete={handleDeleteAgent}
            />
          ))}
        </div>
      )}

      {/* Integration Guide */}
      <div className="mt-6 pt-6 border-t border-white/5">
        <h4 className="text-sm font-medium text-white mb-3">How to Integrate</h4>
        <div className="bg-surface rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-3">Send a POST request to the webhook URL:</p>
          <pre className="bg-surface-light rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`POST /api/webhook/signal
Content-Type: application/json

{
  "apiKey": "your_api_key",
  "action": "BUY",
  "tokenAddress": "token_mint_address",
  "tokenSymbol": "BONK",
  "amount": 0.5,
  "amountType": "SOL"
}`}
          </pre>
        </div>
      </div>

      {/* Add Agent Modal */}
      <AddAgentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAgent}
      />
    </div>
  );
};

export default ExternalAgentManager;
