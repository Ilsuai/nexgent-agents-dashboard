import React, { useState } from 'react';

const AgentStatusBadge = ({
  agent,
  showLabel = true,
  showTooltip = true,
  size = 'md' // 'sm', 'md', 'lg'
}) => {
  const [showTooltipState, setShowTooltipState] = useState(false);

  // Get status details
  const getStatusInfo = () => {
    if (!agent.enabled) {
      return {
        color: 'bg-gray-500',
        label: 'Disabled',
        textColor: 'text-gray-400',
        borderColor: 'border-gray-500',
      };
    }

    switch (agent.connectionStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          label: 'Connected',
          textColor: 'text-green-400',
          borderColor: 'border-green-500',
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          label: 'Disconnected',
          textColor: 'text-red-400',
          borderColor: 'border-red-500',
        };
      case 'error':
        return {
          color: 'bg-yellow-500',
          label: 'Error',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500',
        };
      default:
        return {
          color: 'bg-gray-500',
          label: 'Unknown',
          textColor: 'text-gray-400',
          borderColor: 'border-gray-500',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const isConnecting = agent.status === 'connecting';

  // Size classes
  const sizeClasses = {
    sm: {
      dot: 'w-2 h-2',
      text: 'text-xs',
      container: 'gap-1.5',
    },
    md: {
      dot: 'w-2.5 h-2.5',
      text: 'text-sm',
      container: 'gap-2',
    },
    lg: {
      dot: 'w-3 h-3',
      text: 'text-base',
      container: 'gap-2.5',
    },
  };

  const currentSize = sizeClasses[size];

  // Format last activity time
  const getLastActivityText = () => {
    if (!agent.lastActivity) return 'Never';

    const lastActivity = new Date(agent.lastActivity);
    const now = new Date();
    const diffMs = now - lastActivity;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => showTooltip && setShowTooltipState(true)}
      onMouseLeave={() => showTooltip && setShowTooltipState(false)}
    >
      <div className={`inline-flex items-center ${currentSize.container}`}>
        {/* Status Dot */}
        <div className="relative">
          <div
            className={`${currentSize.dot} rounded-full ${statusInfo.color} ${
              isConnecting ? 'animate-pulse' : ''
            }`}
          />
          {/* Pulse animation ring for connecting state */}
          {isConnecting && (
            <div
              className={`absolute inset-0 ${currentSize.dot} rounded-full ${statusInfo.color} animate-ping opacity-75`}
            />
          )}
        </div>

        {/* Status Label */}
        {showLabel && (
          <span className={`${currentSize.text} font-medium ${statusInfo.textColor}`}>
            {isConnecting ? 'Connecting...' : statusInfo.label}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && showTooltipState && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-3 py-2 min-w-max">
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Status:</span>
                <span className={`font-medium ${statusInfo.textColor}`}>
                  {isConnecting ? 'Connecting' : statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Type:</span>
                <span className="text-white capitalize">{agent.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Last Activity:</span>
                <span className="text-white">{getLastActivityText()}</span>
              </div>
              {agent.stats && (
                <div className="flex items-center gap-2 pt-1 mt-1 border-t border-gray-700">
                  <span className="text-gray-400">Trades:</span>
                  <span className="text-white">{agent.stats.totalTrades || 0}</span>
                </div>
              )}
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentStatusBadge;
