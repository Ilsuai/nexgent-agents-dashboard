/**
 * WalletConnect - Solana Wallet Connection Component
 * Connect Phantom/Solflare wallet for trade execution
 */

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWalletState, useNetwork } from '../../context/WalletContext';
import {
  Wallet,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Settings,
  AlertTriangle
} from 'lucide-react';

const WalletConnect = () => {
  const { disconnect } = useWallet();
  const {
    connected,
    connecting,
    publicKey,
    walletName,
    balance,
    isLoadingBalance,
    refreshBalance,
    autoExecute,
    setAutoExecute,
    lastTransaction,
  } = useWalletState();

  const { network, setNetwork } = useNetwork();
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wallet className={connected ? 'text-accent' : 'text-gray-400'} size={24} />
          <div>
            <h3 className="text-lg font-bold text-white">Wallet Connection</h3>
            <p className="text-xs text-gray-400 mt-1">
              Connect your Solana wallet to execute trades
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-2 text-success text-sm">
              <CheckCircle size={16} />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-2 text-gray-400 text-sm">
              <XCircle size={16} />
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!connected ? (
        <div className="space-y-4">
          {/* Wallet Connect Button */}
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-accent hover:!bg-accent/80 !rounded-lg !h-12 !px-6 !font-semibold" />
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-400 mb-1">Wallet Required for Trading</p>
                <p>
                  Connect your Phantom or Solflare wallet to enable automatic trade execution
                  from external signal providers.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Wallet Info */}
          <div className="bg-surface-light rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <Wallet className="text-accent" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{walletName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400">{formatAddress(publicKey)}</p>
                    <button
                      onClick={handleCopyAddress}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
              <a
                href={`https://solscan.io/account/${publicKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-accent transition-colors"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-lg font-bold text-white">
                  {isLoadingBalance ? (
                    <RefreshCw className="animate-spin inline" size={16} />
                  ) : (
                    `${balance.toFixed(4)} SOL`
                  )}
                </p>
              </div>
              <button
                onClick={refreshBalance}
                disabled={isLoadingBalance}
                className="p-2 rounded-lg bg-surface hover:bg-white/10 transition-colors"
              >
                <RefreshCw className={`text-gray-400 ${isLoadingBalance ? 'animate-spin' : ''}`} size={16} />
              </button>
            </div>
          </div>

          {/* Auto-Execute Toggle */}
          <div className="bg-surface-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className={autoExecute ? 'text-accent' : 'text-gray-400'} size={20} />
                <div>
                  <p className="text-sm font-medium text-white">Auto-Execute Trades</p>
                  <p className="text-xs text-gray-400">
                    Automatically execute signals from enabled agents
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutoExecute(!autoExecute)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoExecute ? 'bg-accent' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoExecute ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {autoExecute && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-yellow-400 flex items-center gap-2">
                  <AlertTriangle size={12} />
                  Trades will execute automatically when signals are received
                </p>
              </div>
            )}
          </div>

          {/* Network Selector */}
          <div className="bg-surface-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="text-gray-400" size={20} />
                <div>
                  <p className="text-sm font-medium text-white">Network</p>
                  <p className="text-xs text-gray-400">
                    {network === 'mainnet-beta' ? 'Mainnet (Real trades)' : 'Devnet (Test only)'}
                  </p>
                </div>
              </div>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="mainnet-beta">Mainnet</option>
                <option value="devnet">Devnet</option>
              </select>
            </div>
          </div>

          {/* Last Transaction */}
          {lastTransaction && (
            <div className="bg-surface-light rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">Last Transaction</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    lastTransaction.status === 'confirmed' ? 'bg-success' :
                    lastTransaction.status === 'failed' ? 'bg-red-500' :
                    'bg-yellow-500 animate-pulse'
                  }`} />
                  <span className="text-sm text-white capitalize">{lastTransaction.status}</span>
                </div>
                <a
                  href={`https://solscan.io/tx/${lastTransaction.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  View <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full py-2 px-4 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
