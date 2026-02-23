import React from 'react';

const ShareCard = ({ analytics, timeframe, botName, signalProvider, filteredTrades }) => {
  const timeframeLabels = {
    '7D': 'Last 7 Days',
    '30D': 'Last 30 Days',
    '90D': 'Last 90 Days',
    '1Y': 'Last Year',
    'ALL': 'All Time',
  };

  const isProfit = analytics.totalPnL >= 0;

  // Format number with commas
  const formatNumber = (num) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-[600px] h-[600px] relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #0d0d0d 100%)' }}>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute top-0 left-0 w-full h-full"
             style={{
               backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
               backgroundSize: '40px 40px'
             }}>
        </div>
      </div>

      {/* Gradient Orbs */}
      <div className="absolute -top-12 -right-12 w-[300px] h-[300px] rounded-full opacity-15 blur-[50px]"
           style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }}></div>
      <div className="absolute -bottom-12 -left-12 w-[220px] h-[220px] rounded-full opacity-[0.08] blur-[40px]"
           style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }}></div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-extrabold text-white tracking-tight"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                  textShadow: '0 2px 8px rgba(0, 212, 255, 0.15)'
                }}>
              {botName}
            </h1>
            <div className="flex items-center justify-center px-4 rounded-[14px] text-[10px] font-bold border-[1.5px] uppercase tracking-wider"
                 style={{
                   background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 212, 255, 0.15) 100%)',
                   color: '#00e5ff',
                   borderColor: 'rgba(0, 212, 255, 0.4)',
                   boxShadow: '0 2px 8px rgba(0, 212, 255, 0.2)',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                   lineHeight: '1',
                   height: '28px'
                 }}>
              SIMULATION MODE
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#b0b6c0] text-sm font-semibold"
               style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
            <span>📅</span>
            <span>{timeframeLabels[timeframe]}</span>
          </div>
        </div>

        {/* P&L Card */}
        <div className="mb-3 px-5 py-4 rounded-[18px] border-2"
             style={{
               background: isProfit
                 ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.08) 100%)'
                 : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
               borderColor: isProfit ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
               boxShadow: isProfit
                 ? '0 4px 16px rgba(34, 197, 94, 0.1)'
                 : '0 4px 16px rgba(239, 68, 68, 0.1)'
             }}>
          <div className="text-xs font-bold uppercase tracking-wide text-center"
               style={{
                 color: isProfit ? '#a8e6a1' : '#fca5a5',
                 fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
               }}>
            Total Profit & Loss
          </div>
          <div className="flex items-center justify-center mb-6 mt-1">
            <span className="text-6xl font-black leading-none"
                  style={{
                    color: isProfit ? '#22c55e' : '#ef4444',
                    letterSpacing: '-2px',
                    textShadow: isProfit
                      ? '0 2px 12px rgba(34, 197, 94, 0.3)'
                      : '0 2px 12px rgba(239, 68, 68, 0.3)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                  }}>
              {isProfit ? '+' : ''}${formatNumber(analytics.totalPnL || 0)}
            </span>
          </div>
          <div className="text-center text-sm text-[#e0e4e8] font-semibold"
               style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
            {filteredTrades.length} {filteredTrades.length === 1 ? 'Trade' : 'Trades'} Executed
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Win Rate */}
          <div className="rounded-[14px] border px-4 py-3 flex flex-col"
               style={{
                 background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.7) 0%, rgba(31, 41, 55, 0.5) 100%)',
                 backdropFilter: 'blur(20px)',
                 borderColor: 'rgba(75, 85, 99, 0.4)',
                 boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
               }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2"
                 style={{
                   color: '#b8c5d6',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Win Rate
            </div>
            <div className="text-3xl font-extrabold text-white mb-1"
                 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
              {analytics.winRate?.toFixed(1) || 0}%
            </div>
            <div className="text-[11px] font-medium"
                 style={{
                   color: '#a0aab8',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              {analytics.wins}W / {analytics.losses}L
            </div>
          </div>

          {/* Profit Factor */}
          <div className="rounded-[14px] border px-4 py-3 flex flex-col"
               style={{
                 background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.7) 0%, rgba(31, 41, 55, 0.5) 100%)',
                 backdropFilter: 'blur(20px)',
                 borderColor: 'rgba(75, 85, 99, 0.4)',
                 boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
               }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2"
                 style={{
                   color: '#b8c5d6',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Profit Factor
            </div>
            <div className="text-3xl font-extrabold text-white mb-1"
                 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
              {analytics.profitFactor?.toFixed(2) || '0.00'}
            </div>
            <div className="text-[11px] font-medium"
                 style={{
                   color: '#a0aab8',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              {analytics.profitFactor >= 2 ? 'Excellent' : analytics.profitFactor >= 1.5 ? 'Good' : analytics.profitFactor >= 1 ? 'Marginal' : 'Poor'}
            </div>
          </div>

          {/* Best Trade */}
          <div className="rounded-[14px] border px-4 py-3 flex flex-col"
               style={{
                 background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.7) 0%, rgba(31, 41, 55, 0.5) 100%)',
                 backdropFilter: 'blur(20px)',
                 borderColor: 'rgba(75, 85, 99, 0.4)',
                 boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
               }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2"
                 style={{
                   color: '#b8c5d6',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Best Trade
            </div>
            <div className="text-3xl font-extrabold mb-1"
                 style={{
                   color: '#22c55e',
                   textShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              +${formatNumber(analytics.largestWin || 0)}
            </div>
            <div className="text-[11px] font-medium"
                 style={{
                   color: '#a0aab8',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Largest Win
            </div>
          </div>

          {/* Average Win */}
          <div className="rounded-[14px] border px-4 py-3 flex flex-col"
               style={{
                 background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.7) 0%, rgba(31, 41, 55, 0.5) 100%)',
                 backdropFilter: 'blur(20px)',
                 borderColor: 'rgba(75, 85, 99, 0.4)',
                 boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
               }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2"
                 style={{
                   color: '#b8c5d6',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Average Win
            </div>
            <div className="text-3xl font-extrabold text-white mb-1"
                 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
              ${formatNumber(analytics.avgWin || 0)}
            </div>
            <div className="text-[11px] font-medium"
                 style={{
                   color: '#a0aab8',
                   fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                 }}>
              Per Winning Trade
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t mt-auto" style={{ borderColor: 'rgba(75, 85, 99, 0.3)' }}>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
                   style={{
                     color: '#b8c5d6',
                     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                   }}>
                Performance Metrics
              </div>
              <div className="text-[10px] font-medium"
                   style={{
                     color: '#a0aab8',
                     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                   }}>
                <span style={{ color: '#d1d8e0', fontWeight: 600 }}>Sharpe:</span> {analytics.sharpeRatio?.toFixed(2) || '0.00'}
                <span className="mx-1.5">•</span>
                <span style={{ color: '#d1d8e0', fontWeight: 600 }}>Max DD:</span> {analytics.maxDrawdownPercent?.toFixed(2) || '0.00'}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide mb-0.5"
                   style={{
                     color: '#00d4ff',
                     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                   }}>
                Trading Bot Dashboard
              </div>
              <div className="text-[10px] font-medium"
                   style={{
                     color: '#7a8594',
                     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
                   }}>
                Signals by {signalProvider || 'nexgent.ai'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;
