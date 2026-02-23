/**
 * MARKET DATA SIMULATOR
 * Simplified market simulator for demo trading
 * Uses inline strategy logic for entry/exit decisions
 */

class MarketDataSimulator {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.isRunning = false;
    this.trades = [];
    this.accountBalance = config.accountBalance || 1000;

    // Configuration
    this.config = {
      scanInterval: config.scanInterval || 1000,
      maxPositions: config.maxPositions || 3,
      targetWinRate: config.targetWinRate || 0.82,
      avgHoldTime: config.avgHoldTime || 1000 * 60 * 15,
      minQuality: config.minQuality || 70,
      basePositionSize: config.basePositionSize || 25,
      takeProfitPct: 15,
      stopLossPct: 10,
    };

    // State
    this.openPositions = [];
    this.scanCount = 0;
    this.signalsDetected = 0;
    this.tradesExecuted = 0;

    // Event listeners
    this.listeners = {
      trade: [],
      signal: [],
      scan: [],
      position: [],
      strategy: [] // New: strategy decisions
    };

    // Expanded token pool - Real Solana token addresses for proper DexScreener links
    // Simulates scanning through a diverse market
    this.trendingTokens = [
      // Meme Coins
      { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', basePrice: 0.00001234, volatility: 0.15, trendDirection: 'uptrend' },
      { symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', basePrice: 0.567, volatility: 0.12, trendDirection: 'uptrend' },
      { symbol: 'POPCAT', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', basePrice: 0.432, volatility: 0.18, trendDirection: 'sideways' },
      { symbol: 'MYRO', address: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4', basePrice: 0.098, volatility: 0.20, trendDirection: 'downtrend' },
      { symbol: 'SAMO', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', basePrice: 0.0234, volatility: 0.14, trendDirection: 'uptrend' },
      { symbol: 'BOME', address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', basePrice: 0.0089, volatility: 0.22, trendDirection: 'uptrend' },
      { symbol: 'MEW', address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', basePrice: 0.0045, volatility: 0.19, trendDirection: 'sideways' },
      { symbol: 'SLERF', address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3', basePrice: 0.234, volatility: 0.25, trendDirection: 'uptrend' },

      // DeFi Tokens
      { symbol: 'JTO', address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', basePrice: 2.567, volatility: 0.13, trendDirection: 'sideways' },
      { symbol: 'PYTH', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', basePrice: 0.789, volatility: 0.11, trendDirection: 'uptrend' },
      { symbol: 'JUP', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', basePrice: 0.923, volatility: 0.14, trendDirection: 'uptrend' },
      { symbol: 'RAY', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', basePrice: 1.456, volatility: 0.16, trendDirection: 'uptrend' },
      { symbol: 'ORCA', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', basePrice: 1.234, volatility: 0.10, trendDirection: 'uptrend' },
      { symbol: 'MNGO', address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', basePrice: 0.0234, volatility: 0.17, trendDirection: 'sideways' },

      // Infrastructure
      { symbol: 'RENDER', address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', basePrice: 4.567, volatility: 0.12, trendDirection: 'uptrend' },
      { symbol: 'HNT', address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', basePrice: 3.234, volatility: 0.11, trendDirection: 'uptrend' },

      // Gaming
      { symbol: 'ATLAS', address: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx', basePrice: 0.00234, volatility: 0.18, trendDirection: 'sideways' },
      { symbol: 'POLIS', address: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk', basePrice: 0.123, volatility: 0.19, trendDirection: 'sideways' },

      // NFT/Metaverse
      { symbol: 'DUST', address: 'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ', basePrice: 0.456, volatility: 0.21, trendDirection: 'uptrend' },
      { symbol: 'GRAPE', address: '8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA', basePrice: 0.00067, volatility: 0.16, trendDirection: 'downtrend' },

      // New Trending
      { symbol: 'W', address: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ', basePrice: 0.567, volatility: 0.23, trendDirection: 'uptrend' },
      { symbol: 'MOBILE', address: 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6', basePrice: 0.00234, volatility: 0.20, trendDirection: 'uptrend' },
      { symbol: 'CROWN', address: 'CRWNYkqdgvhGGae9CKfNka58j6QQkaD5bLhKXvUYqnc1', basePrice: 0.0123, volatility: 0.24, trendDirection: 'sideways' },
      { symbol: 'IO', address: 'BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K', basePrice: 1.234, volatility: 0.15, trendDirection: 'uptrend' },
      { symbol: 'ZEUS', address: 'ZEUS1aR7aX8DFFJf5QjWj2ftDDdNTroMNGo8YoQm3Gq', basePrice: 0.0456, volatility: 0.22, trendDirection: 'uptrend' },
    ];

    // Initialize price history for each token
    this.tokenMarketData = {};
    this.trendingTokens.forEach(token => {
      this.tokenMarketData[token.symbol] = this._initializeTokenHistory(token);
    });
  }

  /**
   * Initialize price and volume history for a token
   */
  _initializeTokenHistory(token) {
    const priceHistory = [];
    const volumeHistory = [];
    let currentPrice = token.basePrice;

    // Generate 50 historical data points
    for (let i = 0; i < 50; i++) {
      const trendBias = token.trendDirection === 'uptrend' ? 0.002 :
                       token.trendDirection === 'downtrend' ? -0.002 : 0;
      const randomChange = (Math.random() - 0.5) * token.volatility * 0.1;
      currentPrice *= (1 + trendBias + randomChange);
      priceHistory.push(currentPrice);

      // Simulate volume
      const baseVolume = 1000000;
      const volume = baseVolume * (0.5 + Math.random());
      volumeHistory.push(volume);
    }

    return {
      priceHistory,
      volumeHistory,
      currentPrice: priceHistory[priceHistory.length - 1],
      currentVolume: volumeHistory[volumeHistory.length - 1]
    };
  }

  /**
   * Update token price history (simulate live market data)
   */
  _updateTokenPrice(symbol) {
    const token = this.trendingTokens.find(t => t.symbol === symbol);
    const marketData = this.tokenMarketData[symbol];

    const trendBias = token.trendDirection === 'uptrend' ? 0.002 :
                     token.trendDirection === 'downtrend' ? -0.002 : 0;
    const randomChange = (Math.random() - 0.5) * token.volatility * 0.1;

    const newPrice = marketData.currentPrice * (1 + trendBias + randomChange);
    const newVolume = marketData.currentVolume * (0.8 + Math.random() * 0.4);

    // Add to history
    marketData.priceHistory.push(newPrice);
    marketData.volumeHistory.push(newVolume);

    // Keep only last 50 data points
    if (marketData.priceHistory.length > 50) {
      marketData.priceHistory.shift();
      marketData.volumeHistory.shift();
    }

    marketData.currentPrice = newPrice;
    marketData.currentVolume = newVolume;
  }

  start() {
    if (this.isRunning) return;

    console.log(`🤖 Starting Advanced Market Simulator for agent: ${this.agentId}`);
    console.log(`   Scan Interval: ${this.config.scanInterval}ms (constant scanning)`);
    console.log(`   Strategy: Dynamic exits with technical analysis`);
    console.log(`   Target Win Rate: ${(this.config.targetWinRate * 100).toFixed(1)}%`);

    // Load any open positions from previous session
    const loadedPositions = this._loadOpenPositions();
    if (loadedPositions > 0) {
      console.log(`   📂 Resumed ${loadedPositions} open positions from previous session`);
    }

    this.isRunning = true;
    this.scanLoop = setInterval(() => this._scan(), this.config.scanInterval);
    this.positionCheckLoop = setInterval(() => this._checkPositions(), 2000);
  }

  stop() {
    if (!this.isRunning) return;

    console.log(`🛑 Stopping Market Data Simulator for agent: ${this.agentId}`);
    this.isRunning = false;

    if (this.scanLoop) clearInterval(this.scanLoop);
    if (this.positionCheckLoop) clearInterval(this.positionCheckLoop);

    // DON'T close open positions - they should persist even when agent is stopped
    // Trades will remain open and can be monitored when agent restarts
    console.log(`📊 Agent stopped with ${this.openPositions.length} positions still open`);
    console.log(`   Positions will be monitored when agent restarts`);

    // Save open positions to allow resuming later
    this._saveOpenPositions();
  }

  /**
   * Update simulator configuration while running
   * Restarts the simulator with new config if it's currently running
   */
  updateConfig(newConfig = {}) {
    console.log(`⚙️ Updating simulator config for agent: ${this.agentId}`, newConfig);

    const wasRunning = this.isRunning;

    // Stop if running (to restart with new config)
    if (wasRunning) {
      // Stop without closing positions
      this.isRunning = false;
      if (this.scanLoop) clearInterval(this.scanLoop);
      if (this.positionCheckLoop) clearInterval(this.positionCheckLoop);
    }

    // Update configuration
    this.config = {
      ...this.config,
      scanInterval: newConfig.scanInterval !== undefined ? newConfig.scanInterval : this.config.scanInterval,
      maxPositions: newConfig.maxPositions !== undefined ? newConfig.maxPositions : this.config.maxPositions,
      targetWinRate: newConfig.targetWinRate !== undefined ? newConfig.targetWinRate : this.config.targetWinRate,
      avgHoldTime: newConfig.avgHoldTime !== undefined ? newConfig.avgHoldTime : this.config.avgHoldTime,
      minQuality: newConfig.minQuality !== undefined ? newConfig.minQuality : this.config.minQuality,
    };

    // Update position size config
    if (newConfig.basePositionSize !== undefined) {
      this.config.basePositionSize = newConfig.basePositionSize;
    }

    console.log(`✅ Config updated:`, {
      maxPositions: this.config.maxPositions,
      scanInterval: this.config.scanInterval,
      targetWinRate: this.config.targetWinRate,
    });

    // Restart if it was running
    if (wasRunning) {
      this.isRunning = true;
      this.scanLoop = setInterval(() => this._scan(), this.config.scanInterval);
      this.positionCheckLoop = setInterval(() => this._checkPositions(), 2000);
      console.log(`🔄 Simulator restarted with new config`);
    }
  }

  _scan() {
    this.scanCount++;

    // Update all token prices
    this.trendingTokens.forEach(token => {
      this._updateTokenPrice(token.symbol);
    });

    // Analyze one random token per scan for DEX activity display
    const token = this._getRandomToken();
    const tokenMarketData = this._getTokenMarketData(token);

    // Simple inline entry analysis
    const quality = Math.floor(50 + Math.random() * 50);
    const rsi = Math.floor(30 + Math.random() * 50);
    const momentum = (Math.random() - 0.3) * 2;
    const shouldEnter = quality >= this.config.minQuality && rsi < 70 && momentum > 0;

    const entryAnalysis = {
      shouldEnter,
      analysis: { quality, rsi, momentum, trend: momentum > 0 ? 'bullish' : 'bearish', volatility: Math.random() * 0.3 },
      reasoning: shouldEnter ? `Quality ${quality}%, RSI ${rsi}, Momentum positive` : `Quality ${quality}% below threshold`,
      positionSize: this.config.basePositionSize,
      stopLoss: { price: tokenMarketData.currentPrice * (1 - this.config.stopLossPct / 100), percentage: this.config.stopLossPct },
      takeProfitTargets: {
        target1: { price: tokenMarketData.currentPrice * 1.05, percentage: 5 },
        target2: { price: tokenMarketData.currentPrice * 1.10, percentage: 10 },
        target3: { price: tokenMarketData.currentPrice * 1.15, percentage: 15 }
      }
    };

    // Determine scan decision
    let decision = 'skipped';
    let reason = entryAnalysis.reasoning;

    if (this.openPositions.length >= this.config.maxPositions) {
      decision = 'skipped_max_positions';
      reason = `Max positions reached (${this.openPositions.length}/${this.config.maxPositions})`;
    } else if (entryAnalysis.shouldEnter) {
      decision = 'high_quality';
      if (Math.random() < 0.80) {
        decision = 'entered';
      }
    } else if (quality < this.config.minQuality) {
      decision = 'skipped_low_quality';
    } else if (rsi > 75) {
      decision = 'skipped_overbought';
    }

    // Emit detailed scan event for DEX Activity Scanner
    this._emit('scan', {
      scanCount: this.scanCount,
      token: token.symbol,
      quality: entryAnalysis.analysis.quality,
      rsi: entryAnalysis.analysis.rsi,
      momentum: entryAnalysis.analysis.momentum,
      trend: entryAnalysis.analysis.trend,
      volatility: entryAnalysis.analysis.volatility,
      decision,
      reason,
      timestamp: new Date().toISOString()
    });

    // Check if we can open new positions
    if (this.openPositions.length >= this.config.maxPositions) {
      return; // Max positions reached
    }

    // Simulate signal detection (10% chance per scan)
    if (Math.random() < 0.10 && entryAnalysis.shouldEnter) {
      this.signalsDetected++;

      this._emit('signal', {
        token: token.symbol,
        analysis: entryAnalysis.analysis,
        reasoning: entryAnalysis.reasoning,
        timestamp: new Date().toISOString()
      });

      this._emit('strategy', {
        type: 'ENTRY_ANALYSIS',
        token: token.symbol,
        decision: 'ENTER',
        reasoning: entryAnalysis.reasoning,
        stopLoss: entryAnalysis.stopLoss,
        takeProfitTargets: entryAnalysis.takeProfitTargets
      });

      // Execute trade (80% of high-quality signals)
      if (Math.random() < 0.80) {
        this._executeTrade(token, entryAnalysis);
      }
    }
  }

  _getRandomToken() {
    return this.trendingTokens[Math.floor(Math.random() * this.trendingTokens.length)];
  }

  _getTokenMarketData(token) {
    const marketData = this.tokenMarketData[token.symbol];
    return {
      symbol: token.symbol,
      address: token.address,
      currentPrice: marketData.currentPrice,
      currentVolume: marketData.currentVolume,
      priceHistory: [...marketData.priceHistory],
      volumeHistory: [...marketData.volumeHistory]
    };
  }

  _executeTrade(token, entryAnalysis) {
    // Get current market price
    const marketData = this.tokenMarketData[token.symbol];
    const entryPrice = marketData.currentPrice * (1 + (Math.random() * 0.002 - 0.001)); // ±0.1% slippage
    const positionSize = entryAnalysis.positionSize;
    const quantity = positionSize / entryPrice;

    // Select random DEX for simulated trading
    const dexOptions = ['Raydium', 'Orca', 'Jupiter', 'Phoenix'];
    const selectedDEX = dexOptions[Math.floor(Math.random() * dexOptions.length)];

    // Calculate fees (0.25% entry fee for most Solana DEXs)
    const entryFee = positionSize * 0.0025;

    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.agentId,
      token: token.symbol,
      tokenAddress: token.address,
      side: 'BUY',
      status: 'OPEN',
      entryPrice,
      quantity,
      positionSize,
      entryTime: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      entryTimestamp: Date.now(),

      // DEX and Fee Information
      dex: selectedDEX,
      entryFee,
      exitFee: 0, // Will be calculated on exit
      totalFees: entryFee,
      dexScreenerUrl: `https://dexscreener.com/solana/${token.address}`,

      // Strategy-determined values
      stopLoss: entryAnalysis.stopLoss,
      takeProfitTargets: entryAnalysis.takeProfitTargets,
      analysis: entryAnalysis.analysis,
      entryReasoning: entryAnalysis.reasoning, // Renamed for clarity
      reasoning: entryAnalysis.reasoning, // Keep for backward compatibility
      exitReasoning: null, // Will be set on exit
      strategyUsed: 'Intelligent Dynamic Strategy', // Strategy name
      partialExits: {},

      // Simulate if this will be a winning trade
      _willWin: Math.random() < this.config.targetWinRate,
      _targetHoldTime: this.config.avgHoldTime * (0.5 + Math.random()),
      _baseToken: token
    };

    this.openPositions.push(trade);
    this.tradesExecuted++;
    this.trades.push(trade);

    // Save open positions to persist across sessions
    this._saveOpenPositions();

    console.log(`✅ TRADE EXECUTED: BUY ${trade.quantity.toFixed(4)} ${trade.token} @ $${entryPrice.toFixed(6)}`);
    console.log(`   Strategy: ${trade.reasoning}`);
    console.log(`   Stop Loss: $${trade.stopLoss.price.toFixed(6)} (-${trade.stopLoss.percentage.toFixed(2)}%)`);
    console.log(`   Targets: ${trade.takeProfitTargets.target1.percentage}% / ${trade.takeProfitTargets.target2.percentage}%${trade.takeProfitTargets.target3 ? ' / ' + trade.takeProfitTargets.target3.percentage + '%' : ''}`);

    this._emit('trade', { ...trade, isNew: true });
    this._emit('position', { open: this.openPositions.length, max: this.config.maxPositions });
  }

  _checkPositions() {
    if (!this.isRunning || this.openPositions.length === 0) return;

    this.openPositions.forEach(position => {
      const currentMarketData = this._getTokenMarketData(position._baseToken);
      currentMarketData.currentPrice = this._simulatePrice(position, currentMarketData.currentPrice);

      // Simple inline exit logic
      const pnlPct = ((currentMarketData.currentPrice - position.entryPrice) / position.entryPrice) * 100;
      let exitDecision = { shouldExit: false, exitType: 'HOLD', reasoning: 'Monitoring position' };

      if (pnlPct >= this.config.takeProfitPct) {
        exitDecision = { shouldExit: true, exitType: 'TAKE_PROFIT', reasoning: `Take profit hit: ${pnlPct.toFixed(2)}%` };
      } else if (pnlPct <= -this.config.stopLossPct) {
        exitDecision = { shouldExit: true, exitType: 'STOP_LOSS', reasoning: `Stop loss hit: ${pnlPct.toFixed(2)}%` };
      } else if (Date.now() - position.entryTimestamp > position._targetHoldTime * 1.5) {
        exitDecision = { shouldExit: true, exitType: 'TIME_EXIT', reasoning: 'Max hold time exceeded' };
      }

      if (exitDecision.shouldExit) {
        this._closePosition(position, exitDecision.exitType, currentMarketData.currentPrice, exitDecision.reasoning);
      }
    });
  }

  _simulatePrice(position, currentMarketPrice) {
    const holdTime = Date.now() - position.entryTimestamp;
    const progress = Math.min(holdTime / position._targetHoldTime, 1);

    if (position._willWin) {
      // Winning trade: move towards first take profit target
      const target = position.takeProfitTargets.target1.price;
      const noise = (Math.random() * 0.02 - 0.01); // ±1% noise
      return position.entryPrice + (target - position.entryPrice) * progress + (position.entryPrice * noise);
    } else {
      // Losing trade: move towards stop loss
      const target = position.stopLoss.price;
      const noise = (Math.random() * 0.01 - 0.005); // ±0.5% noise
      return position.entryPrice + (target - position.entryPrice) * progress + (position.entryPrice * noise);
    }
  }

  _partialExit(position, exitType, currentPrice, sellAmount) {
    const pnl = (currentPrice - position.entryPrice) * position.quantity * sellAmount;
    const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    console.log(`📊 PARTIAL EXIT (${(sellAmount * 100).toFixed(0)}%): ${position.token} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) | ${exitType}`);

    // Mark this target as hit
    if (exitType === 'TAKE_PROFIT_1') position.partialExits.target1 = true;
    if (exitType === 'TAKE_PROFIT_2') position.partialExits.target2 = true;

    // Reduce position size
    position.quantity *= (1 - sellAmount);
    position.positionSize *= (1 - sellAmount);
  }

  _closePosition(position, reason, exitPrice = null, reasoning = '') {
    if (!exitPrice) {
      const marketData = this._getTokenMarketData(position._baseToken);
      exitPrice = marketData.currentPrice;
    }

    // Calculate exit fee (0.25% of exit value)
    const exitValue = exitPrice * position.quantity;
    const exitFee = exitValue * 0.0025;
    const totalFees = position.entryFee + exitFee;

    // Calculate P&L (after fees)
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
    const pnl = grossPnl - exitFee; // Net P&L after exit fee (entry fee already deducted from position size)
    const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

    // Update trade
    const closedTrade = {
      ...position,
      status: 'CLOSED',
      exitPrice,
      exitTime: new Date().toISOString(),
      grossPnl, // P&L before fees
      pnl, // P&L after fees
      pnlPercent: pnlPct,
      pnlPct, // Keep for backward compatibility
      exitFee,
      totalFees,
      exitReason: reason,
      exitReasoning: reasoning,
      holdTime: Date.now() - position.entryTimestamp
    };

    // Remove from open positions
    const index = this.openPositions.findIndex(p => p.id === position.id);
    if (index > -1) {
      this.openPositions.splice(index, 1);

      // Save updated open positions
      this._saveOpenPositions();
    }

    // Update in trades array
    const tradeIndex = this.trades.findIndex(t => t.id === position.id);
    if (tradeIndex > -1) {
      this.trades[tradeIndex] = closedTrade;
    }

    console.log(`🔒 POSITION CLOSED: ${closedTrade.token} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) | ${reason}`);
    if (reasoning) {
      console.log(`   Reasoning: ${reasoning}`);
    }

    this._emit('trade', { ...closedTrade, isClosed: true });
    this._emit('position', { open: this.openPositions.length, max: this.config.maxPositions });
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Save open positions to localStorage
   * This allows positions to persist even when agent is stopped
   */
  _saveOpenPositions() {
    try {
      const storageKey = `openPositions_${this.agentId}`;
      localStorage.setItem(storageKey, JSON.stringify(this.openPositions));
      console.log(`💾 Saved ${this.openPositions.length} open positions to storage`);
    } catch (error) {
      console.error('Error saving open positions:', error);
    }
  }

  /**
   * Load open positions from localStorage
   * Called when agent starts to resume monitoring open trades
   */
  _loadOpenPositions() {
    try {
      const storageKey = `openPositions_${this.agentId}`;
      const savedPositions = localStorage.getItem(storageKey);

      if (savedPositions) {
        const positions = JSON.parse(savedPositions);

        // Enforce max positions when loading from storage
        if (positions.length > this.config.maxPositions) {
          console.warn(`⚠️ Loaded ${positions.length} positions but max is ${this.config.maxPositions}, closing excess positions`);
          // Keep only the most recent positions up to max
          this.openPositions = positions.slice(0, this.config.maxPositions);
          // Save the trimmed list
          this._saveOpenPositions();
        } else {
          this.openPositions = positions;
        }

        console.log(`📂 Loaded ${this.openPositions.length} open positions from storage`);

        // Emit position event to update UI
        this._emit('position', { open: this.openPositions.length, max: this.config.maxPositions });

        return this.openPositions.length;
      }
      return 0;
    } catch (error) {
      console.error('Error loading open positions:', error);
      return 0;
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    };
  }

  getStats() {
    const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl <= 0);
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

    return {
      scanCount: this.scanCount,
      signalsDetected: this.signalsDetected,
      tradesExecuted: this.tradesExecuted,
      openPositions: this.openPositions.length,
      closedTrades: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalPnL,
      avgPnL: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0
    };
  }

  getTrades() {
    return [...this.trades];
  }

  getOpenPositions() {
    return [...this.openPositions];
  }
}

export default MarketDataSimulator;
