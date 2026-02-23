/**
 * Data Export/Import Utilities
 * For backing up and restoring data from Firebase
 */

import { getTrades, saveTradesBatch, getSettings, saveSettings, getAgents, saveAgents } from '../services/firebase';

/**
 * Export all data to JSON file
 */
export const exportAllData = async () => {
  try {
    const [trades, settings, agents] = await Promise.all([
      getTrades(10000),
      getSettings(),
      getAgents(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '3.0',
      trades,
      settings,
      agents,
      metadata: {
        tradeCount: trades.length,
        hasSettings: \!\!settings,
        agentCount: agents.length,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexgent-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📤 Exported ${trades.length} trades`);
    return { success: true, tradeCount: trades.length };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

/**
 * Import data from JSON file
 */
export const importAllData = async (file, options = { mergeTrades: true }) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validate
        if (\!data.version) {
          throw new Error('Invalid backup file format');
        }

        const results = {
          trades: 0,
          settings: false,
          agents: 0,
        };

        // Import trades
        if (data.trades && data.trades.length > 0) {
          await saveTradesBatch(data.trades);
          results.trades = data.trades.length;
        }

        // Import settings
        if (data.settings) {
          await saveSettings(data.settings);
          results.settings = true;
        }

        // Import agents
        if (data.agents && data.agents.length > 0) {
          await saveAgents(data.agents);
          results.agents = data.agents.length;
        }

        console.log(`📥 Imported: ${results.trades} trades, ${results.agents} agents`);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Export trades only (CSV format)
 */
export const exportTradesToCSV = async () => {
  try {
    const trades = await getTrades(10000);
    
    if (trades.length === 0) {
      throw new Error('No trades to export');
    }

    // CSV headers
    const headers = [
      'id', 'agentId', 'token', 'side', 'status', 
      'entryPrice', 'exitPrice', 'quantity', 'positionSize',
      'pnl', 'pnlPercent', 'fees', 'strategy', 'timestamp'
    ];

    // Build CSV content
    let csv = headers.join(',') + '\n';
    
    trades.forEach(trade => {
      const row = headers.map(h => {
        const value = trade[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexgent-trades-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, count: trades.length };
  } catch (error) {
    console.error('CSV export failed:', error);
    throw error;
  }
};

export default {
  exportAllData,
  importAllData,
  exportTradesToCSV,
};
