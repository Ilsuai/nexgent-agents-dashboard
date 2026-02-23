import React, { useState } from 'react';
import { useAgentManagement } from '../context/AgentManagementContext';
import SignalActivityLog from '../components/agents/SignalActivityLog';
import {
  Webhook,
  Plus,
  Power,
  PowerOff,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Settings,
  Zap
} from 'lucide-react';

/**
 * Signal Providers Page
 * Manage external bots that send trade signals via webhook
 * - Add/edit/delete signal providers
 * - Configure source URLs and toggle trading on/off
 * - Dashboard webhook URL for each provider
 */

// ============================================
// EXTERNAL SIGNAL PROVIDERS SECTION
// ============================================
const ExternalAgentCard = ({ agent, onToggle, onEdit, onDelete }) => {
  const [copied, setCopied] = useState(null);
  const webhookUrl = `${window.location.origin}/api/webhook/signal`;

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-surface-light rounded-xl p-5 border border-white/5">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            agent.tradingEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'
          }`}>
            <Webhook className={agent.tradingEnabled ? 'text-green-400' : 'text-gray-400'} size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">{agent.name}</h3>
            <p className="text-xs text-gray-400">
              {agent.stats?.totalSignals || 0} signals • {agent.stats?.executedSignals || 0} executed
            </p>
          </div>
        </div>

        {/* Main Trading Toggle */}
        <button
          onClick={() => onToggle(agent.id, !agent.tradingEnabled)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            agent.tradingEnabled
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {agent.tradingEnabled ? (
            <>
              <Power size={16} />
              LIVE
            </>
          ) : (
            <>
              <PowerOff size={16} />
              OFF
            </>
          )}
        </button>
      </div>

      {/* Source Webhook/API URL */}
      {agent.sourceUrl && (
        <div className="bg-surface rounded-lg p-3 mb-3">
          <label className="text-xs text-gray-400 mb-1 block">Source (signals come from):</label>
          <code className="text-sm text-purple-400 font-mono break-all">{agent.sourceUrl}</code>
        </div>
      )}

      {/* Webhook URL - Where to send signals */}
      <div className="bg-surface rounded-lg p-4 mb-4">
        <label className="text-xs text-gray-400 mb-2 block">Dashboard webhook (configure in your bot):</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-dark-900 rounded px-3 py-2 text-sm text-accent font-mono overflow-hidden text-ellipsis border border-accent/30">
            {webhookUrl}
          </code>
          <button
            onClick={() => handleCopy(webhookUrl, 'url')}
            className="p-2 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors"
          >
            {copied === 'url' ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} className="text-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      {agent.tradingEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm text-green-400">Listening for signals - trades will execute automatically</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-3 border-t border-white/5">
        <button
          onClick={() => onEdit(agent)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <Settings size={14} />
          Edit
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="text-gray-500 hover:text-red-400 transition-colors p-2"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const ExternalAgentModal = ({ isOpen, onClose, onSave, editAgent = null }) => {
  const [name, setName] = useState(editAgent?.name || '');
  const [sourceUrl, setSourceUrl] = useState(editAgent?.sourceUrl || '');
  const [description, setDescription] = useState(editAgent?.description || '');

  // Reset form when modal opens/closes or editAgent changes
  React.useEffect(() => {
    if (isOpen) {
      setName(editAgent?.name || '');
      setSourceUrl(editAgent?.sourceUrl || '');
      setDescription(editAgent?.description || '');
    }
  }, [isOpen, editAgent]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({
        id: editAgent?.id,
        name: name.trim(),
        sourceUrl: sourceUrl.trim() || null,
        description: description.trim() || null,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  const isEditing = !!editAgent;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-2">
          {isEditing ? 'Edit Signal Provider' : 'Add External Signal Provider'}
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          {isEditing
            ? 'Update the configuration for this signal provider.'
            : 'Connect an external trading bot that will send signals via webhook.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NexGent AI, TradingView Bot"
              className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Source Webhook/API URL
              <span className="text-gray-500 ml-1">(optional - for reference)</span>
            </label>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="e.g., https://nexgent.ai/webhook or API endpoint"
              className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              The URL where signals originate from (your bot's endpoint)
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Description
              <span className="text-gray-500 ml-1">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this provider..."
              rows={2}
              className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              {isEditing
                ? 'Changes will be saved immediately.'
                : 'After adding, configure your external bot to send POST requests to the dashboard webhook URL.'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-3 px-4 rounded-xl bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {isEditing ? 'Save Changes' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ============================================
// MAIN AGENTS PAGE (SIMPLIFIED)
// ============================================
const Agents = () => {
  const { agents, addAgent, updateAgent, deleteAgent } = useAgentManagement();
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);

  // Only show external/webhook agents - internal agents managed in Bot Setup
  const externalAgents = agents.filter(a => a.type === 'webhook' || a.type === 'api' || a.type === 'external');

  // Handle add/edit agent
  const handleSaveAgent = (data) => {
    if (data.id) {
      // Editing existing
      updateAgent(data.id, {
        name: data.name,
        sourceUrl: data.sourceUrl,
        description: data.description,
      });
    } else {
      // Adding new
      addAgent({
        ...data,
        type: 'webhook',
        tradingEnabled: false,
        enabled: true,
        stats: { totalSignals: 0, executedSignals: 0, totalTrades: 0 }
      });
    }
    setEditingAgent(null);
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleToggle = (agentId, enabled) => {
    updateAgent(agentId, { tradingEnabled: enabled });
  };

  const handleDeleteAgent = (agentId) => {
    if (window.confirm('Delete this signal provider? This cannot be undone.')) {
      deleteAgent(agentId);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Signal Providers</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Manage external bots that send trade signals to your dashboard
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent/80 transition-colors"
        >
          <Plus size={18} />
          Add Provider
        </button>
      </header>

      {/* Quick Setup Guide */}
      <div className="bg-surface rounded-xl p-4 border border-white/5">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          Quick Setup
        </h4>
        <ol className="text-sm text-gray-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">1.</span>
            <span>Add a provider (e.g., NexGent AI) with its source URL</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">2.</span>
            <span>Copy the <span className="text-accent">Dashboard Webhook URL</span> and paste it in your external bot's settings</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">3.</span>
            <span>Turn the provider <span className="text-green-400">LIVE</span> to start auto-executing trades</span>
          </li>
        </ol>
      </div>

      {/* Providers List */}
      {externalAgents.length === 0 ? (
        <div className="bg-surface-light rounded-xl p-8 text-center border border-dashed border-white/10">
          <Webhook className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-400 mb-2 text-lg">No signal providers configured</p>
          <p className="text-sm text-gray-500 mb-4">
            Add your first external signal provider to start receiving trade signals
          </p>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-white hover:bg-accent/80 transition-colors"
          >
            <Plus size={18} />
            Add Your First Provider
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {externalAgents.map(agent => (
            <ExternalAgentCard
              key={agent.id}
              agent={agent}
              onToggle={handleToggle}
              onEdit={handleEditAgent}
              onDelete={handleDeleteAgent}
            />
          ))}
        </div>
      )}

      {/* Signal Activity Log */}
      <SignalActivityLog />

      {/* Signal Format Reference */}
      <details className="bg-surface rounded-xl border border-white/5">
        <summary className="p-4 cursor-pointer text-white font-medium flex items-center gap-2">
          <ExternalLink size={16} className="text-accent" />
          Webhook Signal Format (click to expand)
        </summary>
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-400 mb-3">
            External bots should send POST requests with this JSON format:
          </p>
          <pre className="bg-dark-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto font-mono">
{`POST /api/webhook/signal
Content-Type: application/json

{
  "action": "BUY" or "SELL",
  "tokenAddress": "token_mint_address",
  "tokenSymbol": "BONK",
  "amount": 0.5
}`}
          </pre>
        </div>
      </details>

      {/* Modal for Add/Edit */}
      <ExternalAgentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAgent(null);
        }}
        onSave={handleSaveAgent}
        editAgent={editingAgent}
      />
    </div>
  );
};

export default Agents;
