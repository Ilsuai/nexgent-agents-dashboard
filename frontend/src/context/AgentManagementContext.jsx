import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getConnectionPool } from '../services/AgentConnectionPool';
import MarketDataSimulator from '../services/MarketDataSimulator';
import { AGENT_MODES } from '../constants/trading';
import { saveAgents as saveAgentsToFirebase, getAgents as getAgentsFromFirebase, subscribeToAgents } from '../services/firebase';

const AgentManagementContext = createContext();

export const useAgentManagement = () => {
  const context = useContext(AgentManagementContext);
  if (!context) {
    throw new Error('useAgentManagement must be used within AgentManagementProvider');
  }
  return context;
};

export const AgentManagementProvider = ({ children }) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Connection pool instance (singleton)
  const connectionPoolRef = useRef(null);
  // Map of demo agents for simulation
  const demoAgentsRef = useRef(new Map());

  useEffect(() => {
    // Initialize connection pool
    connectionPoolRef.current = getConnectionPool();

    loadAgents();

    // Cleanup on unmount
    return () => {
      if (connectionPoolRef.current) {
        connectionPoolRef.current.disconnectAll();
      }
      // Stop all demo agents
      demoAgentsRef.current.forEach(demoAgent => {
        demoAgent.stop();
      });
    };
  }, []);

  const loadAgents = async () => {
    setIsLoading(true);

    // Try to load from Firebase API first (persisted across devices/sessions)
    try {
      const response = await fetch('/api/agents/list');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.agents && data.agents.length > 0) {
          console.log('✅ Loaded agents from Firebase:', data.agents.length);
          setAgents(data.agents);
          if (data.agents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(data.agents[0].id);
          }
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      console.log('Firebase agents not available, falling back to localStorage');
    }

    // Fallback: Load agents from localStorage
    const savedAgents = localStorage.getItem('tradingAgents');

    if (savedAgents) {
      try {
        const parsedAgents = JSON.parse(savedAgents);

        // Default trading config (USER CONFIGURABLE via Bot Setup UI)
        const defaultTradingConfig = {
          scanInterval: 1,
          maxTokensPerScan: 50,
          positionSizeUsd: 25,       // Default 25 (user can change to match Railway's 200)
          maxPositions: 3,           // Default 3 (user can change to match Railway's 10)
          takeProfitPct: 15,         // Default 15% (user can change to match Railway's 10%)
          stopLossPct: 8,            // Default 8% (user can change to match Railway's 15%)
          minRiskScore: 70,          // Default 70 (user can adjust 0-100 via slider)
          minQualityScore: 70,       // Default 70 (user can adjust 0-100 via slider)
          minMarketCap: 50000,       // Default 50K (user can change to match Railway's 100K)
          maxMarketCap: 1000000000,
          minLiquidity: 10000,
          autoTrading: false,        // Default off (user can enable)
          paperTrading: true
        };

        // MIGRATION: Convert all old 'demo' agents to 'live' Railway agents
        // This ensures users get real data from Railway, not fake simulation
        const fixedAgents = parsedAgents.map(agent => {
          let fixed = { ...agent };

          // Convert demo agents to live Railway agents
          if (agent.type === 'demo' || agent.type === 'simulated' || !['live', 'api', 'webhook'].includes(agent.type)) {
            console.log(`🔄 MIGRATING agent '${agent.name}' from '${agent.type}' to 'live' (Railway agent)`);
            fixed.type = 'live';
            fixed.name = agent.name === 'Main Trading Bot' ? 'Railway Trading Agent' : agent.name;
            fixed.description = 'Production trading agent with real-time data from Birdeye, Jupiter, and DexScreener';
            fixed.apiEndpoint = agent.apiEndpoint || 'https://solana-trading-agent-production.up.railway.app/api/v1';
            // Preserve existing config if present, otherwise use defaults
            fixed.tradingConfig = agent.tradingConfig || defaultTradingConfig;
            console.log(`   ✅ Migrated to live agent - config is user-adjustable in Bot Setup`);
          }

          // Add tradingConfig if missing (migration)
          if (!agent.tradingConfig) {
            console.log(`⚙️ Adding default tradingConfig to agent '${agent.name}' (user can adjust in Bot Setup)`);
            fixed.tradingConfig = defaultTradingConfig;
          }

          return fixed;
        });

        setAgents(fixedAgents);
        saveAgents(fixedAgents); // Save fixed agents back

        if (fixedAgents.length > 0 && !selectedAgentId) {
          setSelectedAgentId(fixedAgents[0].id);
        }
      } catch (error) {
        console.error('Error loading agents:', error);
        createDefaultAgent();
      }
    } else {
      createDefaultAgent();
    }

    setIsLoading(false);
  };

  const createDefaultAgent = () => {
    const defaultAgent = {
      id: 'default_agent',
      name: 'Railway Trading Agent',
      description: 'Production trading agent with real-time data from Birdeye, Jupiter, and DexScreener',
      type: 'live', // CHANGED: Use live Railway agent, not demo simulation
      apiEndpoint: import.meta.env.VITE_AGENT_API_URL || 'https://solana-trading-agent-production.up.railway.app/api/v1',
      webhookUrl: null,
      apiKey: null,
      enabled: true, // Can disable without deleting
      mode: AGENT_MODES.LIVE, // NEW: mode property for per-agent mode system
      status: 'inactive', // 'active' | 'inactive' | 'error' | 'connecting'
      connectionStatus: 'disconnected', // 'connected' | 'disconnected' | 'error'
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      stats: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
      },
      tradingConfig: {
        scanInterval: 1,
        maxTokensPerScan: 50,
        positionSizeUsd: 25,  // USER CONFIGURABLE via Bot Setup (default 25, Railway default is 200)
        maxPositions: 3,      // USER CONFIGURABLE via Bot Setup (default 3, Railway default is 10)
        takeProfitPct: 15,    // USER CONFIGURABLE via Bot Setup (default 15%, Railway default is 10%)
        stopLossPct: 8,       // USER CONFIGURABLE via Bot Setup (default 8%, Railway default is 15%)
        minRiskScore: 70,     // USER CONFIGURABLE via slider in Bot Setup (0-100)
        minQualityScore: 70,  // USER CONFIGURABLE via slider in Bot Setup (0-100)
        minMarketCap: 50000,  // USER CONFIGURABLE via Bot Setup
        maxMarketCap: 1000000000,
        minLiquidity: 10000,
        autoTrading: false,   // USER CONFIGURABLE via Bot Setup (default off for safety)
        paperTrading: true
      }
    };

    setAgents([defaultAgent]);
    setSelectedAgentId(defaultAgent.id);
    saveAgents([defaultAgent]);
  };

  const addAgent = async (agentData) => {
    // Generate API key hash if API key is provided (for webhook agents)
    let apiKeyHash = null;
    if (agentData.apiKey) {
      const encoder = new TextEncoder();
      const data = encoder.encode(agentData.apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const newAgent = {
      id: `agent_${Date.now()}`,
      name: agentData.name || 'New Agent',
      description: agentData.description || '',
      type: agentData.type || 'demo',
      apiEndpoint: agentData.apiEndpoint || null,
      webhookUrl: agentData.webhookUrl || null,
      apiKey: agentData.apiKey || null,
      apiKeyHash: apiKeyHash, // Hashed API key for webhook validation
      enabled: agentData.enabled !== undefined ? agentData.enabled : false,
      tradingEnabled: agentData.tradingEnabled !== undefined ? agentData.tradingEnabled : false, // Per-agent trading toggle
      mode: agentData.mode || AGENT_MODES.LIVE,
      status: 'inactive',
      connectionStatus: 'disconnected',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      stats: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
        totalSignals: 0,      // NEW: Track received signals
        executedSignals: 0,   // NEW: Track executed signals
      },
      tradingConfig: agentData.tradingConfig || {
        scanInterval: 1,
        maxTokensPerScan: 50,
        positionSizeUsd: 25,
        maxPositions: 3,
        takeProfitPct: 15,
        stopLossPct: 8,
        minRiskScore: 70,
        minQualityScore: 70,
        minMarketCap: 50000,
        maxMarketCap: 1000000000,
        minLiquidity: 10000,
        autoTrading: false,
        paperTrading: true
      }
    };

    const updatedAgents = [...agents, newAgent];
    setAgents(updatedAgents);
    saveAgents(updatedAgents);

    return newAgent;
  };

  const updateAgent = (agentId, updates) => {
    console.log(`📝 updateAgent called for ${agentId}:`, updates);

    setAgents(prevAgents => {
      const updatedAgents = prevAgents.map(agent =>
        agent.id === agentId
          ? { ...agent, ...updates, lastActivity: new Date().toISOString() }
          : agent
      );

      const updatedAgent = updatedAgents.find(a => a.id === agentId);
      if (updatedAgent) {
        console.log(`   New state:`, {
          enabled: updatedAgent.enabled,
          status: updatedAgent.status,
          connectionStatus: updatedAgent.connectionStatus
        });
      }

      // Save to localStorage
      saveAgents(updatedAgents);

      return updatedAgents;
    });
  };

  const deleteAgent = (agentId) => {
    const updatedAgents = agents.filter(agent => agent.id !== agentId);
    setAgents(updatedAgents);
    saveAgents(updatedAgents);

    // If deleted agent was selected, select first available
    if (selectedAgentId === agentId && updatedAgents.length > 0) {
      setSelectedAgentId(updatedAgents[0].id);
    }
  };

  const selectAgent = (agentId) => {
    setSelectedAgentId(agentId);
    localStorage.setItem('selectedAgentId', agentId);
  };

  const saveAgents = async (agentsToSave) => {
    // Save to localStorage for backward compatibility
    localStorage.setItem('tradingAgents', JSON.stringify(agentsToSave));

    // Save to Firebase via API (persists across sessions/devices)
    try {
      const response = await fetch('/api/agents/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: agentsToSave }),
      });
      if (response.ok) {
        console.log('✅ Agents saved to Firebase');
      }
    } catch (e) {
      console.warn('Failed to save agents to Firebase API:', e.message);
    }

    // Also try old Firebase method as fallback
    saveAgentsToFirebase(agentsToSave).catch(err => {
      console.warn('Failed to save agents to Firebase (legacy):', err.message);
    });
  };

  const getSelectedAgent = () => {
    return agents.find(agent => agent.id === selectedAgentId) || null;
  };

  // Webhook handler - processes incoming trade signals
  const processWebhookSignal = (agentId, signalData) => {
    console.log('Processing webhook signal for agent:', agentId, signalData);

    // Update agent last activity
    updateAgent(agentId, {
      lastActivity: new Date().toISOString()
    });

    // Signal should be processed by TradingDataContext to add trades
    return {
      success: true,
      agentId,
      timestamp: new Date().toISOString()
    };
  };

  // API polling handler - fetches trades from external API
  const fetchFromAPI = async (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !agent.apiEndpoint) {
      throw new Error('Agent not found or API endpoint not configured');
    }

    try {
      const response = await fetch(agent.apiEndpoint, {
        headers: agent.apiKey ? {
          'Authorization': `Bearer ${agent.apiKey}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      updateAgent(agentId, {
        lastActivity: new Date().toISOString(),
        status: 'active'
      });

      return data;
    } catch (error) {
      console.error('Error fetching from API:', error);
      updateAgent(agentId, {
        status: 'error',
        lastActivity: new Date().toISOString()
      });
      throw error;
    }
  };

  // Enable agent and connect
  const enableAgent = async (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return;
    }

    // Update agent to enabled
    updateAgent(agentId, { enabled: true });

    // Connect the agent
    await connectAgent(agentId);
  };

  // Disable agent and disconnect
  const disableAgent = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return;
    }

    // Disconnect first
    disconnectAgent(agentId);

    // Update agent to disabled
    updateAgent(agentId, { enabled: false, status: 'inactive', connectionStatus: 'disconnected' });
  };

  // Connect to an agent
  const connectAgent = async (agentId) => {
    console.log(`🔌 connectAgent() called for agent: ${agentId}`);

    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`❌ Agent ${agentId} not found in agents array`);
      console.log(`   Available agents:`, agents.map(a => `${a.id} (${a.type})`));
      return;
    }

    console.log(`✅ Agent found:`, { id: agent.id, name: agent.name, type: agent.type });

    // Update status to connecting
    console.log(`🔄 Updating agent status to 'connecting'...`);
    updateAgent(agentId, { status: 'connecting' });

    try {
      if (agent.type === 'demo') {
        console.log(`🧪 Agent is DEMO type - will create/start MarketDataSimulator`);

        // Get trading config from agent or use defaults
        const tradingConfig = agent.tradingConfig || {
          scanInterval: 1,
          positionSizeUsd: 25,
          maxPositions: 3,
          minRiskScore: 70,
        };

        // Create market data simulator if not exists
        if (!demoAgentsRef.current.has(agentId)) {
          console.log(`📊 Creating NEW MarketDataSimulator for ${agentId}...`);
          console.log(`   Using trading config:`, tradingConfig);

          const simulator = new MarketDataSimulator(agentId, {
            scanInterval: (tradingConfig.scanInterval || 1) * 1000, // Convert to ms
            basePositionSize: tradingConfig.positionSizeUsd || 25,
            maxPositions: tradingConfig.maxPositions || 3,
            targetWinRate: 0.82, // 82% win rate target (high-quality signals)
            avgHoldTime: 1000 * 60 * 15, // 15 minutes average
            accountBalance: 1000, // $1000 account
            minQuality: tradingConfig.minQualityScore || 70,
          });

          demoAgentsRef.current.set(agentId, simulator);

          // Subscribe to simulator events
          simulator.on('trade', (tradeData) => {
            // Trade event will be handled by TradingDataContext
            console.log('📈 Simulated trade received:', tradeData);
          });

          simulator.on('scan', (scanData) => {
            // Update last activity on each scan
            updateAgent(agentId, {
              lastActivity: new Date().toISOString(),
            });
          });

          simulator.on('position', (positionData) => {
            console.log(`📊 Open positions: ${positionData.open}/${positionData.max}`);
          });
        }

        // Start market data simulator
        console.log(`🚀 Starting MarketDataSimulator...`);
        const simulator = demoAgentsRef.current.get(agentId);
        simulator.start();
        console.log(`✅ MarketDataSimulator started successfully!`);
        console.log(`   Scan interval: 1000ms`);
        console.log(`   Max positions: 3`);
        console.log(`   Target win rate: 82%`);

        console.log(`🔄 Updating agent status to 'active' and 'connected'...`);
        updateAgent(agentId, {
          status: 'active',
          connectionStatus: 'connected',
          lastActivity: new Date().toISOString(),
        });
        console.log(`✅ Agent status updated - demo mode is now LIVE!`);

      } else if (agent.type === 'live' || agent.type === 'api') {
        // Create connection in pool
        const pool = connectionPoolRef.current;
        const config = {
          apiEndpoint: agent.apiEndpoint,
          apiKey: agent.apiKey,
        };

        // Create connection if not exists
        if (!pool.getConnection(agentId)) {
          const connection = pool.createConnection(agentId, config);

          // Subscribe to connection events
          connection.on('status', (statusData) => {
            updateAgent(agentId, {
              status: statusData.status === 'connected' ? 'active' : statusData.status === 'disconnected' ? 'inactive' : 'error',
              connectionStatus: statusData.status,
              lastActivity: new Date().toISOString(),
            });
          });

          connection.on('error', (errorData) => {
            updateAgent(agentId, {
              status: 'error',
              connectionStatus: 'error',
              lastActivity: new Date().toISOString(),
            });
          });
        }

        // Connect
        pool.connect(agentId);

      } else {
        console.warn(`Agent type ${agent.type} connection not implemented yet`);
        updateAgent(agentId, { status: 'inactive', connectionStatus: 'disconnected' });
      }

    } catch (error) {
      console.error(`Error connecting agent ${agentId}:`, error);
      updateAgent(agentId, {
        status: 'error',
        connectionStatus: 'error',
        lastActivity: new Date().toISOString(),
      });
    }
  };

  // Disconnect from an agent
  const disconnectAgent = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return;
    }

    if (agent.type === 'demo') {
      const demoAgent = demoAgentsRef.current.get(agentId);
      if (demoAgent) {
        demoAgent.stop();
      }
    } else if (agent.type === 'live' || agent.type === 'api') {
      const pool = connectionPoolRef.current;
      pool.disconnect(agentId);
    }

    updateAgent(agentId, {
      status: 'inactive',
      connectionStatus: 'disconnected',
      lastActivity: new Date().toISOString(),
    });
  };

  // Set agent mode (LIVE, SIM, OFFLINE)
  const setAgentMode = useCallback(async (agentId, mode) => {
    const pool = connectionPoolRef.current;

    setAgents(prev => {
      const updated = prev.map(a => {
        if (a.id !== agentId) return a;

        // Handle connection based on mode
        if (mode === AGENT_MODES.LIVE && a.apiEndpoint) {
          // Connect to live agent
          if (!pool.getConnection(agentId)) {
            const connection = pool.createConnection(agentId, { apiEndpoint: a.apiEndpoint });
            connection.connect();
          } else {
            pool.connect(agentId);
          }
        } else {
          // Disconnect for SIM or OFFLINE
          pool.disconnect(agentId);
        }

        return { ...a, mode };
      });

      // Save to Firebase
      saveAgentsToFirebase(updated);
      // Also save to localStorage for backward compatibility
      localStorage.setItem('tradingAgents', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Test connection without fully connecting
  const testConnection = async (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      if (agent.type === 'demo') {
        // Demo agents are always "connectable"
        return { success: true, message: 'Demo agent ready' };
      } else if (agent.type === 'live' || agent.type === 'api') {
        const pool = connectionPoolRef.current;

        // Create temporary connection for testing
        let connection = pool.getConnection(agentId);
        if (!connection) {
          connection = pool.createConnection(agentId, {
            apiEndpoint: agent.apiEndpoint,
            apiKey: agent.apiKey,
          });
        }

        const isConnectable = await connection.testConnection();
        return {
          success: isConnectable,
          message: isConnectable ? 'Connection successful' : 'Connection failed',
        };
      } else {
        return { success: false, message: 'Connection test not supported for this agent type' };
      }
    } catch (error) {
      console.error(`Error testing connection for agent ${agentId}:`, error);
      return { success: false, message: error.message };
    }
  };

  // Refresh agent statistics (recalculate from trades)
  const refreshAgentStats = (agentId, trades = []) => {
    const agentTrades = trades.filter(t => t.agentId === agentId && t.status === 'CLOSED');

    if (agentTrades.length === 0) {
      updateAgent(agentId, {
        stats: {
          totalTrades: 0,
          winRate: 0,
          totalPnL: 0,
          avgPnL: 0,
        }
      });
      return;
    }

    const wins = agentTrades.filter(t => t.pnl > 0);
    const totalPnL = agentTrades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = (wins.length / agentTrades.length) * 100;
    const avgPnL = totalPnL / agentTrades.length;

    updateAgent(agentId, {
      stats: {
        totalTrades: agentTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        avgPnL: parseFloat(avgPnL.toFixed(2)),
      },
      lastActivity: new Date().toISOString(),
    });
  };

  // Update agent trading configuration
  const updateAgentTradingConfig = async (agentId, newConfig) => {
    console.log(`⚙️ Updating trading config for agent ${agentId}:`, newConfig);

    // Update local agent config in dashboard
    updateAgent(agentId, {
      tradingConfig: newConfig
    });

    // CRITICAL: Send config to Railway agent so it uses these settings
    const agent = agents.find(a => a.id === agentId);
    if (agent && agent.type === 'live' && agent.apiEndpoint) {
      try {
        console.log(`📤 Sending config to Railway agent at ${agent.apiEndpoint}/config...`);

        // Convert dashboard config to Railway agent format
        const railwayConfig = {
          position_size_usd: newConfig.positionSizeUsd,
          max_positions: newConfig.maxPositions,
          take_profit_pct: newConfig.takeProfitPct,
          stop_loss_pct: newConfig.stopLossPct * -1, // Railway uses negative values
          min_overall_risk_score: newConfig.minRiskScore,
          min_quality_score: newConfig.minQualityScore,
          min_market_cap: newConfig.minMarketCap,
          max_market_cap: newConfig.maxMarketCap,
          min_liquidity: newConfig.minLiquidity,
          auto_trading: newConfig.autoTrading,
          paper_trading: newConfig.paperTrading
        };

        const response = await fetch(`${agent.apiEndpoint}/config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(railwayConfig)
        });

        if (response.ok) {
          console.log(`   ✅ Railway agent config updated successfully!`);
          console.log(`   → Agent will now filter trades with minQualityScore: ${newConfig.minQualityScore}`);
          console.log(`   → Agent will now filter trades with minRiskScore: ${newConfig.minRiskScore}`);
          console.log(`   → Agent will now use positionSize: $${newConfig.positionSizeUsd}`);
        } else {
          console.warn(`   ⚠️  Railway agent returned ${response.status} - config update may have failed`);
          console.log(`   → NOTE: You may need to restart the Railway agent for changes to take effect`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to send config to Railway agent:`, error.message);
        console.log(`   → Config saved locally in dashboard, but Railway agent may still use default settings`);
        console.log(`   → Check if Railway agent has /config endpoint and is running`);
      }
    }

    // If this is a demo agent with an active simulator, update its config
    if (demoAgentsRef.current.has(agentId)) {
      const simulator = demoAgentsRef.current.get(agentId);
      if (simulator && simulator.updateConfig) {
        simulator.updateConfig({
          scanInterval: (newConfig.scanInterval || 1) * 1000, // Convert to ms
          basePositionSize: newConfig.positionSizeUsd || 25,
          maxPositions: newConfig.maxPositions || 3,
          minQuality: newConfig.minQualityScore || 70,
        });
        console.log(`✅ Simulator config updated for running agent ${agentId}`);
      }
    }
  };

  const value = {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    selectedAgent: getSelectedAgent(),
    isLoading,
    addAgent,
    updateAgent,
    deleteAgent,
    selectAgent,
    processWebhookSignal,
    fetchFromAPI,
    // New multi-agent methods
    enableAgent,
    disableAgent,
    connectAgent,
    disconnectAgent,
    setAgentMode, // NEW: per-agent mode system
    testConnection,
    refreshAgentStats,
    updateAgentTradingConfig,
    // Access to connection pool and demo agents (for advanced use)
    connectionPool: connectionPoolRef.current,
    demoAgents: demoAgentsRef.current,
  };

  return (
    <AgentManagementContext.Provider value={value}>
      {children}
    </AgentManagementContext.Provider>
  );
};
