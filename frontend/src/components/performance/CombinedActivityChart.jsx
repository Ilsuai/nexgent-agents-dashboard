import React from 'react';
import { Activity, TrendingUp, Zap, Clock } from 'lucide-react';

/**
 * Combined Activity Chart
 * Displays agent activity metrics in a visual format
 */
const CombinedActivityChart = ({ agentStatus }) => {
  const stats = agentStatus?.stats || {};
  const tokensScanned = stats.tokens_scanned || 0;
  const signalsGenerated = stats.signals_generated || 0;
  const tradesExecuted = stats.trades_executed || 0;
  const winRate = stats.winning_trades && stats.trades_executed
    ? Math.round((stats.winning_trades / (stats.winning_trades + stats.losing_trades)) * 100)
    : 0;

  const metrics = [
    {
      label: 'Tokens Scanned',
      value: tokensScanned,
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      barColor: 'bg-blue-400'
    },
    {
      label: 'Signals Generated',
      value: signalsGenerated,
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      barColor: 'bg-yellow-400'
    },
    {
      label: 'Trades Executed',
      value: tradesExecuted,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      barColor: 'bg-green-400'
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      icon: Clock,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      barColor: 'bg-purple-400',
      isPercentage: true
    }
  ];

  // Calculate max for bar scaling (excluding percentage)
  const maxValue = Math.max(tokensScanned, signalsGenerated, tradesExecuted, 1);

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="text-blue-400" size={20} />
        Agent Activity
      </h3>

      <div className="space-y-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const barWidth = metric.isPercentage
            ? winRate
            : Math.round((metric.value / maxValue) * 100);

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${metric.bgColor}`}>
                    <Icon className={metric.color} size={14} />
                  </div>
                  <span className="text-sm text-gray-400">{metric.label}</span>
                </div>
                <span className={`text-sm font-semibold ${metric.color}`}>
                  {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                </span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${metric.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(barWidth, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {agentStatus?.running && (
        <div className="mt-4 pt-4 border-t border-dark-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-400">Agent Active</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedActivityChart;
