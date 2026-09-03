/**
 * @file db.ts
 * @description Local-First IndexedDB Speicher-Layer für Konten, Buckets und Transaktionen.
 * Sämtliche Daten verbleiben zu 100% lokal im Browser des Nutzers.
 * @module services/storage/db
 */

import {
  Account,
  Category,
  Transaction,
  FinanceConfigExport,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  ResetOptions,
  DEFAULT_RESET_OPTIONS,
  sortTransactionsDesc,
  isTransactionOverridden,
  getTransactionType,
} from '@/types/finance';

const DB_NAME = 'personal_finance_analyzer_db';
const DB_VERSION = 6;
const STORES = {
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  /** @deprecated Altes Schema vor v3 */
  BUCKETS: 'buckets',
  TRANSACTIONS: 'transactions',
  DELETED_TRANSACTIONS: 'deleted_transactions',
} as const;

/**
 * In-Memory Fallback für Node-/Testumgebungen oder Browser mit deaktiviertem IndexedDB.
 */
class MemoryStorage {
  accounts: Map<string, Account> = new Map();
  categories: Map<string, Category> = new Map();
  transactions: Map<string, Transaction> = new Map();
  deletedTransactions: Map<string, Transaction> = new Map();

  // Alias für Abwärtskompatibilität
  get buckets(): Map<string, Category> {
    return this.categories;
  }

  clear() {
    this.accounts.clear();
    this.categories.clear();
    this.transactions.clear();
    this.deletedTransactions.clear();
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
 * Wendet Schema-Migrationen und Tabellenerstellungen auf eine IDBDatabase an.
 */
function applyMigrations(db: IDBDatabase, upgradeTx: IDBTransaction): void {
  if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
    db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
  }

  let categoryStore: IDBObjectStore;
  if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
    categoryStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
  } else {
    categoryStore = upgradeTx.objectStore(STORES.CATEGORIES);
  }

  // Falls eine ältere 'buckets'-Tabelle existiert, Datensätze migrieren
  if (db.objectStoreNames.contains(STORES.BUCKETS)) {
    const oldBucketStore = upgradeTx.objectStore(STORES.BUCKETS);
    const cursorReq = oldBucketStore.openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        categoryStore.put(cursor.value);
        cursor.continue();
      }
    };
  }

  let txStore: IDBObjectStore;
  if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
    txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
  } else {
    txStore = upgradeTx.objectStore(STORES.TRANSACTIONS);
  }

  if (!txStore.indexNames.contains('accountId')) {
    txStore.createIndex('accountId', 'accountId', { unique: false });
  }
  if (!txStore.indexNames.contains('categoryId')) {
    txStore.createIndex('categoryId', 'categoryId', { unique: false });
  }
  if (!txStore.indexNames.contains('bucketId')) {
    txStore.createIndex('bucketId', 'bucketId', { unique: false });
  }
  if (!txStore.indexNames.contains('valueDate')) {
    txStore.createIndex('valueDate', 'valueDate', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORES.DELETED_TRANSACTIONS)) {
    const delStore = db.createObjectStore(STORES.DELETED_TRANSACTIONS, { keyPath: 'id' });
    delStore.createIndex('valueDate', 'valueDate', { unique: false });
  }
}

/**
 * Öffnet die IndexedDB-Datenbank und führt ggf. Schema-Upgrades durch.
 * Besitzt eine Selbstheilung für den Fall, dass bestehende Browser-DBs benötigte Stores vermissen.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB ist nicht verfügbar.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = () => {
      console.warn('IndexedDB Upgrade wartet auf das Schließen älterer Verbindungen...');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const upgradeTx = (event.target as IDBOpenDBRequest).transaction!;
      applyMigrations(db, upgradeTx);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };

      // Selbstheilung: Prüfen, ob alle benötigten Stores existieren
      const requiredStores = [
        STORES.ACCOUNTS,
        STORES.CATEGORIES,
        STORES.TRANSACTIONS,
        STORES.DELETED_TRANSACTIONS,
      ];
      const hasMissing = requiredStores.some((s) => !db.objectStoreNames.contains(s));

      if (hasMissing) {
        const nextVersion = db.version + 1;
        db.close();
        const upgradeReq = window.indexedDB.open(DB_NAME, nextVersion);
        upgradeReq.onupgradeneeded = (ev) => {
          const upgradeDb = (ev.target as IDBOpenDBRequest).result;
          const upgradeTx = (ev.target as IDBOpenDBRequest).transaction!;
          applyMigrations(upgradeDb, upgradeTx);
        };
        upgradeReq.onsuccess = () => {
          const upgradedDb = upgradeReq.result;
          upgradedDb.onversionchange = () => {
            upgradedDb.close();
          };
          resolve(upgradedDb);
        };
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }

      resolve(db);
    };
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

  /* ================== CATEGORIES (BUCKETS) ================== */
  async getCategories(): Promise<Category[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.categories.values());
    }
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.CATEGORIES)) {
      const cats = await performStoreOperation<Category[]>(STORES.CATEGORIES, 'readonly', (store) =>
        store.getAll()
      );
      if (cats && cats.length > 0) {
        return cats;
      }
    }
    // Fallback: Ältere 'buckets'-Tabelle lesen falls 'categories' noch nicht befüllt ist
    if (db.objectStoreNames.contains(STORES.BUCKETS)) {
      const legacyBuckets = await performStoreOperation<Category[]>(
        STORES.BUCKETS,
        'readonly',
        (store) => store.getAll()
      );
      if (legacyBuckets && legacyBuckets.length > 0) {
        // Bei Verfügbarkeit in die neue Tabelle übertragen
        if (db.objectStoreNames.contains(STORES.CATEGORIES)) {
          await this.saveCategories(legacyBuckets);
        }
        return legacyBuckets;
      }
    }
    return [];
  },

  // Alias für Abwärtskompatibilität
  async getBuckets(): Promise<Category[]> {
    return this.getCategories();
  },

  async saveCategory(category: Category): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.categories.set(category.id, category);
      return;
    }
    const db = await openDB();
    const targetStore = db.objectStoreNames.contains(STORES.CATEGORIES)
      ? STORES.CATEGORIES
      : STORES.BUCKETS;
    await performStoreOperation(targetStore, 'readwrite', (store) => store.put(category));
  },

  // Alias für Abwärtskompatibilität
  async saveBucket(bucket: Category): Promise<void> {
    return this.saveCategory(bucket);
  },

  async saveCategories(categories: Category[]): Promise<void> {
    if (!isIndexedDBAvailable()) {
      categories.forEach((c) => memoryStore.categories.set(c.id, c));
      return;
    }
    const db = await openDB();
    const targetStore = db.objectStoreNames.contains(STORES.CATEGORIES)
      ? STORES.CATEGORIES
      : STORES.BUCKETS;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readwrite');
      const store = tx.objectStore(targetStore);
      categories.forEach((c) => store.put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Alias für Abwärtskompatibilität
  async saveBuckets(buckets: Category[]): Promise<void> {
    return this.saveCategories(buckets);
  },

  async deleteCategory(categoryId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.categories.delete(categoryId);
      return;
    }
    const db = await openDB();
    const targetStore = db.objectStoreNames.contains(STORES.CATEGORIES)
      ? STORES.CATEGORIES
      : STORES.BUCKETS;
    await performStoreOperation(targetStore, 'readwrite', (store) => store.delete(categoryId));
  },

  // Alias für Abwärtskompatibilität
  async deleteBucket(bucketId: string): Promise<void> {
    return this.deleteCategory(bucketId);
  },

  /* ================== TRANSACTIONS ================== */
  /**
   * Normalisiert ein Transaktionsobjekt und versieht es mit einem dynamischen Getter
   * für den virtuellen Transaktionstyp ('inbound' bzw. 'outbound').
   */
  normalizeTransaction(t: Transaction): Transaction {
    const catId = t.categoryId ?? t.bucketId ?? null;
    const { type: _discardedType, ...rest } = t;
    return {
      ...rest,
      categoryId: catId,
      bucketId: catId,
      get type() {
        return getTransactionType(this.value);
      },
    };
  },

  /**
   * Bereinigt ein Transaktionsobjekt vor der Persistierung (IndexedDB / Export),
   * sodass virtuelle Felder wie `type` niemals physisch gespeichert werden.
   */
  sanitizeForPersistence(tx: Transaction): Omit<Transaction, 'type'> {
    const catId = tx.categoryId ?? tx.bucketId ?? null;
    const { type: _discardedType, ...rest } = tx;
    return {
      ...rest,
      categoryId: catId,
      bucketId: catId,
    };
  },

  /**
   * Lädt alle Transaktionen. Standardmäßig über den 'valueDate'-Index
   * der IndexedDB und deterministisch absteigend nach Datum sortiert (neueste zuerst).
   * Versehen mit virtuellem `type`-Getter.
   *
   * @returns Promise mit Transaktionsliste
   */
  async getTransactions(): Promise<Transaction[]> {
    if (!isIndexedDBAvailable()) {
      const items = Array.from(memoryStore.transactions.values()).map((t) =>
        this.normalizeTransaction(t)
      );
      return sortTransactionsDesc(items);
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSACTIONS, 'readonly');
      const store = tx.objectStore(STORES.TRANSACTIONS);
      const results: Transaction[] = [];

      if (store.indexNames.contains('valueDate')) {
        const index = store.index('valueDate');
        const req = index.openCursor(null, 'prev');
        req.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            results.push(this.normalizeTransaction(cursor.value));
            cursor.continue();
          } else {
            resolve(sortTransactionsDesc(results));
          }
        };
        req.onerror = () => reject(req.error);
      } else {
        const req = store.getAll();
        req.onsuccess = () =>
          resolve(
            sortTransactionsDesc(
              (req.result as Transaction[]).map((t) => this.normalizeTransaction(t))
            )
          );
        req.onerror = () => reject(req.error);
      }
    });
  },

  async saveTransaction(tx: Transaction): Promise<void> {
    const sanitized = this.sanitizeForPersistence(tx);

    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.set(sanitized.id, sanitized as Transaction);
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) => store.put(sanitized));
  },

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    const sanitizedList = transactions.map((t) => this.sanitizeForPersistence(t));

    if (!isIndexedDBAvailable()) {
      sanitizedList.forEach((t) => memoryStore.transactions.set(t.id, t as Transaction));
      return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.TRANSACTIONS);
      sanitizedList.forEach((t) => store.put(t));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.delete(transactionId);
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) =>
      store.delete(transactionId)
    );
  },

  async clearTransactions(): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.transactions.clear();
      return;
    }
    await performStoreOperation(STORES.TRANSACTIONS, 'readwrite', (store) => store.clear());
  },

  /* ================== DELETED TRANSACTIONS ================== */
  /**
   * Lädt alle gelöschten Transaktionen (Papierkorb / Tombstones).
   *
   * @returns Promise mit Liste gelöschter Transaktionen (neueste zuerst)
   */
  async getDeletedTransactions(): Promise<Transaction[]> {
    if (!isIndexedDBAvailable()) {
      const items = Array.from(memoryStore.deletedTransactions.values()).map((t) =>
        this.normalizeTransaction(t)
      );
      return sortTransactionsDesc(items);
    }
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORES.DELETED_TRANSACTIONS)) return [];
    return new Promise((resolve, reject) => {
      const idbTx = db.transaction(STORES.DELETED_TRANSACTIONS, 'readonly');
      const store = idbTx.objectStore(STORES.DELETED_TRANSACTIONS);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve(
          sortTransactionsDesc(
            (req.result as Transaction[]).map((t) => this.normalizeTransaction(t))
          )
        );
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Verschiebt eine Transaktion in den Papierkorb (gelöschte Transaktionen).
   * Setzt `deletedAt` auf den aktuellen Zeitstempel.
   *
   * @param tx - Die zu löschende Transaktion
   */
  async saveDeletedTransaction(tx: Transaction): Promise<void> {
    const withTimestamp: Transaction = { ...tx, deletedAt: new Date().toISOString() };
    const sanitized = this.sanitizeForPersistence(withTimestamp);
    if (!isIndexedDBAvailable()) {
      memoryStore.deletedTransactions.set(sanitized.id, sanitized as Transaction);
      return;
    }
    await performStoreOperation(STORES.DELETED_TRANSACTIONS, 'readwrite', (store) =>
      store.put(sanitized)
    );
  },

  /**
   * Speichert mehrere gelöschte Transaktionen (z. B. beim Konfigurationsimport).
   */
  async saveDeletedTransactions(transactions: Transaction[]): Promise<void> {
    const sanitizedList = transactions.map((t) => this.sanitizeForPersistence(t));
    if (!isIndexedDBAvailable()) {
      sanitizedList.forEach((t) => memoryStore.deletedTransactions.set(t.id, t as Transaction));
      return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const idbTx = db.transaction(STORES.DELETED_TRANSACTIONS, 'readwrite');
      const store = idbTx.objectStore(STORES.DELETED_TRANSACTIONS);
      sanitizedList.forEach((t) => store.put(t));
      idbTx.oncomplete = () => resolve();
      idbTx.onerror = () => reject(idbTx.error);
    });
  },

  /**
   * Entfernt eine gelöschte Transaktion endgültig aus dem Papierkorb.
   */
  async permanentlyDeleteTransaction(transactionId: string): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.deletedTransactions.delete(transactionId);
      return;
    }
    await performStoreOperation(STORES.DELETED_TRANSACTIONS, 'readwrite', (store) =>
      store.delete(transactionId)
    );
  },

  async clearDeletedTransactions(): Promise<void> {
    if (!isIndexedDBAvailable()) {
      memoryStore.deletedTransactions.clear();
      return;
    }
    await performStoreOperation(STORES.DELETED_TRANSACTIONS, 'readwrite', (store) => store.clear());
  },

  /* ================== EXPORT & IMPORT ================== */
  async exportConfiguration(
    options: ExportOptions = DEFAULT_EXPORT_OPTIONS
  ): Promise<FinanceConfigExport> {
    const [accounts, categories, transactions, deletedTransactions] = await Promise.all([
      this.getAccounts(),
      this.getCategories(),
      this.getTransactions(),
      this.getDeletedTransactions(),
    ]);

    const result: FinanceConfigExport = {
      version: 2,
      exportedAt: new Date().toISOString(),
    };

    if (options.includeAccounts) {
      result.accounts = accounts;
    }

    if (options.includeCategories) {
      result.categories = categories;
      result.buckets = categories;
    }

    if (options.includeTransactions) {
      result.transactions = transactions.map((t) => this.sanitizeForPersistence(t) as Transaction);
    }

    if (options.includeManualTransactions) {
      result.manualTransactions = transactions
        .filter((t) => t.origin === 'manual' || isTransactionOverridden(t))
        .map((t) => this.sanitizeForPersistence(t) as Transaction);
    }

    if (options.includeDeletedTransactions) {
      result.deletedTransactions = deletedTransactions.map(
        (t) => this.sanitizeForPersistence(t) as Transaction
      );
    }

    return result;
  },

  async importConfiguration(config: FinanceConfigExport): Promise<void> {
    const categoriesToImport = config.categories || config.buckets;
    const hasAccounts = Array.isArray(config.accounts);
    const hasCategories = Array.isArray(categoriesToImport);
    const hasTransactions = Array.isArray(config.transactions);
    const hasManualTransactions = Array.isArray(config.manualTransactions);
    const hasDeletedTransactions = Array.isArray(config.deletedTransactions);

    if (!config || (!hasAccounts && !hasCategories && !hasTransactions && !hasManualTransactions)) {
      throw new Error('Ungültiges Konfigurationsformat.');
    }

    if (!isIndexedDBAvailable()) {
      if (hasAccounts) {
        memoryStore.accounts.clear();
        config.accounts!.forEach((acc) => memoryStore.accounts.set(acc.id, acc));
      }
      if (hasCategories) {
        memoryStore.categories.clear();
        categoriesToImport!.forEach((c) => memoryStore.categories.set(c.id, c));
      }
      if (hasTransactions) {
        memoryStore.transactions.clear();
        config.transactions!.forEach((t) =>
          memoryStore.transactions.set(t.id, this.sanitizeForPersistence(t) as Transaction)
        );
      } else if (hasManualTransactions) {
        config.manualTransactions!.forEach((t) =>
          memoryStore.transactions.set(t.id, this.sanitizeForPersistence(t) as Transaction)
        );
      }
      if (hasDeletedTransactions) {
        memoryStore.deletedTransactions.clear();
        config.deletedTransactions!.forEach((t) =>
          memoryStore.deletedTransactions.set(t.id, this.sanitizeForPersistence(t) as Transaction)
        );
      }
      return;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const candidates: string[] = [];
      if (hasAccounts) candidates.push(STORES.ACCOUNTS);
      if (hasCategories) {
        candidates.push(STORES.CATEGORIES);
        candidates.push(STORES.BUCKETS);
      }
      if (hasTransactions || hasManualTransactions) {
        candidates.push(STORES.TRANSACTIONS);
      }
      if (hasDeletedTransactions) {
        candidates.push(STORES.DELETED_TRANSACTIONS);
      }
      const storeNames = candidates.filter((name) => db.objectStoreNames.contains(name));
      const idbTx = db.transaction(storeNames, 'readwrite');

      if (hasAccounts && db.objectStoreNames.contains(STORES.ACCOUNTS)) {
        const accStore = idbTx.objectStore(STORES.ACCOUNTS);
        accStore.clear();
        config.accounts!.forEach((acc) => accStore.put(acc));
      }

      if (hasCategories) {
        if (db.objectStoreNames.contains(STORES.CATEGORIES)) {
          const catStore = idbTx.objectStore(STORES.CATEGORIES);
          catStore.clear();
          categoriesToImport!.forEach((c) => catStore.put(c));
        }
        if (db.objectStoreNames.contains(STORES.BUCKETS)) {
          const bucketStore = idbTx.objectStore(STORES.BUCKETS);
          bucketStore.clear();
          categoriesToImport!.forEach((c) => bucketStore.put(c));
        }
      }

      if (hasTransactions && db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = idbTx.objectStore(STORES.TRANSACTIONS);
        txStore.clear();
        config.transactions!.forEach((t) => txStore.put(this.sanitizeForPersistence(t)));
      } else if (hasManualTransactions && db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = idbTx.objectStore(STORES.TRANSACTIONS);
        config.manualTransactions!.forEach((t) => txStore.put(this.sanitizeForPersistence(t)));
      }

      if (hasDeletedTransactions && db.objectStoreNames.contains(STORES.DELETED_TRANSACTIONS)) {
        const delStore = idbTx.objectStore(STORES.DELETED_TRANSACTIONS);
        delStore.clear();
        config.deletedTransactions!.forEach((t) => delStore.put(this.sanitizeForPersistence(t)));
      }

      idbTx.oncomplete = () => resolve();
      idbTx.onerror = () => reject(idbTx.error);
    });
  },

  /**
   * Setzt selektive Stores in der Datenbank zurück oder leert sie.
   */
  async resetDatabase(options: ResetOptions = DEFAULT_RESET_OPTIONS): Promise<void> {
    const storesToClear: string[] = [];
    if (options.resetAccounts) storesToClear.push(STORES.ACCOUNTS);
    if (options.resetCategories) {
      storesToClear.push(STORES.CATEGORIES);
      storesToClear.push(STORES.BUCKETS);
    }
    if (options.resetTransactions) storesToClear.push(STORES.TRANSACTIONS);
    if (options.resetDeletedTransactions) storesToClear.push(STORES.DELETED_TRANSACTIONS);

    if (!isIndexedDBAvailable()) {
      if (options.resetAccounts) memoryStore.accounts.clear();
      if (options.resetCategories) memoryStore.categories.clear();
      if (options.resetTransactions) memoryStore.transactions.clear();
      if (options.resetDeletedTransactions) memoryStore.deletedTransactions.clear();
      return;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const storeNames = storesToClear.filter((name) => db.objectStoreNames.contains(name));
      if (storeNames.length === 0) {
        resolve();
        return;
      }
      const idbTx = db.transaction(storeNames, 'readwrite');
      storeNames.forEach((name) => {
        idbTx.objectStore(name).clear();
      });
      idbTx.oncomplete = () => resolve();
      idbTx.onerror = () => reject(idbTx.error);
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
        const candidates = [
          STORES.ACCOUNTS,
          STORES.CATEGORIES,
          STORES.BUCKETS,
          STORES.TRANSACTIONS,
          STORES.DELETED_TRANSACTIONS,
        ];
        const storeNames = candidates.filter((name) => db.objectStoreNames.contains(name));
        if (storeNames.length === 0) {
          resolve();
          return;
        }
        const idbTx = db.transaction(storeNames, 'readwrite');
        storeNames.forEach((name) => {
          idbTx.objectStore(name).clear();
        });
        idbTx.oncomplete = () => resolve();
        idbTx.onerror = () => reject(idbTx.error);
      });
    }
  },
};
