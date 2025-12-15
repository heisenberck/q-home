
import { getDocs, onSnapshot } from 'firebase/firestore';

// CONFIGURATION
const MAX_READS_PER_MINUTE = 200;
const RESET_INTERVAL_MS = 60000; // 1 Minute

// STATE (In-Memory)
let readCount = 0;
let windowStart = Date.now();
let isSafetyLocked = false;

// INTERNAL: Check and Increment
const checkSafetyQuota = (operationType) => {
  const now = Date.now();

  // 1. Reset window if time passed
  if (now - windowStart > RESET_INTERVAL_MS) {
    console.log(`[Firestore Guard] Resetting quota. Previous count: ${readCount}`);
    readCount = 0;
    windowStart = now;
    isSafetyLocked = false;
  }

  // 2. Check Lock
  if (isSafetyLocked) {
    const errorMsg = `🔥 SAFETY STOP: Infinite Loop Detected! (> ${MAX_READS_PER_MINUTE} reads/min). Execution blocked.`;
    console.error(errorMsg);
    window.dispatchEvent(new CustomEvent('firestore-safety-stop', { detail: { message: errorMsg } }));
    throw new Error(errorMsg);
  }

  // 3. Increment & Lock if needed
  readCount++;
  
  if (process.env.NODE_ENV === 'development') {
      console.debug(`[Firestore Guard] Read #${readCount} (${operationType})`);
  }

  if (readCount > MAX_READS_PER_MINUTE) {
    isSafetyLocked = true;
    checkSafetyQuota(operationType); // Recursively call to throw error immediately
  }
};

// --- WRAPPERS ---

export const safeGetDocs = async (query) => {
  checkSafetyQuota('getDocs');
  return getDocs(query);
};

export const safeOnSnapshot = (query, callback, errorCallback) => {
  checkSafetyQuota('onSnapshot');
  return onSnapshot(query, callback, errorCallback);
};

export const resetSafetyCounter = () => {
  readCount = 0;
  windowStart = Date.now();
  isSafetyLocked = false;
  console.log('[Firestore Guard] Manual Reset Triggered.');
};
