/**
 * WalletContext - Solana Wallet Integration
 * Connects to Phantom/Solflare for trade execution
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

const WalletStateContext = createContext();

// RPC endpoints
const RPC_ENDPOINTS = {
  'mainnet-beta': process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
};

export const useWalletState = () => {
  const context = useContext(WalletStateContext);
  if (!context) {
    throw new Error('useWalletState must be used within WalletStateProvider');
  }
  return context;
};

// Inner provider that has access to wallet hooks
const WalletStateProviderInner = ({ children }) => {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnecting, wallet } = useWallet();

  const [balance, setBalance] = useState(0);
  const [tokenBalances, setTokenBalances] = useState({});
  const [autoExecute, setAutoExecute] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('walletSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAutoExecute(parsed.autoExecute || false);
      } catch (e) {
        console.error('Error loading wallet settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage
  const updateAutoExecute = useCallback((value) => {
    setAutoExecute(value);
    localStorage.setItem('walletSettings', JSON.stringify({ autoExecute: value }));
  }, []);

  // Fetch SOL balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !connection) {
        setBalance(0);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();

    // Refresh balance every 30 seconds when connected
    if (connected) {
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [publicKey, connection, connected]);

  // Record transaction
  const recordTransaction = useCallback((signature, status = 'pending') => {
    setLastTransaction({
      signature,
      status,
      timestamp: Date.now(),
    });
  }, []);

  // Update transaction status
  const updateTransactionStatus = useCallback((status) => {
    setLastTransaction(prev => prev ? { ...prev, status } : null);
  }, []);

  // Refresh balance manually
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) return;

    setIsLoadingBalance(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error refreshing balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey, connection]);

  const value = {
    // Connection state
    connected,
    connecting,
    disconnecting,
    publicKey: publicKey?.toBase58() || null,
    walletName: wallet?.adapter?.name || null,

    // Balance
    balance,
    tokenBalances,
    isLoadingBalance,
    refreshBalance,

    // Settings
    autoExecute,
    setAutoExecute: updateAutoExecute,

    // Transactions
    lastTransaction,
    recordTransaction,
    updateTransactionStatus,

    // Connection object for TradeExecutor
    connection,
  };

  return (
    <WalletStateContext.Provider value={value}>
      {children}
    </WalletStateContext.Provider>
  );
};

// Main provider component
export const WalletContextProvider = ({ children }) => {
  const [network, setNetwork] = useState('mainnet-beta');

  // Load network preference
  useEffect(() => {
    const saved = localStorage.getItem('solanaNetwork');
    if (saved && (saved === 'mainnet-beta' || saved === 'devnet')) {
      setNetwork(saved);
    }
  }, []);

  const endpoint = useMemo(() => RPC_ENDPOINTS[network], [network]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  const updateNetwork = useCallback((newNetwork) => {
    setNetwork(newNetwork);
    localStorage.setItem('solanaNetwork', newNetwork);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletStateProviderInner>
            <NetworkContext.Provider value={{ network, setNetwork: updateNetwork }}>
              {children}
            </NetworkContext.Provider>
          </WalletStateProviderInner>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

// Network context for switching networks
const NetworkContext = createContext();

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within WalletContextProvider');
  }
  return context;
};

export default WalletContextProvider;
