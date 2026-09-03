/**
 * @file FinanceContext.tsx
 * @description Zentraler React Context State für Konten, Kategorien und Transaktionen
 * mit persistenter IndexedDB-Synchronisation und automatischem Matching.
 * @module services/storage/FinanceContext
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Account,
  BalanceEntry,
  Category,
  FinanceConfigExport,
  Transaction,
  sortTransactionsDesc,
  ReMatchStatus,
} from '@/types/finance';
import { financeDB } from './db';
import { matchTransaction, reMatchAllTransactions } from '../matcher/regexMatcher';

export interface FinanceContextType {
  accounts: Account[];
  categories: Category[];
  /** @deprecated Verwende categories */
  buckets: Category[];
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  reMatchStatus: ReMatchStatus;
  setReMatchStatus: (status: ReMatchStatus) => void;
  needsReMatch: boolean;
  reMatching: boolean;
  setNeedsReMatch: (val: boolean) => void;

  // Category Operations
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (updatedCategories: Category[]) => Promise<void>;

  // Backwards compatible Bucket aliases
  /** @deprecated Verwende addCategory */
  addBucket: (bucket: Omit<Category, 'id'>) => Promise<Category>;
  /** @deprecated Verwende updateCategory */
  updateBucket: (bucket: Category) => Promise<void>;
  /** @deprecated Verwende deleteCategory */
  deleteBucket: (bucketId: string) => Promise<void>;
  /** @deprecated Verwende reorderCategories */
  reorderBuckets: (updatedBuckets: Category[]) => Promise<void>;

  // Account Operations
  addAccount: (account: Omit<Account, 'id'>) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  reorderAccounts: (updatedAccounts: Account[]) => Promise<void>;
  addBalanceEntry: (accountId: string, entry: Omit<BalanceEntry, 'id'>) => Promise<void>;
  deleteBalanceEntry: (accountId: string, entryId: string) => Promise<void>;

  // Transaction Operations
  importTransactions: (newTransactions: Transaction[]) => Promise<number>;
  assignTransactionCategory: (transactionId: string, categoryId: string | null) => Promise<void>;
  /** @deprecated Verwende assignTransactionCategory */
  assignTransactionBucket: (transactionId: string, bucketId: string | null) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  triggerReMatch: () => Promise<void>;

  // Export & Import
  exportConfiguration: () => Promise<string>;
  importConfiguration: (jsonContent: string) => Promise<void>;
  resetWorkspace: () => Promise<void>;
}

import seedConfigurationJson from '@/data/seedConfiguration.json';

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const SEED_CONFIG = seedConfigurationJson as unknown as FinanceConfigExport;
const SEED_ACCOUNTS: Account[] = SEED_CONFIG.accounts;
const SEED_CATEGORIES: Category[] = SEED_CONFIG.categories || SEED_CONFIG.buckets || [];

const REMATCH_STATUS_STORAGE_KEY = 'finance_rematch_status';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reMatchStatus, setReMatchStatusState] = useState<ReMatchStatus>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(REMATCH_STATUS_STORAGE_KEY);
        if (
          stored === 'needs_reprogress' ||
          stored === 'is_reprogressing' ||
          stored === 'has_progressed'
        ) {
          return stored;
        }
      }
    } catch {
      // ignore storage access errors
    }
    return 'has_progressed';
  });
  const [error, setError] = useState<string | null>(null);

  const setReMatchStatus = useCallback((status: ReMatchStatus) => {
    setReMatchStatusState(status);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(REMATCH_STATUS_STORAGE_KEY, status);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const needsReMatch = reMatchStatus === 'needs_reprogress';
  const reMatching = reMatchStatus === 'is_reprogressing';
  const setNeedsReMatch = useCallback(
    (val: boolean) => {
      setReMatchStatus(val ? 'needs_reprogress' : 'has_progressed');
    },
    [setReMatchStatus]
  );

  // Initiales Laden aus IndexedDB / Seeden bei erstem Start
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let loadedAccounts = await financeDB.getAccounts();
      let loadedCategories = await financeDB.getCategories();
      const loadedTransactions = await financeDB.getTransactions();

      if (loadedCategories.length === 0) {
        await financeDB.saveCategories(SEED_CATEGORIES);
        loadedCategories = SEED_CATEGORIES;
      }

      if (loadedAccounts.length === 0) {
        const seededAccounts: Account[] = [
          {
            ...SEED_ACCOUNTS[0],
            categoryIds: loadedCategories.map((c) => c.id),
            bucketIds: loadedCategories.map((c) => c.id),
          },
        ];
        await financeDB.saveAccounts(seededAccounts);
        loadedAccounts = seededAccounts;
      }

      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setTransactions(sortTransactionsDesc(loadedTransactions));
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
      categoryIds: accountData.categoryIds || accountData.bucketIds || [],
      bucketIds: accountData.categoryIds || accountData.bucketIds || [],
    };
    await financeDB.saveAccount(newAccount);
    setAccounts((prev) => [...prev, newAccount]);
    return newAccount;
  };

  const updateAccount = async (updated: Account): Promise<void> => {
    const normalized: Account = {
      ...updated,
      categoryIds: updated.categoryIds || updated.bucketIds || [],
      bucketIds: updated.categoryIds || updated.bucketIds || [],
    };
    await financeDB.saveAccount(normalized);
    setAccounts((prev) => prev.map((a) => (a.id === normalized.id ? normalized : a)));
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

  /* ================== CATEGORIES (BUCKETS) ================== */
  const addCategory = async (categoryData: Omit<Category, 'id'>): Promise<Category> => {
    const newCategory: Category = {
      ...categoryData,
      id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      manualTransactionIds: [],
    };
    await financeDB.saveCategory(newCategory);
    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    setReMatchStatus('needs_reprogress');

    return newCategory;
  };

  const updateCategory = async (updated: Category): Promise<void> => {
    await financeDB.saveCategory(updated);
    const updatedCategories = categories.map((c) => (c.id === updated.id ? updated : c));
    setCategories(updatedCategories);
    setReMatchStatus('needs_reprogress');
  };

  const reorderCategories = async (updatedCategories: Category[]): Promise<void> => {
    await financeDB.saveCategories(updatedCategories);
    setCategories(updatedCategories);
    setReMatchStatus('needs_reprogress');
  };

  const deleteCategory = async (categoryId: string): Promise<void> => {
    await financeDB.deleteCategory(categoryId);
    const updatedCategories = categories.filter((c) => c.id !== categoryId);
    setCategories(updatedCategories);

    // Transaktionen bereinigen, die dieser Kategorie zugeordnet waren
    const updatedTxs = transactions.map((t) => {
      const currentCatId = t.categoryId ?? t.bucketId;
      return currentCatId === categoryId
        ? { ...t, categoryId: null, bucketId: null, assignmentSource: 'unassigned' as const }
        : t;
    });
    await financeDB.saveTransactions(updatedTxs);
    setTransactions(sortTransactionsDesc(updatedTxs));
    setReMatchStatus('needs_reprogress');
  };

  /* ================== TRANSACTIONS ================== */
  const importTransactions = async (newTransactions: Transaction[]): Promise<number> => {
    // 1. Regex & Manual Overrides anwenden
    const matched = newTransactions.map((tx) => {
      const match = matchTransaction(tx, categories);
      return {
        ...tx,
        categoryId: match.categoryId,
        bucketId: match.categoryId,
        assignmentSource: match.assignmentSource,
      };
    });

    // 2. Bestehende IDs prüfen und Duplikate überspringen
    const existingIds = new Set(transactions.map((t) => t.id));
    const toInsert = matched.filter((t) => !existingIds.has(t.id));

    if (toInsert.length > 0) {
      await financeDB.saveTransactions(toInsert);
      setTransactions((prev) => sortTransactionsDesc([...prev, ...toInsert]));
    }

    return toInsert.length;
  };

  const assignTransactionCategory = async (
    transactionId: string,
    targetCategoryId: string | null
  ): Promise<void> => {
    // 1. Vorherige Kategorie aktualisieren (Transaction ID entfernen)
    let updatedCategories = categories.map((c) => {
      if (c.manualTransactionIds && c.manualTransactionIds.includes(transactionId)) {
        return {
          ...c,
          manualTransactionIds: c.manualTransactionIds.filter((id) => id !== transactionId),
        };
      }
      return c;
    });

    // 2. Neue Kategorie aktualisieren (Transaction ID hinzufügen)
    if (targetCategoryId) {
      updatedCategories = updatedCategories.map((c) => {
        if (c.id === targetCategoryId) {
          const currentList = c.manualTransactionIds || [];
          return {
            ...c,
            manualTransactionIds: currentList.includes(transactionId)
              ? currentList
              : [...currentList, transactionId],
          };
        }
        return c;
      });
    }

    await financeDB.saveCategories(updatedCategories);
    setCategories(updatedCategories);

    // 3. Transaktion aktualisieren
    const updatedTxs = transactions.map((t) => {
      if (t.id === transactionId) {
        return {
          ...t,
          categoryId: targetCategoryId,
          bucketId: targetCategoryId,
          assignmentSource: targetCategoryId ? ('manual' as const) : ('unassigned' as const),
        };
      }
      return t;
    });

    await financeDB.saveTransactions(updatedTxs);
    setTransactions(sortTransactionsDesc(updatedTxs));
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
    try {
      setReMatchStatus('is_reprogressing');
      const allTxs = transactions.length > 0 ? transactions : await financeDB.getTransactions();
      const allCategories = categories.length > 0 ? categories : await financeDB.getCategories();
      const updatedTxs = reMatchAllTransactions(allTxs, allCategories);

      if (updatedTxs.length > 0) {
        await financeDB.saveTransactions(updatedTxs);
      }
      setTransactions(sortTransactionsDesc(updatedTxs));
      setReMatchStatus('has_progressed');
    } catch (err) {
      console.error('Re-Match fehlgeschlagen:', err);
      setReMatchStatus('needs_reprogress');
      throw err;
    }
  };

  /* ================== EXPORT & IMPORT ================== */
  const exportConfiguration = async (): Promise<string> => {
    const exportData: FinanceConfigExport = {
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts,
      categories,
      buckets: categories,
    };
    return JSON.stringify(exportData, null, 2);
  };

  const importConfiguration = async (jsonContent: string): Promise<void> => {
    const parsed: FinanceConfigExport = JSON.parse(jsonContent);
    await financeDB.importConfiguration(parsed);
    const loadedCats = parsed.categories || parsed.buckets || [];
    setAccounts(parsed.accounts);
    setCategories(loadedCats);
    setReMatchStatus('needs_reprogress');
  };

  const resetWorkspace = async (): Promise<void> => {
    try {
      setLoading(true);
      await financeDB.clearAll();

      const seededAccounts: Account[] = [
        {
          ...SEED_ACCOUNTS[0],
          categoryIds: SEED_CATEGORIES.map((c) => c.id),
          bucketIds: SEED_CATEGORIES.map((c) => c.id),
        },
      ];

      await financeDB.saveAccounts(seededAccounts);
      await financeDB.saveCategories(SEED_CATEGORIES);

      setAccounts(seededAccounts);
      setCategories(SEED_CATEGORIES);
      setTransactions([]);
      setReMatchStatus('has_progressed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen der Finanzdaten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        categories,
        buckets: categories,
        transactions,
        loading,
        error,
        reMatchStatus,
        setReMatchStatus,
        needsReMatch,
        reMatching,
        setNeedsReMatch,
        addAccount,
        updateAccount,
        deleteAccount,
        reorderAccounts,
        addBalanceEntry,
        deleteBalanceEntry,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        addBucket: addCategory,
        updateBucket: updateCategory,
        deleteBucket: deleteCategory,
        reorderBuckets: reorderCategories,
        importTransactions,
        assignTransactionCategory,
        assignTransactionBucket: assignTransactionCategory,
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
