import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

const TradeNotification = ({ trade, agent, onClose, onClick, autoCloseDuration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close timer
    if (autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [autoCloseDuration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const handleClick = () => {
    if (onClick) {
      onClick(trade);
    }
    handleClose();
  };

  const isProfitable = trade.pnl >= 0;

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        onClick={handleClick}
        className={`
          bg-gray-800 border-l-4 rounded-lg shadow-2xl overflow-hidden
          cursor-pointer hover:shadow-3xl transition-shadow
          ${isProfitable ? 'border-green-500' : 'border-red-500'}
        `}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isProfitable ? (
              <TrendingUp className="text-green-400" size={18} />
            ) : (
              <TrendingDown className="text-red-400" size={18} />
            )}
            <span className="text-sm font-semibold text-white">New Trade</span>
            {agent && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                {agent.name}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-white font-bold text-lg">{trade.token || trade.tokenSymbol}</div>
              <div className="text-xs text-gray-400">
                {trade.side} • {trade.status}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '+' : ''}${trade.pnl?.toFixed(2)}
              </div>
              <div className={`text-xs ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Trade Details */}
          <div className="grid grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-gray-700">
            <div>
              <div className="text-gray-400">Entry Price</div>
              <div className="text-white font-mono">${trade.entryPrice?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-gray-400">Exit Price</div>
              <div className="text-white font-mono">${trade.exitPrice?.toFixed(4)}</div>
            </div>
          </div>
        </div>

        {/* Progress Bar (auto-close indicator) */}
        {autoCloseDuration > 0 && (
          <div className="h-1 bg-gray-900">
            <div
              className={`h-full ${isProfitable ? 'bg-green-500' : 'bg-red-500'} transition-all ease-linear`}
              style={{
                animation: `shrink ${autoCloseDuration}ms linear`,
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

// Container component to manage multiple notifications
export const TradeNotificationContainer = ({ notifications, onRemove, onNotificationClick }) => {
  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-3 pointer-events-none">
      <div className="space-y-3 pointer-events-auto">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{
              transform: `translateY(${index * 10}px)`,
            }}
          >
            <TradeNotification
              trade={notification.trade}
              agent={notification.agent}
              onClose={() => onRemove(notification.id)}
              onClick={() => onNotificationClick && onNotificationClick(notification.trade)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradeNotification;
