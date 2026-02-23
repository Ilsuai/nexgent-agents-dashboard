/**
 * Firebase Admin SDK initialization
 * Used by the Express backend to read/write Firestore
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db = null;

export function initFirebase() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
  return db;
}

export function getDb() {
  if (!db) {
    initFirebase();
  }
  return db;
}

export function getUserId() {
  const userId = process.env.FIREBASE_USER_ID;
  if (!userId) {
    throw new Error('FIREBASE_USER_ID environment variable not set');
  }
  return userId;
}
