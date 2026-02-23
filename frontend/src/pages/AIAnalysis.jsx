import React, { useState } from 'react';
import { useTradingData } from '../context/TradingDataContext';
import { Brain, Send, Loader, TrendingUp, AlertTriangle, Lightbulb, Settings } from 'lucide-react';

const AIAnalysis = () => {
  const { trades, analytics, performanceData } = useTradingData();
  const [apiKey, setApiKey] = useState(localStorage.getItem('claude_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [analysisType, setAnalysisType] = useState('comprehensive'); // 'comprehensive', 'strategy', 'risk', 'custom'
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Save API key to localStorage
  const saveApiKey = () => {
    localStorage.setItem('claude_api_key', apiKey);
    setShowSettings(false);
  };

  // Prepare trading data summary for AI analysis
  const prepareTradingDataSummary = () => {
    const recentTrades = trades.slice(0, 50); // Last 50 trades

    return {
      summary: {
        totalTrades: analytics.totalTrades,
        winRate: analytics.winRate,
        totalPnL: analytics.totalPnL,
        sharpeRatio: analytics.sharpeRatio,
        maxDrawdown: analytics.maxDrawdown,
        profitFactor: analytics.profitFactor,
        avgWin: analytics.avgWin,
        avgLoss: analytics.avgLoss,
        expectancy: analytics.expectancy,
      },
      recentTrades: recentTrades.map(t => ({
        token: t.token,
        side: t.side,
        pnl: t.pnl,
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        timestamp: t.timestamp,
      })),
      performanceHistory: performanceData.slice(-30).map(p => ({
        date: p.date,
        value: p.value,
      })),
    };
  };

  // Generate analysis prompt based on type
  const generatePrompt = () => {
    const data = prepareTradingDataSummary();
    const dataStr = JSON.stringify(data, null, 2);

    const prompts = {
      comprehensive: `You are an expert trading analyst. Analyze this trading bot's performance data and provide comprehensive insights:

${dataStr}

Please provide:
1. **Performance Assessment**: Overall evaluation of the bot's performance
2. **Strengths**: What is the bot doing well?
3. **Weaknesses**: Areas of concern or underperformance
4. **Risk Analysis**: Evaluation of risk metrics (Sharpe ratio, max drawdown, etc.)
5. **Strategic Recommendations**: 3-5 specific actionable improvements
6. **Market Observations**: Any patterns in token selection or timing

Be specific, data-driven, and provide actionable advice.`,

      strategy: `You are a trading strategy expert. Analyze this bot's trading strategy and patterns:

${dataStr}

Focus on:
1. **Entry/Exit Patterns**: Analyze the timing and price levels
2. **Token Selection**: Evaluate which tokens are performing best/worst
3. **Position Sizing**: Assess if position sizes are appropriate
4. **Win/Loss Patterns**: Identify patterns in winning vs losing trades
5. **Strategy Optimization**: Specific recommendations to improve the strategy

Provide detailed, technical analysis with specific examples from the data.`,

      risk: `You are a risk management specialist. Analyze this trading bot's risk profile:

${dataStr}

Evaluate:
1. **Risk Metrics**: Deep dive into Sharpe ratio, max drawdown, and volatility
2. **Position Risk**: Are position sizes creating excessive risk?
3. **Diversification**: Token concentration risk analysis
4. **Drawdown Analysis**: Recovery patterns and risk of ruin
5. **Risk Mitigation**: Specific recommendations to reduce risk

Be conservative and focus on capital preservation.`,

      custom: customPrompt + '\n\nTrading Data:\n' + dataStr,
    };

    return prompts[analysisType];
  };

  // Call Claude API for analysis
  const analyzeWithClaude = async () => {
    if (!apiKey) {
      setError('Please configure your Claude API key in settings');
      setShowSettings(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: generatePrompt(),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const analysisText = data.content[0].text;

      setAnalysis({
        text: analysisText,
        timestamp: new Date().toISOString(),
        type: analysisType,
      });
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Claude API error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Alternative: Use local LLM or different API
  const analyzeWithAlternative = async () => {
    setIsAnalyzing(true);
    setError(null);

    // Placeholder for alternative AI service integration
    // This could be OpenAI, local LLM, or another service

    setTimeout(() => {
      setAnalysis({
        text: `This is a placeholder for alternative AI analysis.

To use this feature, you can integrate:
- OpenAI API (GPT-4)
- Local LLM (Ollama, LM Studio)
- Other AI services (Cohere, Mistral, etc.)

Configure your preferred service in the settings and the analysis will appear here with actionable insights about your trading strategy.`,
        timestamp: new Date().toISOString(),
        type: 'demo',
      });
      setIsAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Brain className="text-accent" size={32} />
            AI Trading Analysis
          </h2>
          <p className="text-gray-400 mt-1 text-sm">
            Get AI-powered insights and recommendations to improve your trading strategy
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Settings size={16} />
          Settings
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card p-6 border-l-4 border-accent">
          <h3 className="text-lg font-bold text-white mb-4">AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Claude API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Anthropic Console
                </a>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveApiKey}
                className="bg-accent hover:bg-accent-dark text-white px-6 py-2 rounded-lg transition-colors"
              >
                Save API Key
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-dark-900 hover:bg-dark-800 border border-dark-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="glass-card p-4 border-l-4 border-danger bg-danger/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-danger" size={20} />
            <p className="text-white text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Analysis Type Selection */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Select Analysis Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setAnalysisType('comprehensive')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              analysisType === 'comprehensive'
                ? 'border-accent bg-accent/10'
                : 'border-dark-700 bg-dark-900 hover:border-accent/50'
            }`}
          >
            <TrendingUp className={analysisType === 'comprehensive' ? 'text-accent' : 'text-gray-400'} size={24} />
            <h4 className="text-white font-bold mt-2">Comprehensive</h4>
            <p className="text-xs text-gray-400 mt-1">
              Full analysis of performance, strategy, and risk
            </p>
          </button>

          <button
            onClick={() => setAnalysisType('strategy')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              analysisType === 'strategy'
                ? 'border-accent bg-accent/10'
                : 'border-dark-700 bg-dark-900 hover:border-accent/50'
            }`}
          >
            <Lightbulb className={analysisType === 'strategy' ? 'text-accent' : 'text-gray-400'} size={24} />
            <h4 className="text-white font-bold mt-2">Strategy Focus</h4>
            <p className="text-xs text-gray-400 mt-1">
              Deep dive into trading patterns and optimization
            </p>
          </button>

          <button
            onClick={() => setAnalysisType('risk')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              analysisType === 'risk'
                ? 'border-accent bg-accent/10'
                : 'border-dark-700 bg-dark-900 hover:border-accent/50'
            }`}
          >
            <AlertTriangle className={analysisType === 'risk' ? 'text-accent' : 'text-gray-400'} size={24} />
            <h4 className="text-white font-bold mt-2">Risk Analysis</h4>
            <p className="text-xs text-gray-400 mt-1">
              Focus on risk metrics and capital preservation
            </p>
          </button>

          <button
            onClick={() => setAnalysisType('custom')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              analysisType === 'custom'
                ? 'border-accent bg-accent/10'
                : 'border-dark-700 bg-dark-900 hover:border-accent/50'
            }`}
          >
            <Brain className={analysisType === 'custom' ? 'text-accent' : 'text-gray-400'} size={24} />
            <h4 className="text-white font-bold mt-2">Custom Query</h4>
            <p className="text-xs text-gray-400 mt-1">
              Ask specific questions about your trades
            </p>
          </button>
        </div>

        {/* Custom Prompt Input */}
        {analysisType === 'custom' && (
          <div className="mt-4">
            <label className="text-sm text-gray-400 mb-2 block">Your Question</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Why am I losing money on SOL trades? What time of day should I trade? How can I improve my win rate?"
              rows={4}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 rounded-lg resize-none"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={analyzeWithClaude}
          disabled={isAnalyzing || !apiKey}
          className="flex-1 bg-accent hover:bg-accent-dark text-white font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isAnalyzing ? (
            <>
              <Loader className="animate-spin" size={20} />
              Analyzing...
            </>
          ) : (
            <>
              <Brain size={20} />
              Analyze with Claude
            </>
          )}
        </button>

        <button
          onClick={analyzeWithAlternative}
          disabled={isAnalyzing}
          className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <Send size={20} />
          Use Alternative AI
        </button>
      </div>

      {/* Data Summary */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Your Trading Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
            <p className="text-xl font-bold text-white">{trades.length}</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Win Rate</p>
            <p className="text-xl font-bold text-accent">{analytics.winRate}%</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Sharpe Ratio</p>
            <p className="text-xl font-bold text-white">{analytics.sharpeRatio?.toFixed(2)}</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Total P&L</p>
            <p className={`text-xl font-bold ${analytics.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              ${analytics.totalPnL?.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Analysis Result */}
      {analysis && (
        <div className="glass-card p-6 border-l-4 border-accent">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="text-accent" size={20} />
                AI Analysis Results
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Generated on {new Date(analysis.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              {analysis.text}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-dark-700 flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(analysis.text);
              }}
              className="bg-dark-900 hover:bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => {
                const blob = new Blob([analysis.text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `trading-analysis-${new Date().toISOString().split('T')[0]}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-dark-900 hover:bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Download Analysis
            </button>
          </div>
        </div>
      )}

      {/* Info Section */}
      {!analysis && !isAnalyzing && (
        <div className="glass-card p-6 bg-dark-900/50">
          <h3 className="text-md font-bold text-white mb-3">How AI Analysis Works</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <p>
              • <strong className="text-white">Comprehensive:</strong> Get an overall assessment of your trading performance with actionable recommendations
            </p>
            <p>
              • <strong className="text-white">Strategy Focus:</strong> Deep analysis of your trading patterns, entry/exit timing, and optimization opportunities
            </p>
            <p>
              • <strong className="text-white">Risk Analysis:</strong> Evaluate your risk exposure, position sizing, and get risk mitigation strategies
            </p>
            <p>
              • <strong className="text-white">Custom Query:</strong> Ask specific questions about your trading data and get detailed answers
            </p>
          </div>
          <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
            <p className="text-sm text-gray-300">
              <strong className="text-accent">Note:</strong> AI analysis requires an API key. Your trading data is sent to the AI service for analysis.
              Make sure you're comfortable with this before proceeding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysis;
