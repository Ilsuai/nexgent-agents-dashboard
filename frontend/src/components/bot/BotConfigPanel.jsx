import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Sliders, DollarSign, Target, Shield, TrendingUp, Save, RotateCcw } from 'lucide-react';
import { useAgentManagement } from '../../context/AgentManagementContext';

// Default config constant (outside component to prevent recreation)
const DEFAULT_CONFIG = {
  // Scanning
  scanInterval: 1, // seconds - CONSTANT SCANNING
  maxTokensPerScan: 50,

  // Trading
  positionSizeUsd: 25,
  maxPositions: 3,
  takeProfitPct: 15,
  stopLossPct: 8,

  // Filters
  minRiskScore: 70,
  minQualityScore: 70,
  minMarketCap: 50000,
  maxMarketCap: 1000000000, // Default 1B to not limit trades
  minLiquidity: 10000,

  // Features
  autoTrading: false,
  paperTrading: true
};

/**
 * Bot Configuration Panel
 * Allows adjusting trading bot parameters:
 * - Scan interval
 * - Position size
 * - Take profit / Stop loss
 * - Risk filters
 * - Max positions
 */
const BotConfigPanel = ({ onSave }) => {
  const { selectedAgent, updateAgentTradingConfig } = useAgentManagement();

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Load config from selected agent when it changes
  useEffect(() => {
    if (selectedAgent && selectedAgent.tradingConfig) {
      setConfig({ ...DEFAULT_CONFIG, ...selectedAgent.tradingConfig });
      setHasChanges(false);
    }
  }, [selectedAgent?.id]);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedAgent) {
      console.warn('No agent selected');
      return;
    }

    // Update the agent's trading config
    updateAgentTradingConfig(selectedAgent.id, config);

    // Call parent callback if provided
    if (onSave) {
      onSave(config);
    }

    setHasChanges(false);
    console.log('✅ Trading config saved:', config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(false);
  };

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sliders className="text-accent" size={20} />
          Bot Configuration
        </h3>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-dark-900 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-1 transition-colors ${
              hasChanges
                ? 'bg-accent text-white hover:bg-accent-dark'
                : 'bg-dark-900 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Scanning Settings */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Target size={16} className="text-blue-400" />
            Scanning Settings
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Scan Interval (seconds)
              </label>
              <input
                type="number"
                value={config.scanInterval}
                onChange={(e) => handleChange('scanInterval', parseInt(e.target.value))}
                min="1"
                max="10"
                step="1"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Set to 1 for constant scanning (recommended for active trading)
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Max Tokens Per Scan
              </label>
              <input
                type="number"
                value={config.maxTokensPerScan}
                onChange={(e) => handleChange('maxTokensPerScan', parseInt(e.target.value))}
                min="10"
                max="100"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Trading Parameters */}
        <div className="pt-6 border-t border-dark-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign size={16} className="text-green-400" />
            Trading Parameters
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Position Size (USD)
              </label>
              <input
                type="number"
                value={config.positionSizeUsd}
                onChange={(e) => handleChange('positionSizeUsd', parseFloat(e.target.value))}
                min="10"
                max="1000"
                step="5"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Max Positions
              </label>
              <input
                type="number"
                value={config.maxPositions}
                onChange={(e) => handleChange('maxPositions', parseInt(e.target.value))}
                min="1"
                max="10"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Take Profit (%)
              </label>
              <input
                type="number"
                value={config.takeProfitPct}
                onChange={(e) => handleChange('takeProfitPct', parseFloat(e.target.value))}
                min="5"
                max="100"
                step="1"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Stop Loss (%)
              </label>
              <input
                type="number"
                value={config.stopLossPct}
                onChange={(e) => handleChange('stopLossPct', parseFloat(e.target.value))}
                min="1"
                max="50"
                step="1"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Risk Filters */}
        <div className="pt-6 border-t border-dark-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Shield size={16} className="text-yellow-400" />
            Risk Filters
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Min Risk Score (0-100)
              </label>
              <input
                type="range"
                value={config.minRiskScore}
                onChange={(e) => handleChange('minRiskScore', parseInt(e.target.value))}
                min="0"
                max="100"
                className="w-full"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">Lower = More risky</span>
                <span className="text-sm font-semibold text-accent">{config.minRiskScore}</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Min Quality Score (0-100)
              </label>
              <input
                type="range"
                value={config.minQualityScore}
                onChange={(e) => handleChange('minQualityScore', parseInt(e.target.value))}
                min="0"
                max="100"
                className="w-full"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">Lower = More signals</span>
                <span className="text-sm font-semibold text-accent">{config.minQualityScore}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Min Market Cap
                </label>
                <input
                  type="number"
                  value={config.minMarketCap}
                  onChange={(e) => handleChange('minMarketCap', parseInt(e.target.value))}
                  min="0"
                  step="10000"
                  className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Max Market Cap
                </label>
                <input
                  type="number"
                  value={config.maxMarketCap}
                  onChange={(e) => handleChange('maxMarketCap', parseInt(e.target.value))}
                  min="0"
                  step="100000"
                  className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Min Liquidity (USD)
              </label>
              <input
                type="number"
                value={config.minLiquidity}
                onChange={(e) => handleChange('minLiquidity', parseInt(e.target.value))}
                min="0"
                step="1000"
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Trading Mode */}
        <div className="pt-6 border-t border-dark-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-400" />
            Trading Mode
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-dark-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">Auto Trading</p>
                <p className="text-xs text-gray-400">Automatically execute trades when signals are detected</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoTrading}
                onChange={(e) => handleChange('autoTrading', e.target.checked)}
                className="w-5 h-5 text-accent bg-dark-700 border-dark-600 rounded focus:ring-accent focus:ring-2"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-dark-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">Paper Trading</p>
                <p className="text-xs text-gray-400">Simulate trades without real money</p>
              </div>
              <input
                type="checkbox"
                checked={config.paperTrading}
                onChange={(e) => handleChange('paperTrading', e.target.checked)}
                className="w-5 h-5 text-accent bg-dark-700 border-dark-600 rounded focus:ring-accent focus:ring-2"
              />
            </label>
          </div>
        </div>

        {/* Warning if live trading */}
        {!config.paperTrading && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Live Trading Mode</p>
            <p className="text-xs text-red-300">
              Real money will be used for trades. Make sure you understand the risks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotConfigPanel;
