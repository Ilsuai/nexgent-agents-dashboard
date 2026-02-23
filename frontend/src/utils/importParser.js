/**
 * Smart Import Parser
 * Handles multiple CSV/JSON formats and standardizes them for the dashboard
 */

// Known column mappings for different sources
const COLUMN_MAPPINGS = {
  // Nexgent.ai format
  nexgent: {
    token: ['token_symbol', 'tokensymbol', 'symbol'],
    quantity: ['amount', 'quantity', 'size'],
    entryPrice: ['purchase_price', 'purchaseprice', 'buy_price', 'buyprice'],
    exitPrice: ['sell_price', 'sellprice', 'exit_price', 'exitprice'],
    pnl: ['profit_loss', 'profitloss', 'pnl', 'profit', 'p&l'],
    pnlPercent: ['change_percent', 'changepercent', 'pnl_percent', 'pnlpercent', 'change%'],
    timestamp: ['created_at', 'createdat', 'timestamp', 'date', 'time'],
    fees: ['fees', 'fee', 'commission', 'gas'],
    status: ['status', 'deactivation_reason', 'state'],
  },
  // Generic format
  generic: {
    token: ['token', 'symbol', 'asset', 'coin', 'pair'],
    side: ['side', 'type', 'action', 'direction'],
    quantity: ['quantity', 'amount', 'size', 'volume'],
    entryPrice: ['entry price', 'entryprice', 'entry', 'buy price', 'buyprice'],
    exitPrice: ['exit price', 'exitprice', 'exit', 'sell price', 'sellprice'],
    pnl: ['pnl', 'p&l', 'profit', 'profit loss', 'profitloss'],
    pnlPercent: ['pnl %', 'pnl percent', 'pnlpercent', 'change %', 'return %'],
    timestamp: ['date', 'timestamp', 'time', 'datetime', 'created at'],
    fees: ['fees', 'fee', 'commission'],
    status: ['status', 'state'],
  }
};

/**
 * Normalize header name for matching
 */
function normalizeHeader(header) {
  return header.toLowerCase().trim().replace(/[_\s-]/g, '');
}

/**
 * Find matching column in data based on possible names
 */
function findColumn(dataRow, possibleNames, headers) {
  const normalized = headers.map(h => normalizeHeader(h));

  for (const name of possibleNames) {
    const normalizedName = normalizeHeader(name);
    const index = normalized.indexOf(normalizedName);
    if (index !== -1) {
      return dataRow[headers[index]];
    }
  }
  return null;
}

/**
 * Detect if this is Nexgent.ai format
 */
function isNexgentFormat(headers) {
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  return normalizedHeaders.includes('tokensymbol') &&
         normalizedHeaders.includes('purchaseprice') &&
         normalizedHeaders.includes('profitloss');
}

/**
 * Parse CSV with smart column detection
 */
export function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const isNexgent = isNexgentFormat(headers);
  const mapping = isNexgent ? COLUMN_MAPPINGS.nexgent : COLUMN_MAPPINGS.generic;

  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const dataRow = {};
      headers.forEach((header, index) => {
        dataRow[header] = values[index]?.trim();
      });

      // Extract fields using smart mapping
      const token = findColumn(dataRow, mapping.token, headers);
      const quantity = findColumn(dataRow, mapping.quantity, headers);
      const entryPrice = findColumn(dataRow, mapping.entryPrice, headers);
      const exitPrice = findColumn(dataRow, mapping.exitPrice, headers);
      const pnl = findColumn(dataRow, mapping.pnl, headers);
      const pnlPercent = findColumn(dataRow, mapping.pnlPercent, headers);
      const timestamp = findColumn(dataRow, mapping.timestamp, headers);
      const fees = findColumn(dataRow, mapping.fees, headers);
      const statusField = findColumn(dataRow, mapping.status, headers);

      // Determine side (BUY/SELL)
      let side = findColumn(dataRow, mapping.side || [], headers);
      if (!side) {
        // Infer from prices or P&L
        if (entryPrice && exitPrice) {
          side = parseFloat(exitPrice) > parseFloat(entryPrice) ? 'BUY' : 'SELL';
        } else if (pnl) {
          side = parseFloat(pnl) >= 0 ? 'BUY' : 'SELL';
        } else {
          side = 'BUY'; // default
        }
      }

      // Determine status
      let status = 'CLOSED';
      if (statusField) {
        const statusLower = statusField.toLowerCase();
        if (statusLower.includes('open') || statusLower.includes('active')) {
          status = 'OPEN';
        }
      }

      // Parse and validate the trade
      const trade = {
        token: token || 'UNKNOWN',
        side: side.toUpperCase(),
        quantity: parseFloat(quantity) || 0,
        entryPrice: parseFloat(entryPrice) || 0,
        exitPrice: parseFloat(exitPrice) || parseFloat(entryPrice) || 0,
        pnl: parseFloat(pnl) || 0,
        pnlPercent: parseFloat(pnlPercent) || 0,
        fees: parseFloat(fees) || 0,
        status: status,
        timestamp: parseTimestamp(timestamp),
      };

      // Validate trade has minimum required fields
      if (trade.token && trade.quantity > 0 && trade.entryPrice > 0) {
        trades.push(trade);
      }
    } catch (error) {
      console.warn(`Error parsing line ${i + 1}:`, error);
      // Continue with next line
    }
  }

  return trades;
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

/**
 * Parse JSON with smart field detection
 */
export function parseJSON(jsonText) {
  const data = JSON.parse(jsonText);
  const items = Array.isArray(data) ? data : [data];

  return items.map(item => {
    // Try to find fields with flexible naming
    const token = item.token || item.token_symbol || item.symbol || item.asset || 'UNKNOWN';
    const quantity = parseFloat(item.quantity || item.amount || item.size || 0);
    const entryPrice = parseFloat(
      item.entryPrice || item.entry_price || item.purchase_price ||
      item.buy_price || item.entry || 0
    );
    const exitPrice = parseFloat(
      item.exitPrice || item.exit_price || item.sell_price ||
      item.exit || entryPrice || 0
    );
    const pnl = parseFloat(item.pnl || item.profit_loss || item.profit || 0);
    const pnlPercent = parseFloat(
      item.pnlPercent || item.pnl_percent || item.change_percent ||
      item.return_percent || 0
    );
    const fees = parseFloat(item.fees || item.fee || item.commission || 0);

    // Determine side
    let side = item.side || item.type || item.action;
    if (!side) {
      side = exitPrice > entryPrice ? 'BUY' : 'SELL';
    }

    // Determine status
    let status = 'CLOSED';
    if (item.status) {
      const statusLower = item.status.toLowerCase();
      if (statusLower.includes('open') || statusLower.includes('active')) {
        status = 'OPEN';
      }
    }

    // Parse timestamp
    const timestamp = parseTimestamp(
      item.timestamp || item.created_at || item.date || new Date().toISOString()
    );

    return {
      token,
      side: side.toUpperCase(),
      quantity,
      entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      fees,
      status,
      timestamp,
    };
  });
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(timestampStr) {
  if (!timestampStr) {
    return new Date().toISOString();
  }

  // Handle various timestamp formats
  const str = String(timestampStr).trim();

  // ISO format
  if (str.includes('T') || str.includes('Z')) {
    return new Date(str).toISOString();
  }

  // PostgreSQL timestamp with timezone (e.g., "2025-12-23 10:43:59.951647+11")
  if (str.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
    // Remove timezone offset for parsing
    const cleanStr = str.split('+')[0].split('-').slice(0, 3).join('-');
    return new Date(cleanStr).toISOString();
  }

  // Try direct parsing
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    console.warn('Could not parse timestamp:', str);
  }

  // Default to now
  return new Date().toISOString();
}

/**
 * Validate imported trades
 */
export function validateTrades(trades) {
  const errors = [];
  const validated = [];

  trades.forEach((trade, index) => {
    const tradeErrors = [];

    if (!trade.token || trade.token === 'UNKNOWN') {
      tradeErrors.push('Missing token symbol');
    }
    if (!trade.quantity || trade.quantity <= 0) {
      tradeErrors.push('Invalid quantity');
    }
    if (!trade.entryPrice || trade.entryPrice <= 0) {
      tradeErrors.push('Invalid entry price');
    }
    if (!trade.exitPrice || trade.exitPrice <= 0) {
      tradeErrors.push('Invalid exit price');
    }

    if (tradeErrors.length > 0) {
      errors.push({
        index: index + 1,
        trade,
        errors: tradeErrors,
      });
    } else {
      validated.push(trade);
    }
  });

  return {
    valid: validated,
    errors,
    totalProcessed: trades.length,
    validCount: validated.length,
    errorCount: errors.length,
  };
}

/**
 * Generate import summary
 */
export function generateImportSummary(trades) {
  const totalTrades = trades.length;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const tokens = [...new Set(trades.map(t => t.token))];

  return {
    totalTrades,
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    wins,
    losses,
    winRate: totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0,
    uniqueTokens: tokens.length,
    tokens: tokens.slice(0, 10), // Show first 10 tokens
  };
}
