/**
 * @file FinanceContext.tsx
 * @description Zentraler React Context State für Konten, Buckets und Transaktionen
 * mit persistenter IndexedDB-Synchronisation und automatischem Matching.
 * @module services/storage/FinanceContext
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Account,
  BalanceEntry,
  Bucket,
  FinanceConfigExport,
  Transaction,
} from '@/types/finance';
import { financeDB } from './db';
import { matchTransaction, reMatchAllTransactions } from '../matcher/regexMatcher';

export interface FinanceContextType {
  accounts: Account[];
  buckets: Bucket[];
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  // Bucket Operations
  addBucket: (bucket: Omit<Bucket, 'id'>) => Promise<Bucket>;
  updateBucket: (bucket: Bucket) => Promise<void>;
  deleteBucket: (bucketId: string) => Promise<void>;
  reorderBuckets: (updatedBuckets: Bucket[]) => Promise<void>;

  // Account Operations
  addAccount: (account: Omit<Account, 'id'>) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  reorderAccounts: (updatedAccounts: Account[]) => Promise<void>;
  addBalanceEntry: (accountId: string, entry: Omit<BalanceEntry, 'id'>) => Promise<void>;
  deleteBalanceEntry: (accountId: string, entryId: string) => Promise<void>;

  // Transaction Operations
  importTransactions: (newTransactions: Transaction[]) => Promise<number>;
  assignTransactionBucket: (transactionId: string, bucketId: string | null) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  triggerReMatch: () => Promise<void>;

  // Export & Import
  exportConfiguration: () => Promise<string>;
  importConfiguration: (jsonContent: string) => Promise<void>;
  resetWorkspace: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const SEED_ACCOUNTS: Account[] = [
  {
    id: 'acc-giro-main',
    name: 'Haupt-Girokonto',
    currency: 'EUR',
    color: '#3b82f6',
    icon: 'Landmark',
    bucketIds: ['b-living', 'b-rent', 'b-groceries', 'b-salary', 'b-leisure'],
    balanceEntries: [
      {
        id: 'be-seed-1',
        date: '2026-08-01',
        amount: 3500,
        note: 'Eröffnungssaldo',
      },
    ],
  },
];

const SEED_BUCKETS: Bucket[] = [
  {
    id: 'b-living',
    name: 'Wohnen & Fixkosten',
    parentId: null,
    color: '#f59e0b',
    icon: 'Home',
    targetBudget: { period: 'monthly', amount: 1400 },
  },
  {
    id: 'b-rent',
    name: 'Miete & Nebenkosten',
    parentId: 'b-living',
    color: '#fbbf24',
    icon: 'Key',
    regexPattern: 'Miete|Vermieter|Hausverwaltung|Stadtwerke',
  },
  {
    id: 'b-groceries',
    name: 'Lebensmittel & Haushalt',
    parentId: null,
    color: '#10b981',
    icon: 'ShoppingBag',
    regexPattern: 'Rewe|Edeka|Aldi|Lidl|Kaufland|dm-drogerie|Rossmann',
    targetBudget: { period: 'monthly', amount: 500 },
  },
  {
    id: 'b-leisure',
    name: 'Freizeit & Gastronomie',
    parentId: null,
    color: '#ec4899',
    icon: 'Coffee',
    regexPattern: 'Restaurant|Cafe|Kino|Spotify|Netflix|Amazon Prime',
    targetBudget: { period: 'monthly', amount: 300 },
  },
  {
    id: 'b-salary',
    name: 'Gehalt & Einkommen',
    parentId: null,
    color: '#22c55e',
    icon: 'DollarSign',
    regexPattern: 'Gehalt|Lohn|Arbeitgeber|Bonus',
  },
];

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initiales Laden aus IndexedDB / Seeden bei erstem Start
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let loadedAccounts = await financeDB.getAccounts();
      let loadedBuckets = await financeDB.getBuckets();
      const loadedTransactions = await financeDB.getTransactions();

      if (loadedAccounts.length === 0 && loadedBuckets.length === 0) {
        // Erstmaliges Seeden
        await Promise.all([
          ...SEED_ACCOUNTS.map((a) => financeDB.saveAccount(a)),
          ...SEED_BUCKETS.map((b) => financeDB.saveBucket(b)),
        ]);
        loadedAccounts = SEED_ACCOUNTS;
        loadedBuckets = SEED_BUCKETS;
      }

      setAccounts(loadedAccounts);
      setBuckets(loadedBuckets);
      setTransactions(loadedTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Finanzdaten.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ================== ACCOUNTS ================== */
  const addAccount = async (accountData: Omit<Account, 'id'>): Promise<Account> => {
    const newAccount: Account = {
      ...accountData,
      id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      balanceEntries: accountData.balanceEntries || [],
      bucketIds: accountData.bucketIds || [],
    };
    await financeDB.saveAccount(newAccount);
    setAccounts((prev) => [...prev, newAccount]);
    return newAccount;
  };

  const updateAccount = async (updated: Account): Promise<void> => {
    await financeDB.saveAccount(updated);
    setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const deleteAccount = async (accountId: string): Promise<void> => {
    await financeDB.deleteAccount(accountId);
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  };

  const reorderAccounts = async (updatedAccounts: Account[]): Promise<void> => {
    await financeDB.saveAccounts(updatedAccounts);
    setAccounts(updatedAccounts);
  };

  const addBalanceEntry = async (
    accountId: string,
    entryData: Omit<BalanceEntry, 'id'>
  ): Promise<void> => {
    const targetAccount = accounts.find((a) => a.id === accountId);
    if (!targetAccount) throw new Error('Konto nicht gefunden.');

    const newEntry: BalanceEntry = {
      ...entryData,
      id: `be-${Date.now()}`,
    };

    const updatedAccount: Account = {
      ...targetAccount,
      balanceEntries: [...targetAccount.balanceEntries, newEntry].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };

    await updateAccount(updatedAccount);
  };

  const deleteBalanceEntry = async (accountId: string, entryId: string): Promise<void> => {
    const targetAccount = accounts.find((a) => a.id === accountId);
    if (!targetAccount) return;

    const updatedAccount: Account = {
      ...targetAccount,
      balanceEntries: targetAccount.balanceEntries.filter((e) => e.id !== entryId),
    };

    await updateAccount(updatedAccount);
  };

  /* ================== BUCKETS ================== */
  const addBucket = async (bucketData: Omit<Bucket, 'id'>): Promise<Bucket> => {
    const newBucket: Bucket = {
      ...bucketData,
      id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      manualTransactionIds: [],
    };
    await financeDB.saveBucket(newBucket);
    const updatedBuckets = [...buckets, newBucket];
    setBuckets(updatedBuckets);

    // Re-matching für alle nicht manuellen Transaktionen
    const updatedTxs = reMatchAllTransactions(transactions, updatedBuckets);
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);

    return newBucket;
  };

  const updateBucket = async (updated: Bucket): Promise<void> => {
    await financeDB.saveBucket(updated);
    const updatedBuckets = buckets.map((b) => (b.id === updated.id ? updated : b));
    setBuckets(updatedBuckets);

    // Re-Matching
    const updatedTxs = reMatchAllTransactions(transactions, updatedBuckets);
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  const reorderBuckets = async (updatedBuckets: Bucket[]): Promise<void> => {
    await financeDB.saveBuckets(updatedBuckets);
    setBuckets(updatedBuckets);

    // Re-matching falls sich Hierarchien geändert haben
    const updatedTxs = reMatchAllTransactions(transactions, updatedBuckets);
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  const deleteBucket = async (bucketId: string): Promise<void> => {
    await financeDB.deleteBucket(bucketId);
    const updatedBuckets = buckets.filter((b) => b.id !== bucketId);
    setBuckets(updatedBuckets);

    // Transaktionen bereinigen, die diesem Bucket zugeordnet waren
    const updatedTxs = transactions.map((t) =>
      t.bucketId === bucketId
        ? { ...t, bucketId: null, assignmentSource: 'unassigned' as const }
        : t
    );
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  /* ================== TRANSACTIONS ================== */
  const importTransactions = async (newTransactions: Transaction[]): Promise<number> => {
    // 1. Regex & Manual Overrides anwenden
    const matched = newTransactions.map((tx) => {
      const match = matchTransaction(tx, buckets);
      return {
        ...tx,
        bucketId: match.bucketId,
        assignmentSource: match.assignmentSource,
      };
    });

    // 2. Bestehende IDs prüfen und Duplikate überspringen
    const existingIds = new Set(transactions.map((t) => t.id));
    const toInsert = matched.filter((t) => !existingIds.has(t.id));

    if (toInsert.length > 0) {
      await financeDB.saveTransactions(toInsert);
      setTransactions((prev) => [...prev, ...toInsert]);
    }

    return toInsert.length;
  };

  const assignTransactionBucket = async (
    transactionId: string,
    targetBucketId: string | null
  ): Promise<void> => {
    // 1. Vorherigen Bucket aktualisieren (Transaction ID entfernen)
    let updatedBuckets = buckets.map((b) => {
      if (b.manualTransactionIds && b.manualTransactionIds.includes(transactionId)) {
        return {
          ...b,
          manualTransactionIds: b.manualTransactionIds.filter((id) => id !== transactionId),
        };
      }
      return b;
    });

    // 2. Neuen Bucket aktualisieren (Transaction ID hinzufügen)
    if (targetBucketId) {
      updatedBuckets = updatedBuckets.map((b) => {
        if (b.id === targetBucketId) {
          const currentList = b.manualTransactionIds || [];
          return {
            ...b,
            manualTransactionIds: currentList.includes(transactionId)
              ? currentList
              : [...currentList, transactionId],
          };
        }
        return b;
      });
    }

    await financeDB.saveBuckets(updatedBuckets);
    setBuckets(updatedBuckets);

    // 3. Transaktion aktualisieren
    const updatedTxs = transactions.map((t) => {
      if (t.id === transactionId) {
        return {
          ...t,
          bucketId: targetBucketId,
          assignmentSource: targetBucketId ? ('manual' as const) : ('unassigned' as const),
        };
      }
      return t;
    });

    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  const deleteTransaction = async (transactionId: string): Promise<void> => {
    await financeDB.deleteTransaction(transactionId);
    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
  };

  const clearTransactions = async (): Promise<void> => {
    await financeDB.clearTransactions();
    setTransactions([]);
  };

  const triggerReMatch = async (): Promise<void> => {
    const updatedTxs = reMatchAllTransactions(transactions, buckets);
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  /* ================== EXPORT & IMPORT ================== */
  const exportConfiguration = async (): Promise<string> => {
    const exportData: FinanceConfigExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts,
      buckets,
    };
    return JSON.stringify(exportData, null, 2);
  };

  const importConfiguration = async (jsonContent: string): Promise<void> => {
    const parsed: FinanceConfigExport = JSON.parse(jsonContent);
    await financeDB.importConfiguration(parsed);
    setAccounts(parsed.accounts);
    setBuckets(parsed.buckets);

    // Transaktionen gegen neu importierte Konfiguration matchen
    const updatedTxs = reMatchAllTransactions(transactions, parsed.buckets);
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(updatedTxs);
  };

  const resetWorkspace = async (): Promise<void> => {
    await financeDB.clearAll();
    await loadData();
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        buckets,
        transactions,
        loading,
        error,
        addAccount,
        updateAccount,
        deleteAccount,
        reorderAccounts,
        addBalanceEntry,
        deleteBalanceEntry,
        addBucket,
        updateBucket,
        deleteBucket,
        reorderBuckets,
        importTransactions,
        assignTransactionBucket,
        deleteTransaction,
        clearTransactions,
        triggerReMatch,
        exportConfiguration,
        importConfiguration,
        resetWorkspace,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

/**
 * Hook zum Zugriff auf den globalen Finance-State.
 */
export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance muss innerhalb eines FinanceProvider verwendet werden.');
  }
  return context;
}
