/**
 * TradingDataContext - Firebase as Single Source of Truth
 * NO localStorage - All data synced to cloud
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  initAuth,
  getUserId,
  subscribeToTrades,
  saveTrade,
  saveTradesBatch,
  getTrades,
  deleteTrade,
  getDeletedTradeIds,
} from '../services/firebase';
import { normalizeTrade, normalizeTrades } from '../utils/normalizeTrade';
import {
  calculateAllAnalytics,
  generateEquityCurve,
  generateHourlyEquityCurve,
  calculateProfitDistribution,
  calculateTradesByHour,
  calculateMonthlyReturns
} from '../utils/tradingCalculations';
import { useSettings } from './SettingsContext';
import { useAgentManagement } from './AgentManagementContext';
import { useBotStatus } from './BotStatusContext';
import { agent } from '../services/agentConnector';
import { getConnectionPool } from '../services/AgentConnectionPool';

const TradingDataContext = createContext();

export const useTradingData = () => {
  const context = useContext(TradingDataContext);
  if (!context) {
    throw new Error('useTradingData must be used within TradingDataProvider');
  }
  return context;
};

export const TradingDataProvider = ({ children }) => {
  const { startingBalance } = useSettings();
  const { selectedAgentId, selectedAgent, demoAgents, refreshAgentStats } = useAgentManagement();
  const { botEnabled, webhookEnabled } = useBotStatus();
  const connectionPool = getConnectionPool();

  // State
  const [trades, setTrades] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [hourlyPerformanceData, setHourlyPerformanceData] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [profitDistribution, setProfitDistribution] = useState([]);
  const [tradesByHour, setTradesByHour] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // View mode
  const [tradeViewMode, setTradeViewMode] = useState('all-trades');
  const [activeAgentFilter, setActiveAgentFilter] = useState('all');

  // Refs for debouncing
  const analyticsDebounceRef = useRef(null);
  const [debouncedTrades, setDebouncedTrades] = useState([]);

  // ============ FIREBASE INITIALIZATION ============

  useEffect(() => {
    const initFirebase = async () => {
      try {
        setIsLoading(true);
        await initAuth();
        setIsAuthenticated(true);
        console.log('✅ Firebase authenticated');
      } catch (error) {
        console.error('❌ Firebase auth failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    initFirebase();
  }, []);

  // ============ FETCH TRADES FROM API ============

  const fetchTradesFromAPI = async () => {
    try {
      console.log('📡 Fetching trades from API...');
      const response = await fetch('/api/trades/list?limit=100');
      if (!response.ok) throw new Error('Failed to fetch trades');

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API error');

      console.log(`📥 API: ${data.trades.length} trades received`);

      // Normalize all trades
      const normalized = data.trades.map(t => {
        const trade = normalizeTrade(t, t.agentId);
        // Add display fields
        const tradeDate = new Date(trade.timestamp);
        return {
          ...trade,
          time: tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          date: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hour: tradeDate.getHours(),
        };
      });

      setTrades(normalized);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('❌ Failed to fetch trades:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch (always, to show historical data)
    fetchTradesFromAPI();

    // Only poll when bot is enabled AND tab is visible
    // When bot is OFF, no new trades are coming so no need to poll
    if (!botEnabled) {
      console.log('🛑 Bot disabled - polling stopped to save resources');
      return;
    }

    let interval = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(fetchTradesFromAPI, 30000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchTradesFromAPI();
        startPolling();
      }
    };

    // Start polling if tab is visible
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, botEnabled]);

  // ============ SYNC WITH PYTHON AGENT ============

  // Cache deleted trade IDs to avoid re-fetching
  const deletedIdsRef = useRef(new Set());
  const [deletedIdsLoaded, setDeletedIdsLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Load deleted IDs once on auth
    const loadDeletedIds = async () => {
      deletedIdsRef.current = await getDeletedTradeIds();
      console.log(`🚫 Loaded ${deletedIdsRef.current.size} deleted trade IDs`);
      setDeletedIdsLoaded(true);
    };
    loadDeletedIds();
  }, [isAuthenticated]);

  // ============ RAILWAY AGENT SYNC (DISABLED) ============
  // This was syncing with the internal Railway Python agent
  // Now using webhook-based signals from NexGent AI instead
  /*
  useEffect(() => {
    if (!isAuthenticated || !deletedIdsLoaded) return;
    // ... Railway sync code disabled ...
  }, [isAuthenticated, deletedIdsLoaded, selectedAgent, trades]);
  */

  // ============ WEBSOCKET SUBSCRIPTIONS ============

  useEffect(() => {
    if (!connectionPool || !isAuthenticated) return;

    const handleTrade = async (tradeData) => {
      console.log('📊 WS Trade received:', tradeData);

      // Normalize trade - use default_agent if no agentId to match dashboard agent
      const normalized = normalizeTrade(tradeData, tradeData.agentId || 'default_agent');
      if (!normalized) return;

      // Skip if this trade was previously deleted
      if (deletedIdsRef.current.has(normalized.id)) {
        console.log(`🚫 Skipping WS trade (was deleted): ${normalized.id}`);
        return;
      }

      // Add display fields
      const tradeDate = new Date(normalized.timestamp);
      const formattedTrade = {
        ...normalized,
        time: tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hour: tradeDate.getHours(),
      };

      // Save to Firebase (will trigger real-time update)
      try {
        await saveTrade(formattedTrade);
      } catch (error) {
        console.error('Failed to save trade to Firebase:', error);
        // Still update local state as fallback
        setTrades(prev => {
          const existingIndex = prev.findIndex(t => t.id === formattedTrade.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...formattedTrade };
            return updated;
          }
          return [formattedTrade, ...prev];
        });
      }

      // Refresh agent stats
      if (refreshAgentStats && formattedTrade.agentId) {
        refreshAgentStats(formattedTrade.agentId, trades);
      }
    };

    const handleSignal = (data) => {
      console.log('📡 Signal received:', data);
    };

    const handleStatus = (data) => {
      console.log('📊 Status received:', data);
    };

    const handleBalance = (data) => {
      console.log('💰 Balance received:', data);
    };

    connectionPool.on('trade', handleTrade);
    connectionPool.on('signal', handleSignal);
    connectionPool.on('agentStatus', handleStatus);
    connectionPool.on('balance', handleBalance);

    return () => {
      connectionPool.off('trade', handleTrade);
      connectionPool.off('signal', handleSignal);
      connectionPool.off('agentStatus', handleStatus);
      connectionPool.off('balance', handleBalance);
    };
  }, [connectionPool, isAuthenticated, refreshAgentStats, trades]);

  // ============ DEMO AGENTS SUBSCRIPTION ============

  useEffect(() => {
    if (!demoAgents || !isAuthenticated) return;

    const unsubscribeFunctions = [];

    demoAgents.forEach((demoAgent, agentId) => {
      const handleDemoTrade = async (tradeData) => {
        console.log('📊 Demo trade:', tradeData);

        const normalized = normalizeTrade(tradeData, agentId);
        if (!normalized) return;

        const tradeDate = new Date(normalized.timestamp);
        const formattedTrade = {
          ...normalized,
          time: tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          date: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hour: tradeDate.getHours(),
        };

        // Save to Firebase
        try {
          await saveTrade(formattedTrade);
        } catch (error) {
          console.error('Failed to save demo trade:', error);
        }
      };

      const unsubscribe = demoAgent.on('trade', handleDemoTrade);
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribeFunctions.push(unsubscribe);
      }
    });

    return () => {
      unsubscribeFunctions.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [demoAgents, isAuthenticated]);

  // ============ ANALYTICS CALCULATION (DEBOUNCED) ============

  useEffect(() => {
    if (analyticsDebounceRef.current) {
      clearTimeout(analyticsDebounceRef.current);
    }
    analyticsDebounceRef.current = setTimeout(() => {
      setDebouncedTrades(trades);
    }, 300);
    return () => {
      if (analyticsDebounceRef.current) {
        clearTimeout(analyticsDebounceRef.current);
      }
    };
  }, [trades]);

  useEffect(() => {
    if (debouncedTrades.length > 0) {
      const newAnalytics = calculateAllAnalytics(debouncedTrades, startingBalance);
      const newPerformanceData = generateEquityCurve(debouncedTrades, 90, startingBalance);
      const newHourlyData = generateHourlyEquityCurve(debouncedTrades, startingBalance);
      const newProfitDist = calculateProfitDistribution(debouncedTrades);
      const newTradesByHour = calculateTradesByHour(debouncedTrades);
      const newMonthlyReturns = calculateMonthlyReturns(debouncedTrades);

      setAnalytics(newAnalytics);
      setPerformanceData(newPerformanceData);
      setHourlyPerformanceData(newHourlyData);
      setProfitDistribution(newProfitDist);
      setTradesByHour(newTradesByHour);
      setMonthlyReturns(newMonthlyReturns);
    }
  }, [debouncedTrades, startingBalance]);

  // ============ FILTERING ============

  const getTradesByAgent = useCallback((agentId) => {
    return trades.filter(t => t.agentId === agentId);
  }, [trades]);

  const getActiveAgentTrades = useCallback(() => {
    if (!selectedAgentId) return [];
    return trades.filter(t => t.agentId === selectedAgentId);
  }, [trades, selectedAgentId]);

  const getFilteredTrades = useCallback(() => {
    if (tradeViewMode === 'active-agent') {
      return getActiveAgentTrades();
    } else if (tradeViewMode === 'all-trades') {
      if (activeAgentFilter && activeAgentFilter !== 'all') {
        return getTradesByAgent(activeAgentFilter);
      }
      return trades;
    }
    return trades;
  }, [tradeViewMode, activeAgentFilter, trades, getActiveAgentTrades, getTradesByAgent]);

  // ============ CRUD OPERATIONS ============

  const addTrade = useCallback(async (trade) => {
    const normalized = normalizeTrade(trade, trade.agentId || selectedAgentId);
    await saveTrade(normalized);
    return normalized;
  }, [selectedAgentId]);

  const updateTrade = useCallback(async (tradeId, updates) => {
    const existing = trades.find(t => t.id === tradeId);
    if (existing) {
      const updated = { ...existing, ...updates };
      await saveTrade(updated);
      return updated;
    }
  }, [trades]);

  const removeTrade = useCallback(async (tradeId) => {
    await deleteTrade(tradeId);
    // Update local cache of deleted IDs
    deletedIdsRef.current.add(tradeId);
  }, []);

  const removeTrades = useCallback(async (tradeIds) => {
    // Delete multiple trades from Firebase
    for (const tradeId of tradeIds) {
      await deleteTrade(tradeId);
      // Update local cache of deleted IDs
      deletedIdsRef.current.add(tradeId);
    }
    console.log(`🗑️ Deleted ${tradeIds.length} trades from Firebase`);
  }, []);

  const importTrades = useCallback(async (newTrades) => {
    const normalized = normalizeTrades(newTrades);
    await saveTradesBatch(normalized);
    console.log(`📥 Imported ${normalized.length} trades to Firebase`);
    return normalized;
  }, []);

  const clearAllTrades = useCallback(async () => {
    // Delete each trade from Firebase
    for (const trade of trades) {
      await deleteTrade(trade.id);
    }
    console.log('🗑️ All trades cleared from Firebase');
  }, [trades]);

  // ============ CONTEXT VALUE ============

  const value = {
    // State
    trades,
    performanceData,
    hourlyPerformanceData,
    analytics,
    profitDistribution,
    tradesByHour,
    monthlyReturns,
    isLoading,
    isAuthenticated,
    lastSyncTime,

    // View mode
    tradeViewMode,
    setTradeViewMode,
    activeAgentFilter,
    setActiveAgentFilter,

    // Filtering
    getTradesByAgent,
    getActiveAgentTrades,
    getFilteredTrades,

    // CRUD
    addTrade,
    updateTrade,
    removeTrade,
    deleteTrade: removeTrade,   // Alias for UnifiedDashboard
    deleteTrades: removeTrades, // Bulk delete for UnifiedDashboard
    importTrades,
    clearAllTrades,
    clearData: clearAllTrades,  // Alias for Settings page
  };

  return (
    <TradingDataContext.Provider value={value}>
      {children}
    </TradingDataContext.Provider>
  );
};

export default TradingDataContext;
