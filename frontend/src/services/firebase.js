/**
 * Firebase Configuration with Authentication
 * Uses server-synced user ID for consistent data access
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============ AUTHENTICATION ============

let currentUser = null;
let serverUserId = null; // Synced from server for consistent data access

/**
 * Fetch the server's configured user ID
 * This ensures dashboard uses the same user ID as the webhook
 */
const fetchServerUserId = async () => {
  try {
    const response = await fetch('/api/auth/user');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.userId) {
        serverUserId = data.userId;
        // Also store in localStorage for offline access
        localStorage.setItem('firebase_user_id', data.userId);
        console.log('✅ Server User ID synced:', serverUserId);
        return serverUserId;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch server user ID:', error.message);
  }

  // Fallback to localStorage if server unavailable
  const storedId = localStorage.getItem('firebase_user_id');
  if (storedId) {
    serverUserId = storedId;
    console.log('📦 Using cached user ID:', serverUserId);
    return serverUserId;
  }

  return null;
};

/**
 * Initialize authentication
 * Uses server-synced user ID for data access
 */
export const initAuth = () => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        console.log('✅ Firebase Auth: User signed in:', user.uid);
      } else {
        // Sign in anonymously for Firebase security rules
        try {
          const result = await signInAnonymously(auth);
          currentUser = result.user;
          console.log('✅ Firebase Auth: Anonymous sign in:', result.user.uid);
        } catch (error) {
          console.error('❌ Firebase Auth error:', error);
          reject(error);
          return;
        }
      }

      // Sync with server's user ID for data access
      await fetchServerUserId();

      // If no server ID, use the auth UID and save it
      if (!serverUserId && currentUser) {
        serverUserId = currentUser.uid;
        localStorage.setItem('firebase_user_id', serverUserId);
        console.log('📝 Using auth UID as user ID:', serverUserId);
      }

      resolve(currentUser);
    });
  });
};

/**
 * Sign in with email/password
 */
export const signInWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  currentUser = result.user;
  return result.user;
};

/**
 * Create account with email/password
 */
export const createAccount = async (email, password) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  currentUser = result.user;
  return result.user;
};

/**
 * Sign out
 */
export const signOutUser = async () => {
  await signOut(auth);
  currentUser = null;
};

/**
 * Get current user ID (server-synced for data access)
 */
export const getUserId = () => serverUserId || currentUser?.uid || null;

// ============ FIRESTORE HELPERS ============

/**
 * Get user-scoped collection reference
 */
const getUserCollection = (collectionName) => {
  const userId = getUserId();
  if (!userId) throw new Error('User not authenticated');
  return collection(db, 'users', userId, collectionName);
};

/**
 * Get user-scoped document reference
 */
const getUserDoc = (collectionName, docId) => {
  const userId = getUserId();
  if (!userId) throw new Error('User not authenticated');
  return doc(db, 'users', userId, collectionName, docId);
};

// ============ TRADES ============

/**
 * Save a trade to Firestore
 */
export const saveTrade = async (trade) => {
  if (!trade.id) {
    trade.id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  const tradeDoc = getUserDoc('trades', trade.id);
  await setDoc(tradeDoc, {
    ...trade,
    updatedAt: serverTimestamp(),
    createdAt: trade.createdAt || serverTimestamp(),
  }, { merge: true });

  console.log('💾 Trade saved to Firebase:', trade.id);
  return trade;
};

/**
 * Save multiple trades (batch)
 */
export const saveTradesBatch = async (trades) => {
  const userId = getUserId();
  if (!userId) throw new Error('User not authenticated');

  const batch = writeBatch(db);

  trades.forEach(trade => {
    if (!trade.id) {
      trade.id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const tradeRef = doc(db, 'users', userId, 'trades', trade.id);
    batch.set(tradeRef, {
      ...trade,
      updatedAt: serverTimestamp(),
      createdAt: trade.createdAt || serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  console.log(`💾 Batch saved ${trades.length} trades to Firebase`);
};

/**
 * Get all trades from Firestore
 */
export const getTrades = async (limitCount = 1000) => {
  const tradesCol = getUserCollection('trades');
  const q = query(tradesCol, orderBy('timestamp', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Get trades by agent
 */
export const getTradesByAgent = async (agentId, limitCount = 500) => {
  const tradesCol = getUserCollection('trades');
  const q = query(
    tradesCol,
    where('agentId', '==', agentId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Delete a trade and track its ID to prevent re-sync
 */
export const deleteTrade = async (tradeId) => {
  const tradeDoc = getUserDoc('trades', tradeId);
  await deleteDoc(tradeDoc);

  // Track deleted trade ID to prevent re-sync from agent
  await addDeletedTradeId(tradeId);

  console.log('🗑️ Trade deleted from Firebase:', tradeId);
};

/**
 * Add a trade ID to the deleted trades list
 */
export const addDeletedTradeId = async (tradeId) => {
  const userId = getUserId();
  if (!userId) return;

  const deletedDoc = doc(db, 'users', userId, 'deletedTrades', tradeId);
  await setDoc(deletedDoc, {
    deletedAt: serverTimestamp(),
  });
};

/**
 * Get all deleted trade IDs
 */
export const getDeletedTradeIds = async () => {
  const userId = getUserId();
  if (!userId) return new Set();

  const deletedCol = collection(db, 'users', userId, 'deletedTrades');
  const snapshot = await getDocs(deletedCol);
  return new Set(snapshot.docs.map(doc => doc.id));
};

/**
 * Subscribe to trades (real-time updates)
 */
export const subscribeToTrades = (callback, limitCount = 500) => {
  const userId = getUserId();
  if (!userId) {
    console.error('Cannot subscribe: User not authenticated');
    return () => {};
  }

  const tradesCol = collection(db, 'users', userId, 'trades');
  const q = query(tradesCol, orderBy('timestamp', 'desc'), limit(limitCount));

  return onSnapshot(q, (snapshot) => {
    const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(trades);
  }, (error) => {
    console.error('Firebase subscription error:', error);
  });
};

// ============ SETTINGS ============

/**
 * Save settings to Firestore
 */
export const saveSettings = async (settings) => {
  const settingsDoc = getUserDoc('settings', 'trading');
  await setDoc(settingsDoc, {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log('💾 Settings saved to Firebase');
};

/**
 * Get settings from Firestore
 */
export const getSettings = async () => {
  const settingsDoc = getUserDoc('settings', 'trading');
  const snapshot = await getDoc(settingsDoc);
  return snapshot.exists() ? snapshot.data() : null;
};

/**
 * Subscribe to settings changes
 */
export const subscribeToSettings = (callback) => {
  const userId = getUserId();
  if (!userId) return () => {};

  const settingsDoc = doc(db, 'users', userId, 'settings', 'trading');
  return onSnapshot(settingsDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  });
};

// ============ AGENTS ============

/**
 * Save agents configuration
 */
export const saveAgents = async (agents) => {
  if (!currentUser) {
    // Skip saving if not authenticated yet - will save on next update after auth
    return;
  }
  const agentsDoc = getUserDoc('config', 'agents');
  await setDoc(agentsDoc, {
    agents,
    updatedAt: serverTimestamp(),
  });
  console.log('💾 Agents saved to Firebase');
};

/**
 * Get agents configuration
 */
export const getAgents = async () => {
  const agentsDoc = getUserDoc('config', 'agents');
  const snapshot = await getDoc(agentsDoc);
  return snapshot.exists() ? snapshot.data().agents : [];
};

/**
 * Subscribe to agents changes
 */
export const subscribeToAgents = (callback) => {
  const userId = getUserId();
  if (!userId) return () => {};

  const agentsDoc = doc(db, 'users', userId, 'config', 'agents');
  return onSnapshot(agentsDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data().agents : []);
  });
};

// ============ TOKEN PERFORMANCE (Learning System Mirror) ============

/**
 * Save token performance data
 */
export const saveTokenPerformance = async (tokenData) => {
  const tokenDoc = getUserDoc('tokenPerformance', tokenData.symbol);
  await setDoc(tokenDoc, {
    ...tokenData,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Get all token performance data
 */
export const getTokenPerformance = async () => {
  const tokensCol = getUserCollection('tokenPerformance');
  const snapshot = await getDocs(tokensCol);
  return snapshot.docs.map(doc => ({ symbol: doc.id, ...doc.data() }));
};

// ============ EXPORT ============

export { app, auth, db };

export default {
  initAuth,
  signInWithEmail,
  createAccount,
  signOutUser,
  getUserId,
  saveTrade,
  saveTradesBatch,
  getTrades,
  getTradesByAgent,
  deleteTrade,
  getDeletedTradeIds,
  subscribeToTrades,
  saveSettings,
  getSettings,
  subscribeToSettings,
  saveAgents,
  getAgents,
  subscribeToAgents,
  saveTokenPerformance,
  getTokenPerformance,
};
