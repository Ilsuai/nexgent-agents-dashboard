/**
 * Centralized Trading Constants
 */

export const TRADING_DEFAULTS = {
  POSITION_SIZE_USD: 25,
  MAX_POSITIONS: 3,
  TAKE_PROFIT_PCT: 15,
  STOP_LOSS_PCT: 8,
  MIN_RISK_SCORE: 70,
  MIN_QUALITY_SCORE: 70,
  MIN_SIGNAL_STRENGTH: 4,
  TARGET_WIN_RATE: 0.82,
  STARTING_BALANCE: 700,
};

export const RISK_LIMITS = {
  MAX_RISK_PER_TRADE: 0.02,
  MAX_PORTFOLIO_RISK: 0.06,
  MAX_DRAWDOWN: 0.15,
  MIN_LIQUIDITY_SCORE: 0.3,
  MAX_POSITION_SIZE_USD: 50,
  MIN_POSITION_SIZE_USD: 10,
};

export const COOLDOWNS = {
  SINGLE_LOSS_HOURS: 2,
  DOUBLE_LOSS_HOURS: 6,
  TRIPLE_LOSS_HOURS: 24,
  SEVERE_LOSS_HOURS: 48,
};

export const SIGNAL_STRENGTH = {
  MAX_DOTS: 5,
  MIN_REQUIRED: 4,
  RATINGS: { 5: 'Excellent', 4: 'Strong', 3: 'Moderate', 2: 'Weak', 1: 'Poor' },
};

export const COLORS = {
  PROFIT: '#22c55e',
  LOSS: '#ef4444',
  NEUTRAL: '#6b7280',
  ACCENT: '#00ff94',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
};

export const STORAGE_KEYS = {
  TRADES: 'nexgent_trades',
  SETTINGS: 'nexgent_settings',
  AGENTS: 'nexgent_agents',
};

export const EXIT_REASONS = {
  STOP_LOSS: 'Stop Loss',
  TAKE_PROFIT_1: 'Take Profit 1',
  TAKE_PROFIT_2: 'Take Profit 2',
  TAKE_PROFIT_3: 'Take Profit 3',
  TRAILING_STOP: 'Trailing Stop',
  MANUAL: 'Manual Close',
};

export const AGENT_MODES = {
  LIVE: 'LIVE',
  SIM: 'SIM',
  OFFLINE: 'OFFLINE',
};

export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  ERROR: 'error',
};

export default {
  TRADING_DEFAULTS,
  RISK_LIMITS,
  COOLDOWNS,
  SIGNAL_STRENGTH,
  COLORS,
  STORAGE_KEYS,
  EXIT_REASONS,
  AGENT_MODES,
  CONNECTION_STATUS,
};
