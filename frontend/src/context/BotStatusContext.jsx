/**
 * BotStatusContext - Shared bot enabled/disabled state
 * When bot is disabled, all polling stops to prevent unnecessary API usage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const BotStatusContext = createContext();

export const useBotStatus = () => {
  const context = useContext(BotStatusContext);
  if (!context) {
    throw new Error('useBotStatus must be used within BotStatusProvider');
  }
  return context;
};

export const BotStatusProvider = ({ children }) => {
  const [botEnabled, setBotEnabled] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch bot status from API
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/bot/status`);
      const data = await response.json();

      if (data.success) {
        setBotEnabled(data.botEnabled);
        setWebhookEnabled(data.webhookEnabled);
        setLastUpdated(data.lastUpdated);
      }
    } catch (err) {
      console.error('Bot status fetch error:', err);
      // Default to enabled on error (fail-open)
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();

    // Refresh status every 60 seconds (minimal polling)
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Update bot status
  const updateStatus = async (updates) => {
    try {
      const response = await fetch(`${API_BASE}/api/bot/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setBotEnabled(data.botEnabled);
        setWebhookEnabled(data.webhookEnabled);
        setLastUpdated(data.lastUpdated);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Bot status update error:', err);
      return false;
    }
  };

  const toggleBot = async () => {
    const newValue = !botEnabled;
    setBotEnabled(newValue); // Optimistic update
    const success = await updateStatus({ enabled: newValue });
    if (!success) {
      setBotEnabled(!newValue); // Revert on failure
    }
  };

  const toggleWebhook = async () => {
    const newValue = !webhookEnabled;
    setWebhookEnabled(newValue); // Optimistic update
    const success = await updateStatus({ webhookEnabled: newValue });
    if (!success) {
      setWebhookEnabled(!newValue); // Revert on failure
    }
  };

  // Derived state: is anything active?
  const isActive = botEnabled && webhookEnabled;

  const value = {
    botEnabled,
    webhookEnabled,
    isActive,
    loading,
    lastUpdated,
    toggleBot,
    toggleWebhook,
    refreshStatus: fetchStatus,
  };

  return (
    <BotStatusContext.Provider value={value}>
      {children}
    </BotStatusContext.Provider>
  );
};

export default BotStatusContext;
