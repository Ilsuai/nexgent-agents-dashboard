import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import Modal from '../common/Modal';

// KPI Explanations Database
const KPI_EXPLANATIONS = {
  'Portfolio Balance': {
    description: 'Your current total portfolio value including all open and closed positions.',
    formula: 'Starting Balance + Total Realized P&L + Unrealized P&L',
    interpretation: 'This shows your overall account value at the current moment. A positive trend indicates growth.',
  },
  'Total P&L': {
    description: 'Total Profit and Loss - the sum of all your realized gains and losses from closed trades.',
    formula: 'Sum of all (Exit Price - Entry Price) × Quantity for closed trades',
    interpretation: 'Positive P&L means your trading strategy is profitable. This excludes unrealized gains from open positions.',
  },
  'Win Rate': {
    description: 'The percentage of trades that resulted in a profit.',
    formula: '(Number of Winning Trades / Total Closed Trades) × 100',
    interpretation: 'A higher win rate (>50%) is generally positive, but should be considered alongside average win/loss size.',
  },
  'Total Trades': {
    description: 'The total number of completed trades executed by your bot.',
    formula: 'Count of all trades with status = CLOSED',
    interpretation: 'More trades provide better statistical significance for your strategy performance.',
  },
  'Sharpe Ratio': {
    description: 'Risk-adjusted return metric that measures excess return per unit of risk.',
    formula: '(Average Return - Risk Free Rate) / Standard Deviation of Returns',
    interpretation: '>1.0 is good, >2.0 is very good, >3.0 is excellent. Higher values indicate better risk-adjusted performance.',
  },
  'Max Drawdown': {
    description: 'The largest peak-to-trough decline in portfolio value.',
    formula: 'Maximum of [(Peak Value - Trough Value) / Peak Value × 100]',
    interpretation: 'Lower is better. Shows the worst loss you experienced. Important for risk management and position sizing.',
  },
  'Profit Factor': {
    description: 'Ratio of gross profit to gross loss.',
    formula: 'Sum of All Winning Trades / Sum of All Losing Trades',
    interpretation: '>1.0 means profitable overall. 1.5-2.0 is good, >2.0 is excellent. Shows how much you make per dollar lost.',
  },
  'Avg Win / Loss': {
    description: 'Average profit from winning trades vs average loss from losing trades.',
    formula: '(Total Winning P&L / Number of Wins) / (Total Losing P&L / Number of Losses)',
    interpretation: 'Ideally, average wins should be larger than average losses. This is key to long-term profitability.',
  },
  'Expectancy': {
    description: 'Average amount you can expect to win or lose per trade.',
    formula: '(Win Rate × Avg Win) - (Loss Rate × Avg Loss)',
    interpretation: 'Positive expectancy means your strategy is profitable long-term. Higher is better.',
  },
  'Best Trade': {
    description: 'Your largest single winning trade.',
    interpretation: 'Shows maximum upside potential. Should not be an outlier - consistent wins are better than one lucky trade.',
  },
  'Worst Trade': {
    description: 'Your largest single losing trade.',
    interpretation: 'Important for risk management. If too large relative to account size, consider better position sizing or stop losses.',
  },
  'Avg Trade Duration': {
    description: 'Average time your trades remain open.',
    interpretation: 'Helps classify your strategy (scalping: <5min, day trading: <1 day, swing: days-weeks).',
  },
};

const StatCard = ({
  title,
  value,
  subtext,
  trend,
  isMoney = false,
  isPercentage = false,
  tooltip = null,
  format = 'default', // 'money', 'percent', 'decimal', 'default'
  detailData = null, // Additional data for expanded view
  onCardClick = null, // Optional custom click handler
  detailViewContent = null, // Custom content for detail modal
}) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const formatValue = () => {
    if (isMoney || format === 'money') return `$${value}`;
    if (isPercentage || format === 'percent') return `${value}%`;
    return value;
  };

  const explanation = KPI_EXPLANATIONS[title];

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick();
    } else {
      setShowDetailModal(true);
    }
  };

  const handleInfoClick = (e) => {
    e.stopPropagation(); // Prevent card click
    setShowInfoModal(true);
  };

  return (
    <>
      <div
        className="glass-card p-5 relative overflow-hidden group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-accent/30"
        onClick={handleCardClick}
      >
        <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-20 transition-opacity duration-500">
          <div className="w-20 h-20 bg-accent rounded-full blur-2xl"></div>
        </div>

        <div className="flex justify-between items-start mb-2">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{title}</p>
          {explanation && (
            <button
              onClick={handleInfoClick}
              className="text-gray-500 hover:text-accent transition-colors z-10"
              title="Click for detailed explanation"
            >
              <Info size={14} />
            </button>
          )}
        </div>

      <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
        {formatValue()}
      </h3>

      <div className="flex items-center space-x-2">
        {trend !== undefined && trend !== null && (
          <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
            trend > 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}>
            {trend > 0 ? <ArrowUpRight size={12} className="mr-1"/> : <ArrowDownRight size={12} className="mr-1"/>}
            {Math.abs(trend).toFixed(2)}%
          </span>
        )}
        {subtext && <span className="text-xs text-gray-500">{subtext}</span>}
      </div>
    </div>

      {/* Info Modal - Brief Explanation */}
      <Modal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} title={`ℹ️ ${title}`}>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="text-accent font-semibold mb-1">Description</h4>
            <p className="text-gray-300">{explanation?.description}</p>
          </div>

          {explanation?.formula && (
            <div>
              <h4 className="text-accent font-semibold mb-1">Formula</h4>
              <p className="text-gray-300 font-mono text-xs bg-dark-900 p-2 rounded">
                {explanation.formula}
              </p>
            </div>
          )}

          <div>
            <h4 className="text-accent font-semibold mb-1">Interpretation</h4>
            <p className="text-gray-300">{explanation?.interpretation}</p>
          </div>

          <div className="pt-3 border-t border-dark-700">
            <p className="text-xs text-gray-500 italic">
              💡 Click on the card itself to see detailed analytics and historical trends
            </p>
          </div>
        </div>
      </Modal>

      {/* Detail Modal - Expanded View */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`📊 ${title} - Detailed View`}>
        {detailViewContent ? (
          // Custom detail view content
          detailViewContent
        ) : (
          // Default detail view
          <div className="space-y-6">
            {/* Current Value */}
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400 mb-1">Current Value</p>
              <p className="text-3xl font-bold text-white">{formatValue()}</p>
              {trend !== undefined && trend !== null && (
                <p className={`text-sm mt-2 ${trend > 0 ? 'text-success' : 'text-danger'}`}>
                  {trend > 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(2)}% from last period
                </p>
              )}
            </div>

            {/* Additional Details */}
            {detailData && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(detailData).map(([key, val]) => (
                  <div key={key} className="bg-dark-900 p-3 rounded-lg border border-dark-700">
                    <p className="text-xs text-gray-400 mb-1">{key}</p>
                    <p className="text-lg font-semibold text-white">{val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {explanation && (
              <div>
                <h4 className="text-accent font-semibold mb-2">What This Means</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{explanation.description}</p>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">{explanation.interpretation}</p>
              </div>
            )}

            {/* Historical Context */}
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <h4 className="text-accent font-semibold mb-2">💡 Key Insights</h4>
              <ul className="text-sm text-gray-300 space-y-2">
                {title === 'Portfolio Balance' && detailData && (
                  <>
                    <li>• Starting balance: {detailData['Starting Balance']}</li>
                    <li>• Total return: {detailData['Total Return']}</li>
                    <li>• Track your progress toward financial goals</li>
                  </>
                )}
                {title === 'Win Rate' && (
                  <>
                    <li>• Industry average: 50-60%</li>
                    <li>• {parseFloat(value) >= 50 ? '✓ Above average' : '⚠ Below average - review strategy'}</li>
                    <li>• Win rate alone doesn't guarantee profitability</li>
                  </>
                )}
                {title === 'Sharpe Ratio' && (
                  <>
                    <li>• &gt;1.0 = Good risk-adjusted returns</li>
                    <li>• &gt;2.0 = Very good performance</li>
                    <li>• &gt;3.0 = Excellent performance</li>
                    <li>• Your rating: {parseFloat(value) >= 2 ? '🌟 Very Good' : parseFloat(value) >= 1 ? '✓ Good' : '⚠ Needs Improvement'}</li>
                  </>
                )}
                {title === 'Max Drawdown' && (
                  <>
                    <li>• Lower is better (less risk)</li>
                    <li>• Use this for position sizing</li>
                    <li>• Can you handle a loss of this size?</li>
                  </>
                )}
                {title === 'Profit Factor' && (
                  <>
                    <li>• 1.0 = Break even</li>
                    <li>• 1.5-2.0 = Good strategy</li>
                    <li>• &gt;2.0 = Excellent strategy</li>
                    <li>• Your rating: {parseFloat(value) >= 2 ? '🌟 Excellent' : parseFloat(value) >= 1.5 ? '✓ Good' : parseFloat(value) >= 1 ? '⚠ Marginal' : '❌ Losing'}</li>
                  </>
                )}
                {!['Portfolio Balance', 'Win Rate', 'Sharpe Ratio', 'Max Drawdown', 'Profit Factor'].includes(title) && (
                  <li>• Monitor this metric regularly for strategy optimization</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default StatCard;
