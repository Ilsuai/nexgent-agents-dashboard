/**
 * SOLANA TRADING AGENT - DASHBOARD CONNECTOR
 * Connects to Railway-deployed agent or local development server.
 */

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || '';
const AGENT_WS_URL = import.meta.env.VITE_AGENT_WS_URL || '';

if (!AGENT_API_URL) {
  console.warn('⚠️ VITE_AGENT_API_URL not configured');
}

class AgentAPI {
  constructor(baseUrl = AGENT_API_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || `API error: ${response.status}`);
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      console.error(`Agent API error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  async getTrades(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this._fetch(`/trades${query ? `?${query}` : ''}`);
  }

  async createTrade(trade) {
    return this._fetch('/trades', { method: 'POST', body: JSON.stringify(trade) });
  }

  async updateTrade(tradeId, updates) {
    return this._fetch(`/trades/${tradeId}`, { method: 'PUT', body: JSON.stringify(updates) });
  }

  async getAnalytics() {
    return this._fetch('/analytics');
  }

  async analyzeToken(tokenAddress) {
    return this._fetch('/analyze', { method: 'POST', body: JSON.stringify({ address: tokenAddress }) });
  }

  async getSignals(limit = 50) {
    return this._fetch(`/signals?limit=${limit}`);
  }

  async getPositions() {
    return this._fetch('/positions');
  }

  async getStatus() {
    return this._fetch('/status');
  }

  async buy(tokenAddress, amountSol = 0.1) {
    return this._fetch('/buy', { method: 'POST', body: JSON.stringify({ address: tokenAddress, amountSol }) });
  }

  async sell(tokenAddress) {
    return this._fetch('/sell', { method: 'POST', body: JSON.stringify({ address: tokenAddress }) });
  }

  async ping() {
    try {
      await this._fetch('/status');
      return true;
    } catch {
      return false;
    }
  }

  getApiUrl() {
    return this.baseUrl;
  }
}

class AgentWebSocket {
  constructor(url = AGENT_WS_URL) {
    this.url = url;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.intentionalDisconnect = false;
    this._listeners = {
      connected: [], disconnected: [], trade: [], signal: [], balance: [], error: [], status: [],
    };
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.intentionalDisconnect = false;
    console.log('🔌 Connecting to agent WebSocket:', this.url);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ Connected to agent WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._emit('connected', { timestamp: new Date().toISOString() });
        this._emit('status', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this._handleMessage(message);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code);
        this.isConnected = false;
        this._emit('disconnected', { code: event.code });
        this._emit('status', { status: 'disconnected' });

        if (!this.intentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._emit('error', { error: 'Connection error' });
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this._emit('error', { error: error.message });
    }
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  _handleMessage(message) {
    const eventType = message.event || message.type;
    switch (eventType) {
      case 'new_trade':
        this._emit('trade', { ...message.data, isNew: true });
        break;
      case 'trade_update':
        this._emit('trade', { ...message.data, isUpdate: true });
        break;
      case 'trade_closed':
        this._emit('trade', { ...message.data, isClosed: true });
        break;
      case 'signal':
      case 'signals_detected':
        this._emit('signal', message.data);
        break;
      case 'balance_update':
        this._emit('balance', message.data);
        break;
      case 'status_update':
        this._emit('status', message.data);
        break;
      default:
        console.log('Unknown event:', eventType);
    }
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error(`Error in ${event} listener:`, e); }
    });
  }

  _addListener(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => {
      const idx = this._listeners[event].indexOf(callback);
      if (idx > -1) this._listeners[event].splice(idx, 1);
    };
  }

  onConnected(callback) { return this._addListener('connected', callback); }
  onDisconnected(callback) { return this._addListener('disconnected', callback); }
  onTrade(callback) { return this._addListener('trade', callback); }
  onSignal(callback) { return this._addListener('signal', callback); }
  onBalance(callback) { return this._addListener('balance', callback); }
  onError(callback) { return this._addListener('error', callback); }
  onStatus(callback) { return this._addListener('status', callback); }
  getWsUrl() { return this.url; }
  getStatus() { return { isConnected: this.isConnected, reconnectAttempts: this.reconnectAttempts, url: this.url }; }
}

const agent = new AgentAPI();
const agentWS = new AgentWebSocket();

export { AgentAPI, AgentWebSocket, agent, agentWS, AGENT_API_URL, AGENT_WS_URL };
export default agent;
