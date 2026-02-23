/**
 * API Key Manager
 * Generate and validate API keys for external agents
 */

// Generate a secure random API key
export const generateApiKey = (prefix = 'nxg_live') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  for (let i = 0; i < 32; i++) {
    key += chars[array[i] % chars.length];
  }

  return `${prefix}_${key}`;
};

// Hash an API key for storage (simple hash for client-side)
export const hashApiKey = async (apiKey) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Validate API key format
export const isValidApiKeyFormat = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') return false;

  // Check prefix
  const prefixes = ['nxg_live_', 'nxg_test_'];
  const hasValidPrefix = prefixes.some(prefix => apiKey.startsWith(prefix));
  if (!hasValidPrefix) return false;

  // Check length (prefix + 32 chars)
  const expectedLength = apiKey.startsWith('nxg_live_') ? 41 : 41; // 9 + 32
  if (apiKey.length !== expectedLength) return false;

  return true;
};

// Generate webhook URL for an agent
export const generateWebhookUrl = (agentId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/webhook/signal?agentId=${agentId}`;
};

// Mask API key for display (show first 8 and last 4 chars)
export const maskApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 16) return '••••••••';
  return `${apiKey.slice(0, 12)}${'•'.repeat(apiKey.length - 16)}${apiKey.slice(-4)}`;
};

// Parse signal from webhook payload
export const parseSignal = (payload) => {
  if (!payload) {
    throw new Error('Empty payload');
  }

  // Required fields
  const action = payload.action?.toUpperCase();
  if (!action || !['BUY', 'SELL'].includes(action)) {
    throw new Error('Invalid action: must be BUY or SELL');
  }

  const tokenAddress = payload.tokenAddress || payload.token_address || payload.mint;
  if (!tokenAddress) {
    throw new Error('Missing tokenAddress');
  }

  // Optional fields with defaults
  const signal = {
    action,
    tokenAddress,
    tokenSymbol: payload.tokenSymbol || payload.token_symbol || payload.symbol || 'UNKNOWN',
    amount: parseFloat(payload.amount) || 0.1,
    amountType: payload.amountType || payload.amount_type || 'SOL',
    slippage: parseFloat(payload.slippage) || 1.0,
    price: parseFloat(payload.price) || null,
    metadata: payload.metadata || {},
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  return signal;
};

// Validate signal has required data
export const validateSignal = (signal) => {
  const errors = [];

  if (!signal.action) {
    errors.push('Missing action');
  }

  if (!signal.tokenAddress) {
    errors.push('Missing tokenAddress');
  }

  // Validate Solana address format (base58, 32-44 chars)
  if (signal.tokenAddress && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(signal.tokenAddress)) {
    errors.push('Invalid tokenAddress format');
  }

  if (signal.amount && signal.amount <= 0) {
    errors.push('Amount must be positive');
  }

  if (signal.slippage && (signal.slippage < 0 || signal.slippage > 50)) {
    errors.push('Slippage must be between 0 and 50');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  generateWebhookUrl,
  maskApiKey,
  parseSignal,
  validateSignal,
};
