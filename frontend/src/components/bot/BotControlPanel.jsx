import React, { useState } from 'react';
import { Power, Webhook, RefreshCw, AlertCircle, CheckCircle, XCircle, ZapOff } from 'lucide-react';
import { useBotStatus } from '../../context/BotStatusContext';

/**
 * Bot Control Panel - Master on/off switch for trading bot
 * Uses shared BotStatusContext so all components stay in sync
 * When disabled:
 * - Incoming signals are acknowledged but not executed
 * - Dashboard stops polling to save API calls and resources
 */
const BotControlPanel = () => {
  const {
    botEnabled,
    webhookEnabled,
    loading,
    lastUpdated,
    toggleBot,
    toggleWebhook,
    refreshStatus,
  } = useBotStatus();

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const handleToggleBot = async () => {
    setUpdating(true);
    setError(null);
    try {
      await toggleBot();
    } catch (err) {
      setError('Failed to update bot status');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleWebhook = async () => {
    setUpdating(true);
    setError(null);
    try {
      await toggleWebhook();
    } catch (err) {
      setError('Failed to update webhook status');
    } finally {
      setUpdating(false);
    }
  };

  const handleRefresh = async () => {
    setUpdating(true);
    await refreshStatus();
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-accent" size={24} />
          <span className="ml-2 text-gray-400">Loading bot status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Power className={botEnabled ? 'text-green-400' : 'text-red-400'} size={20} />
          Bot Control
        </h3>
        <button
          onClick={handleRefresh}
          disabled={updating}
          className="p-2 text-gray-400 hover:text-white bg-dark-900 rounded-lg transition-colors"
          title="Refresh status"
        >
          <RefreshCw size={16} className={updating ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Master Bot Switch */}
        <div
          className={`p-4 rounded-xl border-2 transition-all ${
            botEnabled
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {botEnabled ? (
                <CheckCircle className="text-green-400" size={24} />
              ) : (
                <XCircle className="text-red-400" size={24} />
              )}
              <div>
                <p className="text-white font-semibold">Trading Bot</p>
                <p className="text-sm text-gray-400">
                  {botEnabled ? 'Bot is active and will execute trades' : 'Bot is paused - no trades will execute'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleBot}
              disabled={updating}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                botEnabled ? 'bg-green-500' : 'bg-red-500'
              } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  botEnabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Webhook Switch */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            webhookEnabled && botEnabled
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-dark-900 border-dark-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Webhook
                className={webhookEnabled && botEnabled ? 'text-blue-400' : 'text-gray-500'}
                size={24}
              />
              <div>
                <p className={`font-semibold ${webhookEnabled && botEnabled ? 'text-white' : 'text-gray-400'}`}>
                  Webhook Signals (NexGent)
                </p>
                <p className="text-sm text-gray-400">
                  {!botEnabled
                    ? 'Disabled because bot is off'
                    : webhookEnabled
                    ? 'Receiving external signals'
                    : 'External signals paused'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleWebhook}
              disabled={updating || !botEnabled}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                webhookEnabled && botEnabled ? 'bg-blue-500' : 'bg-dark-600'
              } ${updating || !botEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  webhookEnabled && botEnabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Status Info */}
        <div className="pt-4 border-t border-dark-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <span className={`font-semibold ${botEnabled ? 'text-green-400' : 'text-red-400'}`}>
              {botEnabled ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          {lastUpdated && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-400">Last updated</span>
              <span className="text-gray-300">
                {new Date(lastUpdated).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Warning when disabled */}
        {!botEnabled && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <ZapOff className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-yellow-400">
                <p className="font-semibold">Bot is paused - Resource Saver Mode</p>
                <ul className="mt-1 text-yellow-400/80 list-disc list-inside space-y-0.5">
                  <li>Incoming signals acknowledged but not executed</li>
                  <li>Dashboard polling stopped to save API calls</li>
                  <li>No Firebase reads or third-party API usage</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotControlPanel;
