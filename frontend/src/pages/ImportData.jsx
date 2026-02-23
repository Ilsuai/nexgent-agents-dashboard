import React, { useState } from 'react';
import { useTradingData } from '../context/TradingDataContext';
import { useAgentManagement } from '../context/AgentManagementContext';
import { Upload, FileText, Download, Check, AlertCircle, Database, Zap } from 'lucide-react';
import { parseCSV, parseJSON, validateTrades, generateImportSummary } from '../utils/importParser';

const ImportData = () => {
  const { importTrades, trades } = useTradingData();
  const { agents, selectedAgentId } = useAgentManagement();
  const [activeTab, setActiveTab] = useState('manual'); // 'manual', 'csv', 'json', 'nexgent'
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [previewData, setPreviewData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [selectedImportAgent, setSelectedImportAgent] = useState(selectedAgentId || agents[0]?.id || '');

  // Manual Entry Form State
  const [manualForm, setManualForm] = useState({
    token: '',
    side: 'BUY',
    quantity: '',
    entryPrice: '',
    exitPrice: '',
    pnl: '',
    fees: '0',
    status: 'CLOSED',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
  });

  // Handle Manual Entry
  const handleManualSubmit = (e) => {
    e.preventDefault();

    const trade = {
      token: manualForm.token,
      side: manualForm.side,
      quantity: parseFloat(manualForm.quantity),
      entryPrice: parseFloat(manualForm.entryPrice),
      exitPrice: parseFloat(manualForm.exitPrice),
      pnl: parseFloat(manualForm.pnl),
      pnlPercent: (parseFloat(manualForm.pnl) / (parseFloat(manualForm.entryPrice) * parseFloat(manualForm.quantity)) * 100).toFixed(2),
      fees: parseFloat(manualForm.fees),
      status: manualForm.status,
      timestamp: new Date(`${manualForm.date} ${manualForm.time}`).toISOString(),
      agentId: selectedImportAgent, // Tag with selected agent
    };

    const result = importTrades([trade]);

    if (result.duplicates > 0) {
      setImportStatus({ type: 'warning', message: 'This trade appears to be a duplicate and was not added.' });
    } else {
      setImportStatus({ type: 'success', message: 'Trade added successfully!' });
    }

    // Reset form
    setManualForm({
      ...manualForm,
      token: '',
      quantity: '',
      entryPrice: '',
      exitPrice: '',
      pnl: '',
    });

    setTimeout(() => setImportStatus(null), 3000);
  };

  // Handle CSV Import with Smart Parser
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsedTrades = parseCSV(text);
        const validation = validateTrades(parsedTrades);
        const summary = generateImportSummary(validation.valid);

        setPreviewData(validation.valid);
        setValidationErrors(validation.errors);
        setImportSummary(summary);

        const message = validation.errors.length > 0
          ? `Parsed ${validation.validCount} valid trades (${validation.errorCount} errors). Review and confirm import.`
          : `Parsed ${validation.validCount} trades from CSV. Review and confirm import.`;

        setImportStatus({
          type: validation.errors.length > 0 ? 'warning' : 'success',
          message
        });
      } catch (error) {
        setImportStatus({ type: 'error', message: `Error parsing CSV: ${error.message}` });
        setPreviewData([]);
        setValidationErrors([]);
        setImportSummary(null);
      }
    };

    reader.readAsText(file);
  };

  // Handle JSON Import with Smart Parser
  const handleJSONImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonText = event.target.result;
        const parsedTrades = parseJSON(jsonText);
        const validation = validateTrades(parsedTrades);
        const summary = generateImportSummary(validation.valid);

        setPreviewData(validation.valid);
        setValidationErrors(validation.errors);
        setImportSummary(summary);

        const message = validation.errors.length > 0
          ? `Parsed ${validation.validCount} valid trades (${validation.errorCount} errors). Review and confirm import.`
          : `Parsed ${validation.validCount} trades from JSON. Review and confirm import.`;

        setImportStatus({
          type: validation.errors.length > 0 ? 'warning' : 'success',
          message
        });
      } catch (error) {
        setImportStatus({ type: 'error', message: `Error parsing JSON: ${error.message}` });
        setPreviewData([]);
        setValidationErrors([]);
        setImportSummary(null);
      }
    };

    reader.readAsText(file);
  };

  // Confirm Import from Preview
  const confirmImport = () => {
    // Tag all trades with selected agent
    const tradesWithAgent = previewData.map(trade => ({
      ...trade,
      agentId: selectedImportAgent
    }));

    const result = importTrades(tradesWithAgent);

    let message = `Successfully imported ${result.imported.length} trades to ${agents.find(a => a.id === selectedImportAgent)?.name || 'selected agent'}!`;
    if (result.duplicates > 0) {
      message += ` (${result.duplicates} duplicates skipped)`;
    }

    setImportStatus({
      type: result.duplicates > 0 ? 'warning' : 'success',
      message
    });

    setPreviewData([]);
    setValidationErrors([]);
    setImportSummary(null);
    setTimeout(() => setImportStatus(null), 5000);
  };

  // Handle Nexgent.ai Import (CSV or JSON format)
  const handleNexgentImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let parsedTrades;

        // Detect if file is CSV or JSON
        if (file.name.endsWith('.csv')) {
          parsedTrades = parseCSV(text);
        } else {
          parsedTrades = parseJSON(text);
        }

        const validation = validateTrades(parsedTrades);
        const summary = generateImportSummary(validation.valid);

        setPreviewData(validation.valid);
        setValidationErrors(validation.errors);
        setImportSummary(summary);

        const message = validation.errors.length > 0
          ? `Parsed ${validation.validCount} valid trades from Nexgent.ai (${validation.errorCount} errors). Review and confirm import.`
          : `Parsed ${validation.validCount} trades from Nexgent.ai. Review and confirm import.`;

        setImportStatus({
          type: validation.errors.length > 0 ? 'warning' : 'success',
          message
        });
      } catch (error) {
        setImportStatus({ type: 'error', message: `Error parsing Nexgent.ai data: ${error.message}` });
        setPreviewData([]);
        setValidationErrors([]);
        setImportSummary(null);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <header>
        <h2 className="text-3xl font-bold text-white">Import Trading Data</h2>
        <p className="text-gray-400 mt-1 text-sm">Import trades from multiple sources or add them manually</p>
      </header>

      {/* Status Message */}
      {importStatus && (
        <div className={`glass-card p-4 border-l-4 ${
          importStatus.type === 'success' ? 'border-success bg-success/5' :
          importStatus.type === 'warning' ? 'border-yellow-500 bg-yellow-500/5' :
          'border-danger bg-danger/5'
        }`}>
          <div className="flex items-center gap-3">
            {importStatus.type === 'success' ? (
              <Check className="text-success" size={20} />
            ) : (
              <AlertCircle className={importStatus.type === 'warning' ? 'text-yellow-500' : 'text-danger'} size={20} />
            )}
            <p className="text-white text-sm">{importStatus.message}</p>
          </div>
        </div>
      )}

      {/* Agent Selection */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Select Target Agent</h3>
        <p className="text-sm text-gray-400 mb-4">Choose which agent these trades should be imported to</p>
        <select
          value={selectedImportAgent}
          onChange={(e) => setSelectedImportAgent(e.target.value)}
          className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 rounded-lg text-base"
        >
          {agents.length === 0 && (
            <option value="">No agents available</option>
          )}
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.type === 'demo' ? 'Simulation' : agent.type})
            </option>
          ))}
        </select>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card p-2">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('manual')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-accent text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800'
            }`}
          >
            <FileText size={18} />
            <span className="font-medium">Manual Entry</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'csv'
                ? 'bg-accent text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800'
            }`}
          >
            <Database size={18} />
            <span className="font-medium">CSV Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'json'
                ? 'bg-accent text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800'
            }`}
          >
            <Upload size={18} />
            <span className="font-medium">JSON Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('nexgent')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'nexgent'
                ? 'bg-accent text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800'
            }`}
          >
            <Zap size={18} />
            <span className="font-medium">Nexgent.ai</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {/* Manual Entry */}
        {activeTab === 'manual' && (
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Add Trade Manually</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Token/Symbol *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.token}
                    onChange={(e) => setManualForm({ ...manualForm, token: e.target.value.toUpperCase() })}
                    placeholder="BTC, ETH, SOL..."
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Side *</label>
                  <select
                    value={manualForm.side}
                    onChange={(e) => setManualForm({ ...manualForm, side: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Quantity *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={manualForm.quantity}
                    onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
                    placeholder="0.0000"
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Entry Price *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={manualForm.entryPrice}
                    onChange={(e) => setManualForm({ ...manualForm, entryPrice: e.target.value })}
                    placeholder="0.0000"
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Exit Price *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={manualForm.exitPrice}
                    onChange={(e) => setManualForm({ ...manualForm, exitPrice: e.target.value })}
                    placeholder="0.0000"
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">P&L (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualForm.pnl}
                    onChange={(e) => setManualForm({ ...manualForm, pnl: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Fees</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.fees}
                    onChange={(e) => setManualForm({ ...manualForm, fees: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Status</label>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Date</label>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Time</label>
                  <input
                    type="time"
                    value={manualForm.time}
                    onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Add Trade
              </button>
            </form>
          </div>
        )}

        {/* CSV Upload */}
        {activeTab === 'csv' && (
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Import from CSV</h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-dark-700 rounded-lg p-8 text-center">
                <Upload className="mx-auto text-gray-500 mb-4" size={48} />
                <p className="text-gray-400 mb-4">
                  Drop your CSV file here or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-block bg-accent hover:bg-accent-dark text-white font-medium py-2 px-6 rounded-lg cursor-pointer transition-colors"
                >
                  Choose CSV File
                </label>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm text-gray-400 mb-2">Expected CSV format:</p>
                <pre className="text-xs text-gray-500 font-mono overflow-x-auto">
{`token,side,quantity,entry price,exit price,pnl,fees,status,timestamp
BTC,BUY,0.5,50000,52000,1000,10,CLOSED,2024-01-01 14:30:00
ETH,SELL,2.0,3000,3200,400,5,CLOSED,2024-01-02 09:15:00`}
                </pre>
                <p className="text-xs text-gray-400 mt-2">
                  💡 Tip: Include both date and time in timestamp for accurate records (e.g., "2024-01-01 14:30:00" or "2024-01-01T14:30:00Z")
                </p>
              </div>
            </div>
          </div>
        )}

        {/* JSON Upload */}
        {activeTab === 'json' && (
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Import from JSON</h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-dark-700 rounded-lg p-8 text-center">
                <Upload className="mx-auto text-gray-500 mb-4" size={48} />
                <p className="text-gray-400 mb-4">
                  Drop your JSON file here or click to browse
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJSONImport}
                  className="hidden"
                  id="json-upload"
                />
                <label
                  htmlFor="json-upload"
                  className="inline-block bg-accent hover:bg-accent-dark text-white font-medium py-2 px-6 rounded-lg cursor-pointer transition-colors"
                >
                  Choose JSON File
                </label>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm text-gray-400 mb-2">Expected JSON format:</p>
                <pre className="text-xs text-gray-500 font-mono overflow-x-auto">
{`[
  {
    "token": "BTC",
    "side": "BUY",
    "quantity": 0.5,
    "entryPrice": 50000,
    "exitPrice": 52000,
    "pnl": 1000,
    "fees": 10,
    "status": "CLOSED",
    "timestamp": "2024-01-01T14:30:00Z"
  },
  {
    "token": "ETH",
    "side": "SELL",
    "quantity": 2.0,
    "entryPrice": 3000,
    "exitPrice": 3200,
    "pnl": 400,
    "fees": 5,
    "status": "CLOSED",
    "timestamp": "2024-01-02T09:15:00Z"
  }
]`}
                </pre>
                <p className="text-xs text-gray-400 mt-2">
                  💡 Tip: Use ISO 8601 format for timestamps (e.g., "2024-01-01T14:30:00Z")
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nexgent.ai Import */}
        {activeTab === 'nexgent' && (
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Import from Nexgent.ai</h3>
            <div className="space-y-4">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="text-accent mt-1" size={20} />
                  <div>
                    <p className="text-white font-medium mb-1">Import Beta Trading Data</p>
                    <p className="text-sm text-gray-400">
                      Import your simulated trades from Nexgent.ai platform. Export your data from the platform and upload the JSON file here.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-dark-700 rounded-lg p-8 text-center">
                <Upload className="mx-auto text-gray-500 mb-4" size={48} />
                <p className="text-gray-400 mb-4">
                  Upload Nexgent.ai export file (CSV or JSON)
                </p>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleNexgentImport}
                  className="hidden"
                  id="nexgent-upload"
                />
                <label
                  htmlFor="nexgent-upload"
                  className="inline-block bg-accent hover:bg-accent-dark text-white font-medium py-2 px-6 rounded-lg cursor-pointer transition-colors"
                >
                  Choose File
                </label>
              </div>

              <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm text-gray-400 mb-2">How to export from Nexgent.ai:</p>
                <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                  <li>Log in to your Nexgent.ai dashboard</li>
                  <li>Navigate to Trade History or Export section</li>
                  <li>Click "Export Data" and select JSON format</li>
                  <li>Upload the downloaded file here</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Summary */}
      {importSummary && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Import Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400 mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-white">{importSummary.totalTrades}</p>
            </div>
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400 mb-1">Total P&L</p>
              <p className={`text-2xl font-bold ${importSummary.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                ${importSummary.totalPnL}
              </p>
            </div>
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-accent">{importSummary.winRate}%</p>
            </div>
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400 mb-1">Unique Tokens</p>
              <p className="text-2xl font-bold text-gray-400">{importSummary.uniqueTokens}</p>
            </div>
          </div>
          {importSummary.tokens.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Tokens:</p>
              <div className="flex flex-wrap gap-2">
                {importSummary.tokens.map((token, idx) => (
                  <span key={idx} className="bg-dark-900 text-accent px-3 py-1 rounded text-xs border border-dark-700">
                    {token}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="glass-card p-6 border-l-4 border-yellow-500 bg-yellow-500/5">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="text-yellow-500" size={20} />
            Validation Errors ({validationErrors.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {validationErrors.map((error, idx) => (
              <div key={idx} className="bg-dark-900 p-3 rounded-lg border border-dark-700 text-sm">
                <p className="text-white font-medium">Trade #{error.index}</p>
                <ul className="text-gray-400 text-xs mt-1 list-disc list-inside">
                  {error.errors.map((err, errIdx) => (
                    <li key={errIdx}>{err}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Data */}
      {previewData.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Preview ({previewData.length} valid trades)</h3>
            <button
              onClick={confirmImport}
              className="bg-success hover:bg-success/80 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Confirm Import
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-dark-900/50 text-xs uppercase tracking-wider text-gray-500 font-medium sticky top-0">
                <tr>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Entry</th>
                  <th className="px-4 py-3 text-right">Exit</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/30">
                {previewData.map((trade, idx) => (
                  <tr key={idx} className="hover:bg-dark-700/20">
                    <td className="px-4 py-3 text-white font-bold">{trade.token}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${trade.side === 'BUY' ? 'text-success' : 'text-danger'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{trade.quantity?.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">${trade.entryPrice?.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">${trade.exitPrice?.toFixed(4)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${trade.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${trade.pnl?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{trade.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current Data Summary */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Current Database</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-white">{trades.length}</p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Open Positions</p>
            <p className="text-2xl font-bold text-accent">
              {trades.filter(t => t.status === 'OPEN').length}
            </p>
          </div>
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-700">
            <p className="text-xs text-gray-400 mb-1">Closed Trades</p>
            <p className="text-2xl font-bold text-gray-400">
              {trades.filter(t => t.status === 'CLOSED').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportData;
