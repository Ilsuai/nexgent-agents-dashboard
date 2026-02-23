/**
 * ConnectionHealth - Shows connection status and last message time
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, Activity, AlertCircle } from 'lucide-react';
import { getConnectionPool } from '../../services/AgentConnectionPool';

const ConnectionHealth = ({ agentId, className = '' }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pool = getConnectionPool();
    
    const updateLastMessage = () => {
      setLastMessageTime(Date.now());
      setMessageCount(prev => prev + 1);
      setError(null);
    };

    const handleConnect = (data) => {
      if (!agentId || data.agentId === agentId) {
        setIsConnected(true);
        setError(null);
      }
    };

    const handleDisconnect = (data) => {
      if (!agentId || data.agentId === agentId) {
        setIsConnected(false);
      }
    };

    const handleError = (data) => {
      if (!agentId || data.agentId === agentId) {
        setError(data.error || 'Connection error');
      }
    };

    // Subscribe to all message types
    pool.on('trade', updateLastMessage);
    pool.on('signal', updateLastMessage);
    pool.on('agentStatus', updateLastMessage);
    pool.on('balance', updateLastMessage);
    pool.on('message', updateLastMessage);
    pool.on('connected', handleConnect);
    pool.on('disconnected', handleDisconnect);
    pool.on('error', handleError);

    // Check initial status
    const statuses = pool.getConnectionStatuses();
    if (agentId && statuses[agentId]) {
      setIsConnected(statuses[agentId].status === 'connected');
    }

    return () => {
      pool.off('trade', updateLastMessage);
      pool.off('signal', updateLastMessage);
      pool.off('agentStatus', updateLastMessage);
      pool.off('balance', updateLastMessage);
      pool.off('message', updateLastMessage);
      pool.off('connected', handleConnect);
      pool.off('disconnected', handleDisconnect);
      pool.off('error', handleError);
    };
  }, [agentId]);

  const getTimeSinceLastMessage = () => {
    if (!lastMessageTime) return 'Waiting...';
    const seconds = Math.floor((Date.now() - lastMessageTime) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Update display every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-red-500/20 text-red-400 ${className}`}>
        <AlertCircle size={12} />
        <span>Error</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full text-xs ${
      isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
    } ${className}`}>
      {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
      
      {lastMessageTime && (
        <>
          <div className="w-px h-3 bg-current opacity-30" />
          <Clock size={12} />
          <span>{getTimeSinceLastMessage()}</span>
        </>
      )}
      
      {messageCount > 0 && (
        <>
          <div className="w-px h-3 bg-current opacity-30" />
          <Activity size={12} />
          <span>{messageCount}</span>
        </>
      )}
    </div>
  );
};

export default ConnectionHealth;
