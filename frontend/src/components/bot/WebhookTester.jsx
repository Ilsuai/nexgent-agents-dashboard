/**
 * WebhookTester - Test webhook/API signals from the dashboard
 */

import React, { useState } from 'react';
import { Zap, Send, Check, X, Clock, Loader2, AlertTriangle } from 'lucide-react';

const WEBHOOK_URL = 'https://nexgent-dashboard.vercel.app/api/webhook/signal';

// Popular test tokens
const TEST_TOKENS = [
  { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'POPCAT', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { symbol: 'JUP', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
];

const WebhookTester = () => {
  const [testMode, setTestMode] = useState('simulate'); // 'simulate' or 'live'
  const [selectedToken, setSelectedToken] = useState(TEST_TOKENS[0]);
  const [customToken, setCustomToken] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [action, setAction] = useState('BUY');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    const tokenAddress = customToken || selectedToken.address;
    const tokenSymbol = customToken ? 'CUSTOM' : selectedToken.symbol;

    // Build payload in NexGent AI format
    const payload = {
      data: {
        transaction_type: 'swap',
        input_mint: action === 'BUY'
          ? 'So11111111111111111111111111111111111111112'
          : tokenAddress,
        output_mint: action === 'BUY'
          ? tokenAddress
          : 'So11111111111111111111111111111111111111112',
        input_symbol: action === 'BUY' ? 'SOL' : tokenSymbol,
        output_symbol: action === 'BUY' ? tokenSymbol : 'SOL',
        input_amount: parseFloat(amount),
      },
      test: testMode === 'simulate',
    };

    const startTime = Date.now();

    try {
      if (testMode === 'simulate') {
        // Simulate mode - just validate and return mock response
        await new Promise(resolve => setTimeout(resolve, 500));
        const elapsed = Date.now() - startTime;
        setResult({
          success: true,
          mode: 'simulate',
          message: `Simulation successful - ${action} ${amount} SOL worth of ${tokenSymbol}`,
          timing: { processingTimeMs: elapsed },
          payload,
        });
      } else {
        // Live mode - actually send to webhook
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        const elapsed = Date.now() - startTime;

        setResult({
          ...data,
          mode: 'live',
          responseTime: elapsed,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        mode: testMode,
        error: error.message,
        timing: { processingTimeMs: Date.now() - startTime },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="text-accent" size={24} />
          <div>
            <h3 className="text-lg font-bold text-white">Webhook Tester</h3>
            <p className="text-xs text-gray-400">Test your webhook/API signal integration</p>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTestMode('simulate')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            testMode === 'simulate'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              : 'bg-surface text-gray-400 hover:bg-white/5'
          }`}
        >
          Simulate (No Trade)
        </button>
        <button
          onClick={() => setTestMode('live')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            testMode === 'live'
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-surface text-gray-400 hover:bg-white/5'
          }`}
        >
          Live (Real Trade)
        </button>
      </div>

      {testMode === 'live' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle size={16} />
            <span className="font-medium">Live mode will execute a real trade on your wallet!</span>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Action */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Action</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAction('BUY')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                action === 'BUY'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-surface text-gray-400'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setAction('SELL')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                action === 'SELL'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-surface text-gray-400'
              }`}
            >
              SELL
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Amount (SOL)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.001"
            min="0.001"
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      {/* Token Selection */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 mb-1 block">Token</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {TEST_TOKENS.map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                setSelectedToken(token);
                setCustomToken('');
              }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedToken.symbol === token.symbol && !customToken
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'bg-surface text-gray-400 hover:bg-white/5'
              }`}
            >
              {token.symbol}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={customToken}
          onChange={(e) => setCustomToken(e.target.value)}
          placeholder="Or paste custom token address..."
          className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
        />
      </div>

      {/* Test Button */}
      <button
        onClick={handleTest}
        disabled={loading}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          testMode === 'live'
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-accent hover:bg-accent/80 text-white'
        } disabled:opacity-50`}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {testMode === 'live' ? 'Executing Trade...' : 'Simulating...'}
          </>
        ) : (
          <>
            <Send size={18} />
            {testMode === 'live' ? 'Execute Live Trade' : 'Send Test Signal'}
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`mt-4 rounded-lg p-4 ${
          result.success
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {result.success ? (
              <Check className="text-green-400" size={18} />
            ) : (
              <X className="text-red-400" size={18} />
            )}
            <span className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Success' : 'Failed'}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {result.mode === 'simulate' ? 'Simulation' : 'Live Trade'}
            </span>
          </div>

          {result.message && (
            <p className="text-sm text-gray-300 mb-2">{result.message}</p>
          )}

          {result.error && (
            <p className="text-sm text-red-300 mb-2">{result.error}</p>
          )}

          {result.txSignature && (
            <div className="mb-2">
              <span className="text-xs text-gray-400">Transaction: </span>
              <a
                href={`https://solscan.io/tx/${result.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline font-mono"
              >
                {result.txSignature.slice(0, 20)}...
              </a>
            </div>
          )}

          {(result.timing?.processingTimeMs || result.responseTime) && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} />
              <span>
                Processing: {result.timing?.processingTimeMs || result.responseTime}ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Payload Preview */}
      <details className="mt-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
          View payload format
        </summary>
        <pre className="mt-2 bg-surface rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
{JSON.stringify({
  data: {
    transaction_type: 'swap',
    input_mint: action === 'BUY' ? 'So111...112' : '<token>',
    output_mint: action === 'BUY' ? '<token>' : 'So111...112',
    input_symbol: action === 'BUY' ? 'SOL' : '<TOKEN>',
    output_symbol: action === 'BUY' ? '<TOKEN>' : 'SOL',
    input_amount: parseFloat(amount),
  }
}, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default WebhookTester;
