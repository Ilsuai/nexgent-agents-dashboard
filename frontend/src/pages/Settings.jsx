import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTradingData } from '../context/TradingDataContext';
import { useAgentManagement } from '../context/AgentManagementContext';
import { Save, RotateCcw, AlertCircle, Check, Trash2, Bell, RefreshCw, Users } from 'lucide-react';
import Modal from '../components/common/Modal';

const Settings = () => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { clearData, tradeViewMode, setTradeViewMode } = useTradingData();
  const { agents } = useAgentManagement();
  const [formData, setFormData] = useState(settings);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);

  // Multi-agent preferences
  const [multiAgentPrefs, setMultiAgentPrefs] = useState({
    defaultViewMode: localStorage.getItem('defaultTradeViewMode') || 'active-agent',
    enableNotifications: localStorage.getItem('enableTradeNotifications') !== 'false',
    autoReconnect: localStorage.getItem('autoReconnect') !== 'false',
    defaultAgentId: localStorage.getItem('defaultAgentId') || '',
  });

  const handleSave = () => {
    updateSettings(formData);

    // Save multi-agent preferences to localStorage
    localStorage.setItem('defaultTradeViewMode', multiAgentPrefs.defaultViewMode);
    localStorage.setItem('enableTradeNotifications', multiAgentPrefs.enableNotifications);
    localStorage.setItem('autoReconnect', multiAgentPrefs.autoReconnect);
    localStorage.setItem('defaultAgentId', multiAgentPrefs.defaultAgentId);

    // Apply default view mode
    setTradeViewMode(multiAgentPrefs.defaultViewMode);

    setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleMultiAgentPrefChange = (field, value) => {
    setMultiAgentPrefs({ ...multiAgentPrefs, [field]: value });
  };

  const handleReset = () => {
    resetSettings();
    setFormData(resetSettings);
    setShowResetModal(false);
    setSaveStatus({ type: 'success', message: 'Settings reset to defaults!' });
    setTimeout(() => setSaveStatus(null), 3000);
    // Reload page to apply default settings
    window.location.reload();
  };

  const handleClearData = () => {
    clearData();
    setShowClearDataModal(false);
    setSaveStatus({ type: 'success', message: 'All trade data cleared!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header>
        <h2 className="text-3xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 mt-1 text-sm">Configure your dashboard preferences and display options</p>
      </header>

      {/* Status Message */}
      {saveStatus && (
        <div className={`glass-card p-4 border-l-4 ${
          saveStatus.type === 'success' ? 'border-success bg-success/5' : 'border-danger bg-danger/5'
        }`}>
          <div className="flex items-center gap-3">
            {saveStatus.type === 'success' ? (
              <Check className="text-success" size={20} />
            ) : (
              <AlertCircle className="text-danger" size={20} />
            )}
            <p className="text-white text-sm">{saveStatus.message}</p>
          </div>
        </div>
      )}

      {/* Display Settings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Date Format</label>
              <select
                value={formData.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="US">US Format (MM/DD/YYYY)</option>
                <option value="EU">EU Format (DD/MM/YYYY)</option>
                <option value="ISO">ISO Format (YYYY-MM-DD)</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Time Format</label>
              <select
                value={formData.timeFormat}
                onChange={(e) => handleChange('timeFormat', e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => {
                  const currency = e.target.value;
                  const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$' };
                  handleChange('currency', currency);
                  handleChange('currencySymbol', symbols[currency]);
                }}
                className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
              <div>
                <p className="text-white text-sm font-medium">Show Cents</p>
                <p className="text-gray-500 text-xs">Display currency values with decimal places</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showCents}
                  onChange={(e) => handleChange('showCents', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
              <div>
                <p className="text-white text-sm font-medium">Compact Mode</p>
                <p className="text-gray-500 text-xs">Use compact tables and reduced spacing</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.compactMode}
                  onChange={(e) => handleChange('compactMode', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Settings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Trading Settings</h3>
        <div className="space-y-4">
          {/* Starting Balance */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Starting Balance (USD)
              <span className="text-gray-500 ml-2 text-xs">(For dashboard simulator only - virtual money)</span>
            </label>
            <input
              type="number"
              value={formData.startingBalance}
              onChange={(e) => handleChange('startingBalance', parseFloat(e.target.value) || 0)}
              min="0"
              step="100"
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-accent"
              placeholder="Enter starting balance..."
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 This only affects the dashboard's built-in simulator. For Railway agent, change PAPER_BALANCE_SOL in Railway settings.
            </p>
          </div>

          {/* Risk Free Rate */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Risk-Free Rate (%)
              <span className="text-gray-500 ml-2 text-xs">(Used for Sharpe ratio calculation)</span>
            </label>
            <input
              type="number"
              value={formData.riskFreeRate}
              onChange={(e) => handleChange('riskFreeRate', parseFloat(e.target.value) || 0)}
              min="0"
              max="20"
              step="0.1"
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-accent"
              placeholder="Enter risk-free rate..."
            />
          </div>
        </div>
      </div>

      {/* Multi-Agent Preferences */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="text-accent" size={20} />
          <h3 className="text-lg font-bold text-white">Multi-Agent Preferences</h3>
        </div>
        <div className="space-y-4">
          {/* Default View Mode */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Default Trade View Mode
              <span className="text-gray-500 ml-2 text-xs">(How trades are displayed by default)</span>
            </label>
            <select
              value={multiAgentPrefs.defaultViewMode}
              onChange={(e) => handleMultiAgentPrefChange('defaultViewMode', e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="active-agent">Active Agent Only</option>
              <option value="all-trades">All Trades (with filters)</option>
              <option value="per-agent-tabs">Per-Agent Tabs</option>
            </select>
          </div>

          {/* Default Agent */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Default Agent
              <span className="text-gray-500 ml-2 text-xs">(Agent to show when opening dashboard)</span>
            </label>
            <select
              value={multiAgentPrefs.defaultAgentId}
              onChange={(e) => handleMultiAgentPrefChange('defaultAgentId', e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="">Most Recent Agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.type})
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
              <div className="flex items-center gap-3">
                <Bell className="text-blue-400" size={18} />
                <div>
                  <p className="text-white text-sm font-medium">Trade Notifications</p>
                  <p className="text-gray-500 text-xs">Show toast notifications for new trades</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiAgentPrefs.enableNotifications}
                  onChange={(e) => handleMultiAgentPrefChange('enableNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
              <div className="flex items-center gap-3">
                <RefreshCw className="text-green-400" size={18} />
                <div>
                  <p className="text-white text-sm font-medium">Auto-Reconnect</p>
                  <p className="text-gray-500 text-xs">Automatically reconnect agents on disconnect</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiAgentPrefs.autoReconnect}
                  onChange={(e) => handleMultiAgentPrefChange('autoReconnect', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Data Management</h3>
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-500 mt-0.5" size={20} />
              <div>
                <p className="text-white font-medium text-sm mb-1">Clear All Trade Data</p>
                <p className="text-gray-400 text-xs mb-3">
                  This will permanently delete all your imported trades and reset to mock data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShowClearDataModal(true)}
                  className="flex items-center gap-2 text-xs bg-danger hover:bg-danger/80 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All Data
                </button>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="text-gray-400 mt-0.5" size={20} />
              <div>
                <p className="text-white font-medium text-sm mb-1">Reset Settings</p>
                <p className="text-gray-400 text-xs mb-3">
                  Reset all settings to their default values. Your trade data will not be affected.
                </p>
                <button
                  onClick={() => setShowResetModal(true)}
                  className="text-xs bg-dark-800 hover:bg-dark-700 text-white px-4 py-2 rounded-lg transition-colors border border-dark-700"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          <Save size={18} />
          Save Settings
        </button>
      </div>

      {/* Reset Settings Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Settings"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to reset all settings to their default values?
          </p>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-sm text-gray-400 mb-2">Default values:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Date Format: US</li>
              <li>• Time Format: 12-hour</li>
              <li>• Currency: USD</li>
              <li>• Show Cents: Enabled</li>
              <li>• Compact Mode: Disabled</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowResetModal(false)}
              className="px-4 py-2 bg-dark-900 border border-dark-700 text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
            >
              Reset Settings
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear Data Modal */}
      <Modal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        title="⚠️ Clear All Data"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to <span className="text-danger font-bold">permanently delete</span> all your trade data?
          </p>
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
            <p className="text-sm text-danger">
              This will delete all imported trades and reset the dashboard to mock data. This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClearDataModal(false)}
              className="px-4 py-2 bg-dark-900 border border-dark-700 text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearData}
              className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors"
            >
              Clear All Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
