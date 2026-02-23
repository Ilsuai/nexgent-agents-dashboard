import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  startingBalance: 700,
  botName: 'My Trading Bot', // Bot name for display and sharing
  signalProvider: 'nexgent.ai', // Signal provider name
  currency: 'USD',
  currencySymbol: '$',
  dateFormat: 'US', // 'US' or 'EU'
  timeFormat: '12h', // '12h' or '24h'
  riskFreeRate: 4, // Percentage for Sharpe ratio calculation
  theme: 'dark', // 'dark' or 'light' (for future use)
  compactMode: false, // Compact table view
  showCents: true, // Show cents in currency displays
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('tradingBotSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  // Save to localStorage when changed
  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('tradingBotSettings', JSON.stringify(updated));
  };

  const updateStartingBalance = (newBalance) => {
    updateSettings({ startingBalance: parseFloat(newBalance) });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('tradingBotSettings', JSON.stringify(DEFAULT_SETTINGS));
  };

  const value = {
    // Maintain backward compatibility
    startingBalance: settings.startingBalance,
    updateStartingBalance,
    // New settings API
    settings,
    updateSettings,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
