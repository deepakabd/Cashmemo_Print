/**
 * Native IndexedDB storage helper for Sales Report data.
 * Solves localStorage 5MB quota limit by providing high-capacity client-side persistence
 * capable of storing 50,000+ transaction rows seamlessly.
 */

const DB_NAME = 'CashMemoSalesReportDB';
const DB_VERSION = 1;
const STORE_NAME = 'salesReports';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB open failed:', request.error);
      resolve(null);
    };
  });
}

/**
 * Persist full normalized sales report data into IndexedDB
 */
export async function saveSalesReportToIndexedDB(key, data) {
  try {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, key);
      req.onsuccess = () => resolve(true);
      req.onerror = (err) => {
        console.warn('IndexedDB put error:', err);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('saveSalesReportToIndexedDB exception:', err);
    return false;
  }
}

/**
 * Load full normalized sales report data from IndexedDB
 */
export async function loadSalesReportFromIndexedDB(key) {
  try {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (err) => {
        console.warn('IndexedDB get error:', err);
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('loadSalesReportFromIndexedDB exception:', err);
    return null;
  }
}

/**
 * Delete a report from IndexedDB
 */
export async function deleteSalesReportFromIndexedDB(key) {
  try {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

