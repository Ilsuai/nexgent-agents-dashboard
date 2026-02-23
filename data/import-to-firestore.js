#!/usr/bin/env node
/**
 * Import CSV trade history and signals into Firestore
 *
 * Usage:
 *   node import-to-firestore.js
 *
 * Requires a .env file in the /data folder (or set env vars):
 *   FIREBASE_SERVICE_ACCOUNT=<json string>
 *   FIREBASE_USER_ID=<user id>
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Firebase init ──────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!serviceAccount.project_id) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT env var not set or invalid');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
// Defaults to 'nexgent' — the fixed data path for this single-tenant dashboard
const USER_ID = process.env.FIREBASE_USER_ID || 'nexgent';

// ── CSV parser ─────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

// ── Trade mapper: Nexgent Trade History CSV → Firestore doc ──────────────────
function mapTradeRow(row, agentId, mode) {
  const pnlStr = (row['Profit / Loss (USD)'] || '0').replace(/[+$,]/g, '');
  const changeStr = (row['Change (%)'] || '0%').replace(/[+%]/g, '');
  const timestamp = row['Time'] ? new Date(row['Time']).getTime() : Date.now();
  const id = `${agentId}_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    agentId,
    mode, // 'live' or 'simulation'
    token: row['Token Symbol'] || '',
    tokenSymbol: row['Token Symbol'] || '',
    tokenAddress: row['Token Address'] || '',
    quantity: parseFloat(row['Amount']) || 0,
    entryPrice: parseFloat(row['Average Purchase Price (USD)']) || 0,
    exitPrice: parseFloat(row['Sale Price (USD)']) || 0,
    pnl: parseFloat(pnlStr) || 0,
    pnlPercent: parseFloat(changeStr) || 0,
    side: 'BUY',
    status: 'CLOSED',
    timestamp,
    signalId: row['Signal ID'] || '',
    signalType: row['Signal Type'] || '',
    activationReason: row['Activation Reason'] || '',
    source: 'nexgent',
    importedAt: new Date().toISOString(),
  };
}

// ── Signal mapper: Nexgent signals CSV → Firestore doc ───────────────────────
function mapSignalRow(row) {
  const timestamp = row['Created At'] ? new Date(row['Created At']).getTime() : Date.now();
  const id = row['Signal ID'] || `sig_${timestamp}`;

  return {
    id: String(id),
    signalReceivedAt: timestamp,
    token: row['Token Symbol'] || '',
    tokenSymbol: row['Token Symbol'] || '',
    tokenAddress: row['Token Address'] || '',
    tradingStrategy: row['Trading Strategy'] || '',
    activationReason: row['Activation Reason'] || '',
    source: row['Source'] || 'Nexgent AI',
    signalStrength: parseInt(row['Signal Strength']) || 0,
    status: 'received',
    importedAt: new Date().toISOString(),
  };
}

// ── Batch write helper ────────────────────────────────────────────────────────
async function batchWrite(collectionRef, docs) {
  const BATCH_SIZE = 400;
  let count = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const ref = collectionRef.doc(doc.id);
      batch.set(ref, doc, { merge: true });
      count++;
    }

    await batch.commit();
    console.log(`  → Committed ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
  }

  return count;
}

// ── File configs ──────────────────────────────────────────────────────────────
const TRADE_FILES = [
  { file: 'Nexgent Degen Trade History - Live Mode.csv',       agentId: 'nexgent-degen',   mode: 'live' },
  { file: 'Nexgent Degen Trade History - Simulation Mode.csv', agentId: 'nexgent-degen',   mode: 'simulation' },
  { file: 'Nexgent Pro Trade History - Live Mode.csv',         agentId: 'nexgent-pro',     mode: 'live' },
  { file: 'Nexgent Pro Trade History - Simulation Mode.csv',   agentId: 'nexgent-pro',     mode: 'simulation' },
  { file: 'Nexgent Scalper Trade Histroy - Live Mode.csv',     agentId: 'nexgent-scalper', mode: 'live' },
  { file: 'Nexgent Scalper Trade Histroy - Simulation Mode.csv', agentId: 'nexgent-scalper', mode: 'simulation' },
  { file: 'Base Test Tarde Hisotry - Simulation Mode.csv',     agentId: 'nexgent-base',    mode: 'simulation' },
];

const SIGNAL_FILES = [
  { file: 'trading-signals-2026-02-22.csv' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Nexgent Agents Dashboard — Firestore Importer`);
  console.log(`   Firebase project: ${serviceAccount.project_id}`);
  console.log(`   User ID: ${USER_ID}\n`);

  const userRef = db.collection('users').doc(USER_ID);
  const tradesRef = userRef.collection('trades');
  const signalsRef = userRef.collection('signals');

  // Import trades
  for (const { file, agentId, mode } of TRADE_FILES) {
    const filePath = join(__dirname, file);
    try {
      const content = readFileSync(filePath, 'utf8');
      const rows = parseCSV(content);
      const trades = rows.map(r => mapTradeRow(r, agentId, mode));
      console.log(`📂 ${file}`);
      console.log(`   Agent: ${agentId} | Mode: ${mode} | Rows: ${trades.length}`);
      const saved = await batchWrite(tradesRef, trades);
      console.log(`   ✅ Saved ${saved} trades\n`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }
  }

  // Import signals
  for (const { file } of SIGNAL_FILES) {
    const filePath = join(__dirname, file);
    try {
      const content = readFileSync(filePath, 'utf8');
      const rows = parseCSV(content);
      const signals = rows.map(r => mapSignalRow(r));
      console.log(`📡 ${file}`);
      console.log(`   Rows: ${signals.length}`);
      const saved = await batchWrite(signalsRef, signals);
      console.log(`   ✅ Saved ${saved} signals\n`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }
  }

  console.log('🎉 Import complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
