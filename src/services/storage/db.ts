/**
 * @file db.ts
 * @description Local-First IndexedDB Speicher-Layer für Konten, Buckets und Transaktionen.
 * Sämtliche Daten verbleiben zu 100% lokal im Browser des Nutzers.
 * @module services/storage/db
 */

import { Account, Bucket, Transaction, FinanceConfigExport } from '@/types/finance';

const DB_NAME = 'personal_finance_analyzer_db';
const DB_VERSION = 1;

const STORES = {
  ACCOUNTS: 'accounts',
  BUCKETS: 'buckets',
  TRANSACTIONS: 'transactions',
} as const;

/**
 * In-Memory Fallback für Node-/Testumgebungen oder Browser mit deaktiviertem IndexedDB.
 */
class MemoryStorage {
  accounts: Map<string, Account> = new Map();
  buckets: Map<string, Bucket> = new Map();
  transactions: Map<string, Transaction> = new Map();

  clear() {
    this.accounts.clear();
    this.buckets.clear();
    this.transactions.clear();
  }
}

const memoryStore = new MemoryStorage();

/**
 * Prüft, ob IndexedDB im aktuellen Environment verfügbar ist.
 */
function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

/**
 * Öffnet die IndexedDB-Datenbank und führt ggf. Schema-Upgrades durch.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB ist nicht verfügbar.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
        db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.BUCKETS)) {
        db.createObjectStore(STORES.BUCKETS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('accountId', 'accountId', { unique: false });
        txStore.createIndex('bucketId', 'bucketId', { unique: false });
        txStore.createIndex('valueDate', 'valueDate', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Führt eine generische Transaktion auf einem ObjectStore aus.
 */
async function performStoreOperation<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let req: IDBRequest<T> | undefined;

    try {
      const result = operation(store);
      if (result) {
        req = result;
      }
    } catch (err) {
      reject(err);
      return;
    }

    tx.oncomplete = () => {
      resolve(req ? req.result : (undefined as unknown as T));
    };
    tx.onerror = () => reject(tx.error);
  });
}

export const financeDB = {
  /* ================== ACCOUNTS ================== */
  async getAccounts(): Promise<Account[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.accounts.values());
    }
    return performStoreOperation<Account[]>(STORES.ACCOUNTS, 'readonly', (store) => store.getAll());
  },

  async saveAccount(account: Account): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.accounts.set(account.id, account);
      return;
    }
    await performStoreOperation(STORES.ACCOUNTS, 'readwrite', (store) => store.put(account));
  },

  async saveAccounts(accounts: Account[]): Promise<void> {
    if (!isIndexedDBAvailable()) {
      accounts.forEach((a) => memoryStore.accounts.set(a.id, a));
      return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
      const store = tx.objectStore(STORES.ACCOUNTS);
      accounts.forEach((a) => store.put(a));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteAccount(accountId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.accounts.delete(accountId);
      return;
    }
    await performStoreOperation(STORES.ACCOUNTS, 'readwrite', (store) => store.delete(accountId));
  },

  /* ================== BUCKETS ================== */
  async getBuckets(): Promise<Bucket[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.buckets.values());
    }
    return performStoreOperation<Bucket[]>(STORES.BUCKETS, 'readonly', (store) => store.getAll());
  },

  async saveBucket(bucket: Bucket): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.buckets.set(bucket.id, bucket);
      return;
    }
    await performStoreOperation(STORES.BUCKETS, 'readwrite', (store) => store.put(bucket));
  },

  async saveBuckets(buckets: Bucket[]): Promise<void> {
    if (!isIndexedDBAvailable()) {
      buckets.forEach((b) => memoryStore.buckets.set(b.id, b));
      return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BUCKETS, 'readwrite');
      const store = tx.objectStore(STORES.BUCKETS);
      buckets.forEach((b) => store.put(b));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteBucket(bucketId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.buckets.delete(bucketId);
      return;
    }
    await performStoreOperation(STORES.BUCKETS, 'readwrite', (store) => store.delete(bucketId));
  },

  /* ================== TRANSACTIONS ================== */
  async getTransactions(): Promise<Transaction[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.transactions.values());
    }
    return performStoreOperation<Transaction[]>(STORES.TRANSACTIONS, 'readonly', (store) => store.getAll());
  },

  async saveTransaction(tx: Transaction): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.set(tx.id, tx);
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) => store.put(tx));
  },

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    if (!isIndexedDBAvailable()) {
      transactions.forEach((t) => memoryStore.transactions.set(t.id, t));
      return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.TRANSACTIONS);
      transactions.forEach((t) => store.put(t));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.delete(transactionId);
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) => store.delete(transactionId));
  },

  async clearTransactions(): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.clear();
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) => store.clear());
  },

  /* ================== EXPORT & IMPORT ================== */
  async exportConfiguration(): Promise<FinanceConfigExport> {
    const [accounts, buckets] = await Promise.all([
      this.getAccounts(),
      this.getBuckets(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts,
      buckets,
    };
  },

  async importConfiguration(config: FinanceConfigExport): Promise<void> {
    if (!config || !Array.isArray(config.accounts) || !Array.isArray(config.buckets)) {
      throw new Error('Ungültiges Konfigurationsformat.');
    }

    if (!isIndexedDBAvailable()) {
      memoryStore.accounts.clear();
      memoryStore.buckets.clear();
      config.accounts.forEach((acc) => memoryStore.accounts.set(acc.id, acc));
      config.buckets.forEach((b) => memoryStore.buckets.set(b.id, b));
      return;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ACCOUNTS, STORES.BUCKETS], 'readwrite');
      const accStore = tx.objectStore(STORES.ACCOUNTS);
      const bucketStore = tx.objectStore(STORES.BUCKETS);

      accStore.clear();
      bucketStore.clear();

      config.accounts.forEach((acc) => accStore.put(acc));
      config.buckets.forEach((b) => bucketStore.put(b));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Löscht die gesamte lokale Datenbank (für Tests oder Reset).
   */
  async clearAll(): Promise<void> {
    memoryStore.clear();
    if (isIndexedDBAvailable()) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.ACCOUNTS, STORES.BUCKETS, STORES.TRANSACTIONS], 'readwrite');
        tx.objectStore(STORES.ACCOUNTS).clear();
        tx.objectStore(STORES.BUCKETS).clear();
        tx.objectStore(STORES.TRANSACTIONS).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  },
};
