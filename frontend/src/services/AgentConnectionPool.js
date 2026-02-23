/**
 * AgentConnectionPool - Manages multiple simultaneous agent connections
 *
 * Handles WebSocket and REST API connections for multiple trading agents,
 * with auto-reconnection, event handling, and lifecycle management.
 */

class AgentConnection {
  constructor(agentId, config) {
    this.agentId = agentId;
    this.config = config;
    this.ws = null;
    this.status = 'disconnected'; // disconnected | connecting | connected | error
    this.listeners = new Map(); // Event listeners per event type
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.reconnectTimer = null;
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  // REST API methods
  async apiRequest(endpoint, options = {}) {
    const url = `${this.config.apiEndpoint}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request error for agent ${this.agentId}:`, error);
      this.emit('error', { type: 'api', error: error.message });
      throw error;
    }
  }

  // WebSocket connection methods
  connect() {
    if (this.status === 'connected' || this.status === 'connecting') {
      console.log(`Agent ${this.agentId} already connected or connecting`);
      return;
    }

    this.status = 'connecting';
    this.emit('status', { agentId: this.agentId, status: 'connecting' });

    try {
      // Build WebSocket URL from API endpoint
      const wsUrl = this.config.wsEndpoint || this.buildWebSocketUrl();

      console.log(`🔌 Connecting to agent WebSocket: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`WebSocket connected for agent ${this.agentId}`);
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('status', { agentId: this.agentId, status: 'connected' });
        this.emit('connected', { agentId: this.agentId });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error(`Error parsing WebSocket message for agent ${this.agentId}:`, error);
        }
      };

      this.ws.onerror = (error) => {
        console.error(`WebSocket error for agent ${this.agentId}:`, error);
        this.status = 'error';
        this.emit('status', { agentId: this.agentId, status: 'error' });
        this.emit('error', { type: 'websocket', error: 'WebSocket connection error' });
      };

      this.ws.onclose = () => {
        console.log(`WebSocket closed for agent ${this.agentId}`);
        this.status = 'disconnected';
        this.emit('status', { agentId: this.agentId, status: 'disconnected' });
        this.emit('disconnected', { agentId: this.agentId });

        // Auto-reconnect if not manually disconnected
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      console.error(`Failed to create WebSocket for agent ${this.agentId}:`, error);
      this.status = 'error';
      this.emit('status', { agentId: this.agentId, status: 'error' });
      this.emit('error', { type: 'connection', error: error.message });
    }
  }

  disconnect() {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset reconnect attempts to prevent auto-reconnect
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = 'disconnected';
    this.emit('status', { agentId: this.agentId, status: 'disconnected' });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);

    console.log(`Scheduling reconnect for agent ${this.agentId} in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  handleWebSocketMessage(data) {
    // Support BOTH formats:
    // Python agent: { event: "new_trade", data: {...} }
    // Legacy: { type: "trade", ...payload }

    const eventType = data.event || data.type || 'unknown';
    let payload = data.data ?? data;

    // Unwrap nested trade if present
    if (payload?.trade && typeof payload.trade === 'object') {
      payload = payload.trade;
    }

    // Normalize event type
    const normalizedType = (() => {
      switch (eventType) {
        case 'new_trade':
        case 'trade_opened':
        case 'trade_update':
        case 'trade_updated':
        case 'trade_closed':
        case 'trade_close':
        case 'trade':
          return 'trade';
        case 'signals_detected':
        case 'signal_detected':
        case 'signal':
          return 'signal';
        case 'status_update':
        case 'agent_status':
        case 'status':
          return 'agent_status';
        case 'balance_update':
        case 'balance':
          return 'balance';
        case 'position_update':
        case 'position':
          return 'position';
        case 'error':
          return 'error';
        default:
          return eventType;
      }
    })();

    const taggedData = {
      ...payload,
      agentId: this.agentId,
      type: normalizedType,
      originalEvent: eventType,
    };

    switch (normalizedType) {
      case 'trade':
        this.emit('trade', taggedData);
        break;
      case 'signal':
        this.emit('signal', taggedData);
        break;
      case 'position':
        this.emit('position', taggedData);
        break;
      case 'agent_status':
        this.emit('agentStatus', taggedData);
        break;
      case 'balance':
        this.emit('balance', taggedData);
        break;
      case 'error':
        this.emit('error', taggedData);
        break;
      default:
        this.emit('message', taggedData);
    }
  }

  buildWebSocketUrl() {
    // Convert HTTP(S) to WS(S)
    const apiUrl = (this.config.apiEndpoint || 'https://solana-trading-agent-production.up.railway.app/api/v1').trim();
    const wsUrl = apiUrl.replace(/^http/, 'ws');

    // Remove /api/v1 or /api suffix if present and add /ws
    const baseUrl = wsUrl.replace(/\/api(\/v\d+)?\/?$/, '');
    return `${baseUrl}/ws`;
  }

  // Test connection without fully connecting
  async testConnection() {
    try {
      // Try to hit a health or status endpoint
      const response = await fetch(`${this.config.apiEndpoint.replace('/api/v1', '')}/health`);
      return response.ok;
    } catch (error) {
      console.error(`Connection test failed for agent ${this.agentId}:`, error);
      return false;
    }
  }
}

class AgentConnectionPool {
  constructor() {
    this.connections = new Map(); // Map<agentId, AgentConnection>
    this.globalListeners = new Map(); // Global event listeners
  }

  // Create a new connection for an agent
  createConnection(agentId, config) {
    if (this.connections.has(agentId)) {
      console.warn(`Connection for agent ${agentId} already exists`);
      return this.connections.get(agentId);
    }

    const connection = new AgentConnection(agentId, config);

    // Forward events to global listeners
    ['trade', 'signal', 'position', 'status', 'error', 'connected', 'disconnected', 'agentStatus', 'message', 'balance'].forEach(event => {
      connection.on(event, (data) => {
        this.emitGlobal(event, data);
      });
    });

    this.connections.set(agentId, connection);
    return connection;
  }

  // Connect to an agent
  connect(agentId) {
    const connection = this.connections.get(agentId);
    if (!connection) {
      console.error(`No connection found for agent ${agentId}`);
      return;
    }
    connection.connect();
  }

  // Disconnect from an agent
  disconnect(agentId) {
    const connection = this.connections.get(agentId);
    if (!connection) {
      console.error(`No connection found for agent ${agentId}`);
      return;
    }
    connection.disconnect();
  }

  // Remove connection entirely
  removeConnection(agentId) {
    const connection = this.connections.get(agentId);
    if (connection) {
      connection.disconnect();
      this.connections.delete(agentId);
    }
  }

  // Get a specific connection
  getConnection(agentId) {
    return this.connections.get(agentId);
  }

  // Get all connections
  getAllConnections() {
    return Array.from(this.connections.values());
  }

  // Make API request to a specific agent
  async apiRequest(agentId, endpoint, options = {}) {
    const connection = this.connections.get(agentId);
    if (!connection) {
      throw new Error(`No connection found for agent ${agentId}`);
    }
    return connection.apiRequest(endpoint, options);
  }

  // Test connection for an agent
  async testConnection(agentId) {
    const connection = this.connections.get(agentId);
    if (!connection) {
      throw new Error(`No connection found for agent ${agentId}`);
    }
    return connection.testConnection();
  }

  // Global event listeners (listen to events from all agents)
  on(event, callback) {
    if (!this.globalListeners.has(event)) {
      this.globalListeners.set(event, []);
    }
    this.globalListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.globalListeners.has(event)) return;
    const callbacks = this.globalListeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emitGlobal(event, data) {
    if (!this.globalListeners.has(event)) return;
    this.globalListeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in global listener for ${event}:`, error);
      }
    });
  }

  // Get status of all connections
  getConnectionStatuses() {
    const statuses = {};
    this.connections.forEach((connection, agentId) => {
      statuses[agentId] = {
        status: connection.status,
        reconnectAttempts: connection.reconnectAttempts,
      };
    });
    return statuses;
  }

  // Disconnect all agents
  disconnectAll() {
    this.connections.forEach((connection) => {
      connection.disconnect();
    });
  }

  // Clean up (call on unmount)
  destroy() {
    this.disconnectAll();
    this.connections.clear();
    this.globalListeners.clear();
  }
}

// Singleton instance
let poolInstance = null;

export const getConnectionPool = () => {
  if (!poolInstance) {
    poolInstance = new AgentConnectionPool();
  }
  return poolInstance;
};

export default AgentConnectionPool;
