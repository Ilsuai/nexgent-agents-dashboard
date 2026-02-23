import React, { useState, useEffect } from 'react';
import { Zap, Key, CheckCircle, Webhook } from 'lucide-react';
import WebhookTester from '../components/bot/WebhookTester';
import BotControlPanel from '../components/bot/BotControlPanel';
import { getUserId } from '../services/firebase';

/**
 * Webhook Page
 * - Webhook Testing
 * - Firebase User ID display
 *
 * Signal providers are managed in the Signal Providers page
 */
const BotSetup = () => {
  const [firebaseUserId, setFirebaseUserId] = useState(null);

  // Get Firebase user ID for debugging
  useEffect(() => {
    const checkUserId = () => {
      const uid = getUserId();
      setFirebaseUserId(uid);
    };
    checkUserId();
    // Check again after a short delay in case auth is still initializing
    const timer = setTimeout(checkUserId, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header>
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Webhook className="text-accent" size={32} />
          Webhook
        </h2>
        <p className="text-gray-400 mt-1 text-sm">
          Test webhook connections and view system configuration
        </p>
      </header>

      {/* Bot Control Panel - Master Switch */}
      <BotControlPanel />

      {/* How It Works */}
      <div className="glass-card p-6 border border-accent/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="text-accent" size={20} />
          How Signal Trading Works
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-surface rounded-xl p-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold mb-3">1</div>
            <h4 className="text-white font-medium mb-1">Add Signal Provider</h4>
            <p className="text-sm text-gray-400">
              Go to <a href="/agents" className="text-accent hover:underline">Signal Providers</a> and add your external bot (e.g., NexGent AI)
            </p>
          </div>
          <div className="bg-surface rounded-xl p-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold mb-3">2</div>
            <h4 className="text-white font-medium mb-1">Turn It ON</h4>
            <p className="text-sm text-gray-400">
              Toggle the provider to LIVE mode. Signals will be received via webhook.
            </p>
          </div>
          <div className="bg-surface rounded-xl p-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold mb-3">3</div>
            <h4 className="text-white font-medium mb-1">Auto-Execute</h4>
            <p className="text-sm text-gray-400">
              Trades execute automatically on your connected Solana wallet via Jupiter.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Tester */}
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="text-accent" size={24} />
          Test Webhook
        </h3>
        <p className="text-gray-400 text-sm">
          Send a test signal to verify your webhook is receiving and executing trades correctly.
        </p>
        <WebhookTester />
      </div>

      {/* Firebase Debug Info */}
      {firebaseUserId && (
        <div className="glass-card p-4 border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-3">
            <Key className="text-yellow-400" size={20} />
            <div>
              <p className="text-yellow-400 text-sm font-medium">Firebase User ID (for Vercel env)</p>
              <code className="text-white text-xs bg-black/30 px-2 py-1 rounded mt-1 inline-block select-all">
                {firebaseUserId}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Environment Checklist */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Environment Setup Checklist</h3>
        <p className="text-sm text-gray-400 mb-4">
          These environment variables must be set in Vercel for trade execution:
        </p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm">
            <CheckCircle className="text-green-400 flex-shrink-0" size={18} />
            <code className="bg-surface px-2 py-1 rounded text-accent">SOLANA_PRIVATE_KEY</code>
            <span className="text-gray-400">- Your Phantom wallet private key</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <CheckCircle className="text-green-400 flex-shrink-0" size={18} />
            <code className="bg-surface px-2 py-1 rounded text-accent">SOLANA_RPC_URL</code>
            <span className="text-gray-400">- Helius or other RPC endpoint</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <CheckCircle className="text-green-400 flex-shrink-0" size={18} />
            <code className="bg-surface px-2 py-1 rounded text-accent">FIREBASE_SERVICE_ACCOUNT</code>
            <span className="text-gray-400">- Firebase admin credentials</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <CheckCircle className="text-green-400 flex-shrink-0" size={18} />
            <code className="bg-surface px-2 py-1 rounded text-accent">FIREBASE_USER_ID</code>
            <span className="text-gray-400">- Your user ID shown above</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BotSetup;
