/**
 * @file FinanceProvider.tsx
 * @description Zentraler React Context State für Konten, Kategorien und Transaktionen
 * mit persistenter IndexedDB-Synchronisation und automatischem Matching.
 * @module domain/modules/finance/FinanceProvider
 */

import React, { createContext, useEffect, useState, useCallback } from 'react';
import {
  Account,
  BalanceEntry,
  Category,
  FinanceConfigExport,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  ResetOptions,
  DEFAULT_RESET_OPTIONS,
  Transaction,
  sortTransactionsDesc,
  ReMatchStatus,
  resetTransactionToOriginal,
  CategoryAssignmentSource,
} from '@/types/finance';
import { financeDB } from '@/repository/indexeddb/db';
import { matchTransaction, reMatchAllTransactions } from '../matcher/regexMatcher';

export interface SplitPartInput {
  id?: string;
  amount: number;
  subject: string;
  receiver: string;
  categoryId: string | null;
}

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
  /** Gibt an, ob Neu-Matching bei Konfigurationsänderungen automatisch ausgeführt wird */
  autoReprogress: boolean;
  /** Aktiviert oder deaktiviert automatisches Neu-Matching */
  setAutoReprogress: (enabled: boolean) => void;

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
  addTransaction: (
    transaction:
      | (Omit<Transaction, 'id' | 'assignmentSource'> & {
          assignmentSource?: CategoryAssignmentSource;
        })
      | Transaction
  ) => Promise<Transaction>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  splitTransaction: (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ) => Promise<void>;
  /**
   * Verwaltet alle Split-Teile einer Transaktion atomar und stellt sicher,
   * dass die Summe aller Teile stets exakt dem Bank-Originalbetrag entspricht.
   */
  updateSplitGroup?: (rootTransactionId: string, splits: SplitPartInput[]) => Promise<void>;
  importTransactions: (newTransactions: Transaction[]) => Promise<number>;
  assignTransactionCategory: (transactionId: string, categoryId: string | null) => Promise<void>;
  /** @deprecated Verwende assignTransactionCategory */
  assignTransactionBucket: (transactionId: string, bucketId: string | null) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  triggerReMatch: () => Promise<void>;
  /** Setzt eine Transaktion auf ihre Original-Bankdaten zurück und löscht Split-Kinder */
  resetTransaction: (transactionId: string) => Promise<void>;
  /** Alle gelöschten Buchungen (Papierkorb) */
  deletedTransactions: Transaction[];
  /** Stellt eine gelöschte Buchung wieder her */
  restoreTransaction: (transactionId: string) => Promise<void>;

  // Export & Import & Reset
  exportConfiguration: (options?: ExportOptions) => Promise<string>;
  importConfiguration: (jsonContent: string) => Promise<{
    accountsCount: number;
    categoriesCount: number;
    transactionsCount: number;
  }>;
  resetWorkspace: (options?: ResetOptions) => Promise<void>;
}

import seedConfigurationJson from '@/data/seedConfiguration.json';
import { SEED_TRANSACTIONS } from '@/data/seedTransactions';

export const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const SEED_CONFIG = seedConfigurationJson as unknown as FinanceConfigExport;
const SEED_ACCOUNTS: Account[] = SEED_CONFIG.accounts || [];
const SEED_CATEGORIES: Category[] = SEED_CONFIG.categories || SEED_CONFIG.buckets || [];

const REMATCH_STATUS_STORAGE_KEY = 'finance_rematch_status';
const AUTO_REPROGRESS_STORAGE_KEY = 'finance_auto_reprogress';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
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

  const [autoReprogress, setAutoReprogressState] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(AUTO_REPROGRESS_STORAGE_KEY);
        if (stored !== null) {
          return stored === 'true';
        }
      }
    } catch {
      // ignore storage access errors
    }
    return true;
  });

  const performReMatch = useCallback(
    async (overrideTxs?: Transaction[], overrideCategories?: Category[]): Promise<void> => {
      try {
        setReMatchStatus('is_reprogressing');
        const allTxs =
          overrideTxs ??
          (transactions.length > 0 ? transactions : await financeDB.getTransactions());
        const allCategories =
          overrideCategories ??
          (categories.length > 0 ? categories : await financeDB.getCategories());
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
    },
    [transactions, categories, setReMatchStatus]
  );

  const triggerReMatch = useCallback(async (): Promise<void> => {
    await performReMatch();
  }, [performReMatch]);

  const notifyConfigChanged = useCallback(
    async (overrideTxs?: Transaction[], overrideCategories?: Category[]): Promise<void> => {
      if (autoReprogress) {
        await performReMatch(overrideTxs, overrideCategories);
      } else {
        setReMatchStatus('needs_reprogress');
      }
    },
    [autoReprogress, performReMatch, setReMatchStatus]
  );

  const setAutoReprogress = useCallback(
    (enabled: boolean) => {
      setAutoReprogressState(enabled);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(AUTO_REPROGRESS_STORAGE_KEY, String(enabled));
        }
      } catch {
        // ignore storage access errors
      }
      if (enabled && reMatchStatus === 'needs_reprogress') {
        void triggerReMatch();
      }
    },
    [reMatchStatus, triggerReMatch]
  );

  // Initiales Laden aus IndexedDB / Seeden bei erstem Start
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let loadedAccounts = await financeDB.getAccounts();
      let loadedCategories = await financeDB.getCategories();
      const loadedTransactions = await financeDB.getTransactions();
      const loadedDeleted = await financeDB.getDeletedTransactions();
      const validDeleted: Transaction[] = [];

      for (const d of loadedDeleted) {
        if (d.origin === 'manual') {
          // Manuelle Buchungen gehören nicht in den Papierkorb
          await financeDB.permanentlyDeleteTransaction(d.id);
        } else {
          validDeleted.push(d);
        }
      }

      if (loadedCategories.length === 0) {
        await financeDB.saveCategories(SEED_CATEGORIES);
        loadedCategories = SEED_CATEGORIES;
      } else {
        // Bereinigung: Eltern-Kategorien mit Kindern dürfen kein regexPattern besitzen
        const parentIds = new Set(
          loadedCategories.map((c) => c.parentId).filter(Boolean) as string[]
        );
        let needsDBSave = false;
        const sanitizedCategories = loadedCategories.map((c) => {
          if (parentIds.has(c.id) && c.regexPattern) {
            needsDBSave = true;
            return { ...c, regexPattern: undefined };
          }
          return c;
        });
        if (needsDBSave) {
          await financeDB.saveCategories(sanitizedCategories);
          loadedCategories = sanitizedCategories;
        }
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

      // Migration: Transaktionen mit accountId aber ohne accountIban mit der IBAN des Kontos anreichern
      const accountsMap = new Map(loadedAccounts.map((a) => [a.id, a]));
      let txsMigrated = false;
      const migratedTransactions = loadedTransactions.map((tx) => {
        if (!tx.accountIban && tx.accountId) {
          const acc = accountsMap.get(tx.accountId);
          if (acc?.iban) {
            txsMigrated = true;
            return {
              ...tx,
              accountIban: acc.iban,
              originalAccountIban: tx.originalAccountIban ?? acc.iban,
            };
          }
        }
        return tx;
      });

      if (txsMigrated) {
        await financeDB.saveTransactions(migratedTransactions);
      }

      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setTransactions(sortTransactionsDesc(migratedTransactions));
      setDeletedTransactions(sortTransactionsDesc(validDeleted));
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

    let updatedCategories = [...categories, newCategory];

    // Wenn die neue Kategorie eine übergeordnete Kategorie hat, verliert diese ihr regexPattern
    if (newCategory.parentId) {
      const parent = categories.find((c) => c.id === newCategory.parentId);
      if (parent && parent.regexPattern) {
        const cleanedParent: Category = {
          ...parent,
          regexPattern: undefined,
        };
        await financeDB.saveCategory(cleanedParent);
        updatedCategories = updatedCategories.map((c) =>
          c.id === cleanedParent.id ? cleanedParent : c
        );
      }
    }

    await financeDB.saveCategory(newCategory);
    setCategories(updatedCategories);
    await notifyConfigChanged(transactions, updatedCategories);

    return newCategory;
  };

  const updateCategory = async (updated: Category): Promise<void> => {
    // 1. Hat die aktualisierte Kategorie Kinder? Dann darf sie selbst kein Regex haben.
    const hasChildren = categories.some((c) => c.parentId === updated.id);
    const sanitizedUpdated: Category = hasChildren
      ? { ...updated, regexPattern: undefined }
      : updated;

    let updatedCategories = categories.map((c) =>
      c.id === sanitizedUpdated.id ? sanitizedUpdated : c
    );

    // 2. Hat die Kategorie einen Parent bekommen, der noch ein Regex hat? Dann Parent bereinigen.
    if (sanitizedUpdated.parentId) {
      const parent = categories.find((c) => c.id === sanitizedUpdated.parentId);
      if (parent && parent.regexPattern) {
        const cleanedParent: Category = { ...parent, regexPattern: undefined };
        await financeDB.saveCategory(cleanedParent);
        updatedCategories = updatedCategories.map((c) =>
          c.id === cleanedParent.id ? cleanedParent : c
        );
      }
    }

    await financeDB.saveCategory(sanitizedUpdated);
    setCategories(updatedCategories);
    await notifyConfigChanged(transactions, updatedCategories);
  };

  const reorderCategories = async (updatedCategories: Category[]): Promise<void> => {
    const parentIdsWithChildren = new Set(
      updatedCategories.map((c) => c.parentId).filter(Boolean) as string[]
    );
    const sanitized = updatedCategories.map((c) => {
      if (parentIdsWithChildren.has(c.id) && c.regexPattern) {
        return { ...c, regexPattern: undefined };
      }
      return c;
    });

    await financeDB.saveCategories(sanitized);
    setCategories(sanitized);
    await notifyConfigChanged(transactions, sanitized);
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
    await notifyConfigChanged(updatedTxs, updatedCategories);
  };

  /* ================== TRANSACTIONS ================== */
  const addTransaction = async (
    txData:
      | (Omit<Transaction, 'id' | 'assignmentSource'> & {
          assignmentSource?: CategoryAssignmentSource;
        })
      | Transaction
  ): Promise<Transaction> => {
    const id =
      'id' in txData && txData.id
        ? txData.id
        : `tx-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newTx: Transaction = {
      ...txData,
      id,
      origin: 'manual',
      assignmentSource: txData.categoryId ? 'manual' : 'unassigned',
      categoryId: txData.categoryId || null,
      bucketId: txData.categoryId || null,
    };

    if (newTx.categoryId) {
      const updatedCats = categories.map((c) => {
        if (c.id === newTx.categoryId) {
          const list = c.manualTransactionIds || [];
          return {
            ...c,
            manualTransactionIds: list.includes(id) ? list : [...list, id],
          };
        }
        return c;
      });
      await financeDB.saveCategories(updatedCats);
      setCategories(updatedCats);
    }

    await financeDB.saveTransaction(newTx);
    setTransactions((prev) => sortTransactionsDesc([...prev, newTx]));
    return newTx;
  };

  const updateTransaction = async (updatedTx: Transaction): Promise<void> => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    const oldCatId = oldTx?.categoryId ?? oldTx?.bucketId ?? null;
    const newCatId = updatedTx.categoryId ?? updatedTx.bucketId ?? null;

    if (oldCatId !== newCatId) {
      let updatedCats = categories.map((c) => {
        if (c.id === oldCatId && c.manualTransactionIds) {
          return {
            ...c,
            manualTransactionIds: c.manualTransactionIds.filter((id) => id !== updatedTx.id),
          };
        }
        return c;
      });

      if (newCatId) {
        updatedCats = updatedCats.map((c) => {
          if (c.id === newCatId) {
            const list = c.manualTransactionIds || [];
            return {
              ...c,
              manualTransactionIds: list.includes(updatedTx.id) ? list : [...list, updatedTx.id],
            };
          }
          return c;
        });
      }

      await financeDB.saveCategories(updatedCats);
      setCategories(updatedCats);
    }

    const isCategoryChanged = oldCatId !== newCatId;

    const preparedTx: Transaction = {
      ...updatedTx,
      categoryId: newCatId,
      bucketId: newCatId,
      assignmentSource: isCategoryChanged
        ? newCatId
          ? 'manual'
          : 'unassigned'
        : (updatedTx.assignmentSource ?? oldTx?.assignmentSource ?? 'unassigned'),
      // Flache Original-Felder absichern, falls von der Bank importiert
      originalValue: oldTx?.originalValue ?? oldTx?.value,
      originalSubject: oldTx?.originalSubject ?? oldTx?.subject,
      originalReceiver: oldTx?.originalReceiver ?? oldTx?.receiver,
      originalIssuer: oldTx?.originalIssuer ?? oldTx?.issuer,
      originalAccountId: oldTx?.originalAccountId ?? oldTx?.accountId,
      originalAccountIban: oldTx?.originalAccountIban ?? oldTx?.accountIban,
      originalDate:
        oldTx?.originalDate ?? oldTx?.originalValueDate ?? oldTx?.date ?? oldTx?.valueDate,
      originalValueDate: oldTx?.originalValueDate ?? oldTx?.valueDate,
      originalIban: oldTx?.originalIban ?? oldTx?.iban,
    };

    await financeDB.saveTransaction(preparedTx);
    setTransactions((prev) =>
      sortTransactionsDesc(prev.map((t) => (t.id === preparedTx.id ? preparedTx : t)))
    );
  };

  const splitTransaction = async (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ): Promise<void> => {
    const originalTx = transactions.find((t) => t.id === originalId);
    if (!originalTx) throw new Error('Originalbuchung nicht gefunden.');

    const origAbs = Math.abs(originalTx.value);
    if (splitAmount <= 0) {
      throw new Error('Der Teilbetrag muss größer als 0 sein.');
    }
    if (splitAmount >= origAbs) {
      throw new Error(
        'Der Teilbetrag muss kleiner als der Originalbetrag sein. Der Restbetrag darf nicht unter 0,00 € fallen.'
      );
    }

    const sign = originalTx.value < 0 ? -1 : 1;
    const remainingAbs = origAbs - splitAmount;
    const updatedOriginalValue = (sign * Math.round(remainingAbs * 100)) / 100;

    const originalTxDate = originalTx.date ?? originalTx.valueDate;

    const updatedOriginalTx: Transaction = {
      ...originalTx,
      value: updatedOriginalValue,
      originalValue: originalTx.originalValue ?? originalTx.value,
      originalSubject: originalTx.originalSubject ?? originalTx.subject,
      originalReceiver: originalTx.originalReceiver ?? originalTx.receiver,
      originalAccountId: originalTx.originalAccountId ?? originalTx.accountId,
      originalAccountIban: originalTx.originalAccountIban ?? originalTx.accountIban,
      originalDate: originalTx.originalDate ?? originalTx.originalValueDate ?? originalTxDate,
      originalValueDate: originalTx.originalValueDate ?? originalTx.valueDate,
      originalIban: originalTx.originalIban ?? originalTx.iban,
    };

    const splitId = `tx-split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const splitValue = (sign * Math.round(splitAmount * 100)) / 100;
    const newSplitTx: Transaction = {
      id: splitId,
      accountId: originalTx.accountId,
      accountIban: originalTx.accountIban,
      date: originalTxDate,
      valueDate: originalTxDate,
      bookingDate: originalTxDate,
      issuer: originalTx.issuer,
      receiver: splitData.receiver.trim() || originalTx.receiver,
      subject: splitData.subject.trim() || `${originalTx.subject} (Split)`,
      iban: originalTx.iban,
      value: splitValue,
      categoryId: splitData.categoryId || null,
      bucketId: splitData.categoryId || null,
      assignmentSource: splitData.categoryId ? 'manual' : 'unassigned',
      origin: 'split',
      splitFromId: originalId,
    };

    if (newSplitTx.categoryId) {
      const updatedCats = categories.map((c) => {
        if (c.id === newSplitTx.categoryId) {
          const list = c.manualTransactionIds || [];
          return {
            ...c,
            manualTransactionIds: list.includes(splitId) ? list : [...list, splitId],
          };
        }
        return c;
      });
      await financeDB.saveCategories(updatedCats);
      setCategories(updatedCats);
    }

    await financeDB.saveTransaction(updatedOriginalTx);
    await financeDB.saveTransaction(newSplitTx);

    setTransactions((prev) =>
      sortTransactionsDesc(
        prev.map((t) => (t.id === originalId ? updatedOriginalTx : t)).concat(newSplitTx)
      )
    );
  };

  /**
   * Aktualisiert alle Split-Teile einer Buchungsgruppe strikt betragserhaltend.
   * Der Betrag der Root-Transaktion (Originalbuchung) ist fest vorgegeben (originalValue ?? value).
   * Die Summe aller Split-Kinder wird abgezogen und der verbleibende Betrag auf die Root-Transaktion geschrieben.
   */
  const updateSplitGroup = async (
    rootTransactionId: string,
    splits: SplitPartInput[]
  ): Promise<void> => {
    // 1. Root-Transaktion finden (falls eine Child-ID übergeben wurde, zu Root auflösen)
    let rootTx = transactions.find((t) => t.id === rootTransactionId);
    if (!txExists(rootTx)) {
      throw new Error('Root-Transaktion nicht gefunden.');
    }
    if (rootTx.splitFromId) {
      const parent = transactions.find((t) => t.id === rootTx!.splitFromId);
      if (parent) {
        rootTx = parent;
      }
    }

    const actualRootId = rootTx.id;
    // Der ursprüngliche Gesamtbetrag aus den Bankdaten
    const bankTotal = rootTx.originalValue !== undefined ? rootTx.originalValue : rootTx.value;
    const bankTotalAbs = Math.round(Math.abs(bankTotal) * 100) / 100;
    const sign = bankTotal < 0 ? -1 : 1;

    // 2. Summe der Splits validieren
    let totalSplitsAbs = 0;
    for (const split of splits) {
      if (split.amount <= 0) {
        throw new Error('Der Betrag jedes Split-Teils muss größer als 0,00 € sein.');
      }
      totalSplitsAbs = Math.round((totalSplitsAbs + split.amount) * 100) / 100;
    }

    if (totalSplitsAbs >= bankTotalAbs) {
      throw new Error(
        'Die Summe aller Split-Teile muss kleiner als der Gesamtbetrag der Buchung sein, damit ein Restbetrag verbleibt.'
      );
    }

    const remainingAbs = Math.round((bankTotalAbs - totalSplitsAbs) * 100) / 100;
    const updatedRootValue = (sign * Math.round(remainingAbs * 100)) / 100;

    const rootTxDate = rootTx.date ?? rootTx.valueDate;

    // 3. Root-Transaktion vorbereiten
    const updatedRootTx: Transaction = {
      ...rootTx,
      value: updatedRootValue,
      originalValue: rootTx.originalValue ?? rootTx.value,
      originalSubject: rootTx.originalSubject ?? rootTx.subject,
      originalReceiver: rootTx.originalReceiver ?? rootTx.receiver,
      originalAccountId: rootTx.originalAccountId ?? rootTx.accountId,
      originalAccountIban: rootTx.originalAccountIban ?? rootTx.accountIban,
      originalDate: rootTx.originalDate ?? rootTx.originalValueDate ?? rootTxDate,
      originalValueDate: rootTx.originalValueDate ?? rootTx.valueDate,
      originalIban: rootTx.originalIban ?? rootTx.iban,
    };

    // 4. Bestehende Kinder ermitteln
    const existingChildren = transactions.filter((t) => t.splitFromId === actualRootId);
    const existingChildrenMap = new Map(existingChildren.map((c) => [c.id, c]));

    const retainedChildIds = new Set<string>();
    const childrenToSave: Transaction[] = [];

    // Category manualTransactionIds Updates
    let updatedCategories = [...categories];

    for (const split of splits) {
      const splitValue = (sign * Math.round(split.amount * 100)) / 100;
      if (split.id && existingChildrenMap.has(split.id)) {
        // Bestehendes Kind aktualisieren
        const existing = existingChildrenMap.get(split.id)!;
        retainedChildIds.add(split.id);
        const updatedChild: Transaction = {
          ...existing,
          value: splitValue,
          receiver: split.receiver.trim() || updatedRootTx.receiver,
          subject: split.subject.trim() || `${updatedRootTx.subject} (Split)`,
          categoryId: split.categoryId || null,
          bucketId: split.categoryId || null,
          assignmentSource: split.categoryId ? 'manual' : 'unassigned',
        };
        childrenToSave.push(updatedChild);

        // Falls Kategorie geändert wurde, manualTransactionIds anpassen
        if (existing.categoryId !== split.categoryId) {
          updatedCategories = updatedCategories.map((c) => {
            let list = c.manualTransactionIds || [];
            if (c.id === existing.categoryId) {
              list = list.filter((id) => id !== existing.id);
            }
            if (split.categoryId && c.id === split.categoryId && !list.includes(existing.id)) {
              list = [...list, existing.id];
            }
            return { ...c, manualTransactionIds: list };
          });
        }
      } else {
        // Neues Kind erstellen
        const newChildId = `tx-split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newChild: Transaction = {
          id: newChildId,
          accountId: updatedRootTx.accountId,
          accountIban: updatedRootTx.accountIban,
          date: rootTxDate,
          valueDate: rootTxDate,
          bookingDate: rootTxDate,
          issuer: updatedRootTx.issuer,
          receiver: split.receiver.trim() || updatedRootTx.receiver,
          subject: split.subject.trim() || `${updatedRootTx.subject} (Split)`,
          iban: updatedRootTx.iban,
          value: splitValue,
          categoryId: split.categoryId || null,
          bucketId: split.categoryId || null,
          assignmentSource: split.categoryId ? 'manual' : 'unassigned',
          origin: 'split',
          splitFromId: actualRootId,
        };
        childrenToSave.push(newChild);

        if (split.categoryId) {
          updatedCategories = updatedCategories.map((c) => {
            if (c.id === split.categoryId) {
              const list = c.manualTransactionIds || [];
              return {
                ...c,
                manualTransactionIds: list.includes(newChildId) ? list : [...list, newChildId],
              };
            }
            return c;
          });
        }
      }
    }

    // Kinder, die nicht mehr in `splits` vorhanden sind, löschen
    const childrenToDelete = existingChildren.filter((c) => !retainedChildIds.has(c.id));
    for (const child of childrenToDelete) {
      await financeDB.deleteTransaction(child.id);
      updatedCategories = updatedCategories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== child.id),
      }));
    }

    // Alle aktiven Kinder und Root speichern
    await financeDB.saveTransaction(updatedRootTx);
    await financeDB.saveTransactions(childrenToSave);
    await financeDB.saveCategories(updatedCategories);
    setCategories(updatedCategories);

    const deletedIds = new Set(childrenToDelete.map((c) => c.id));
    const savedIds = new Set(childrenToSave.map((c) => c.id));

    setTransactions((prev) => {
      const filtered = prev.filter((t) => !deletedIds.has(t.id) && !savedIds.has(t.id));
      const updated = filtered.map((t) => (t.id === actualRootId ? updatedRootTx : t));
      return sortTransactionsDesc([...updated, ...childrenToSave]);
    });
  };

  function txExists(tx: Transaction | undefined): tx is Transaction {
    return tx !== undefined;
  }

  const importTransactions = async (newTransactions: Transaction[]): Promise<number> => {
    // 1. Vorhandene Fingerprints erfassen, um bestehende Overrides und Splits vor Überschreiben zu schützen
    const existingIds = new Set(transactions.map((t) => t.id));
    const existingFingerprints = new Map<string, Transaction>();
    transactions.forEach((t) => {
      if (t.rawFingerprint) {
        existingFingerprints.set(t.rawFingerprint, t);
      }
    });

    // 2. Gelöschte Buchungen als Sperre: IDs und Fingerprints aus dem Papierkorb
    const deletedIds = new Set(deletedTransactions.map((t) => t.id));
    const deletedFingerprints = new Set(
      deletedTransactions.filter((t) => t.rawFingerprint).map((t) => t.rawFingerprint as string)
    );

    const toInsert: Transaction[] = [];

    for (const rawTx of newTransactions) {
      // Duplikatprüfung: Bereits per ID oder per unveränderlichem Roh-Fingerabdruck vorhanden
      if (existingIds.has(rawTx.id)) {
        continue;
      }
      if (rawTx.rawFingerprint && existingFingerprints.has(rawTx.rawFingerprint)) {
        continue;
      }
      // Gelöschte Buchungen ignorieren (Tombstone)
      if (deletedIds.has(rawTx.id)) {
        continue;
      }
      if (rawTx.rawFingerprint && deletedFingerprints.has(rawTx.rawFingerprint)) {
        continue;
      }

      // 3. Automatisches Matching gegen Kategorien anwenden
      const match = matchTransaction(rawTx, categories);
      const preparedTx: Transaction = {
        ...rawTx,
        categoryId: match.categoryId,
        bucketId: match.categoryId,
        assignmentSource: match.assignmentSource,
      };

      toInsert.push(preparedTx);
    }

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
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    let updatedCategories = [...categories];

    // Fall 1: Gelöschte Buchung ist ein Split-Kind (`splitFromId` vorhanden)
    if (tx.splitFromId) {
      const parentTx = transactions.find((t) => t.id === tx.splitFromId);
      await financeDB.deleteTransaction(transactionId);

      // Eventuell hinterlegte manualTransactionIds in Kategorien bereinigen
      updatedCategories = updatedCategories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== transactionId),
      }));

      if (parentTx) {
        // Den Betrag des gelöschten Split-Teils wieder dem Parent gutschreiben
        const newParentValue = Math.round((parentTx.value + tx.value) * 100) / 100;
        const otherChildren = transactions.filter(
          (t) => t.splitFromId === parentTx.id && t.id !== transactionId
        );

        // Falls keine weiteren Kinder mehr existieren und der Parent wieder den Originalwert hat,
        // kann der Originalwert-Snapshot bereinigt werden, wenn keine anderen Felder abweichen
        const updatedParent: Transaction = {
          ...parentTx,
          value: newParentValue,
          originalValue:
            otherChildren.length === 0 &&
            parentTx.originalValue !== undefined &&
            Math.abs(newParentValue - parentTx.originalValue) < 0.001 &&
            parentTx.originalSubject === undefined &&
            parentTx.originalReceiver === undefined
              ? undefined
              : parentTx.originalValue,
        };

        await financeDB.saveTransaction(updatedParent);
        await financeDB.saveCategories(updatedCategories);
        setCategories(updatedCategories);

        setTransactions((prev) =>
          prev
            .filter((t) => t.id !== transactionId)
            .map((t) => (t.id === parentTx.id ? updatedParent : t))
        );
      } else {
        await financeDB.saveCategories(updatedCategories);
        setCategories(updatedCategories);
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      }
      return;
    }

    // Fall 2: Gelöschte Buchung ist ein Split-Parent oder normale Buchung
    // Falls es ein Parent ist: Alle Split-Kinder ebenfalls löschen
    const children = transactions.filter((t) => t.splitFromId === transactionId);
    const childIds = new Set(children.map((c) => c.id));
    for (const child of children) {
      await financeDB.deleteTransaction(child.id);
      updatedCategories = updatedCategories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== child.id),
      }));
    }

    // Nur importierte Bank-Transaktionen wandern in den Papierkorb (Gelöscht-Stapel & CSV-Tombstone).
    // Manuell erstellte Transaktionen (origin === 'manual') werden direkt endgültig gelöscht.
    const isManual = tx.origin === 'manual';

    if (!isManual) {
      await financeDB.saveDeletedTransaction(tx);
    }
    await financeDB.deleteTransaction(transactionId);

    // Eventuell hinterlegte manualTransactionIds des gelöschten Eintrags bereinigen
    updatedCategories = updatedCategories.map((c) => ({
      ...c,
      manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== transactionId),
    }));

    await financeDB.saveCategories(updatedCategories);
    setCategories(updatedCategories);

    setTransactions((prev) => prev.filter((t) => t.id !== transactionId && !childIds.has(t.id)));
    if (!isManual) {
      setDeletedTransactions((prev) =>
        sortTransactionsDesc([...prev, { ...tx, deletedAt: new Date().toISOString() }])
      );
    }
  };

  /**
   * Setzt eine importierte Transaktion auf ihre Original-Bankdaten zurück.
   * Split-Kinder werden dabei gelöscht, um Betragsverdopplung zu verhindern.
   */
  const resetTransaction = async (transactionId: string): Promise<void> => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    // Falls es sich um ein Split-Kind handelt, verhält sich reset wie das Löschen des Split-Teils (Rückführung auf Parent)
    if (tx.splitFromId) {
      await deleteTransaction(transactionId);
      return;
    }

    // Falls es sich um eine Root-Buchung mit Split-Kindern handelt:
    // Alle Split-Kinder löschen
    const children = transactions.filter((t) => t.splitFromId === transactionId);
    const childIds = new Set(children.map((c) => c.id));
    let updatedCategories = [...categories];

    for (const child of children) {
      await financeDB.deleteTransaction(child.id);
      updatedCategories = updatedCategories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== child.id),
      }));
    }

    const restored = resetTransactionToOriginal(tx);

    // Re-Match auf der zurückgesetzten Transaktion
    const match = matchTransaction(restored, updatedCategories);
    const finalTx: Transaction = {
      ...restored,
      categoryId: match.categoryId,
      bucketId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };

    await financeDB.saveTransaction(finalTx);
    await financeDB.saveCategories(updatedCategories);
    setCategories(updatedCategories);

    setTransactions((prev) =>
      sortTransactionsDesc(
        prev.filter((t) => !childIds.has(t.id)).map((t) => (t.id === transactionId ? finalTx : t))
      )
    );
  };

  /**
   * Stellt eine gelöschte Transaktion aus dem Papierkorb wieder her.
   * Stellt bei modifizierten/gesplitteten Buchungen den ursprünglichen Bank-Betrag wieder her.
   * Eventuelle Split-Teile bleiben erhalten.
   */
  const restoreTransaction = async (transactionId: string): Promise<void> => {
    const tx = deletedTransactions.find((t) => t.id === transactionId);
    if (!tx) return;

    // Falls Originaldaten vorhanden sind (z. B. nach Split oder Änderung),
    // den ursprünglichen Bank-Rohstand (inkl. Originalbetrag) wiederherstellen.
    const restoredBase = tx.originalValue !== undefined ? resetTransactionToOriginal(tx) : tx;
    const { deletedAt: _deletedAt, splitFromId: _splitFromId, ...withoutMetadata } = restoredBase;

    // Re-Match anwenden
    const match = matchTransaction(withoutMetadata as Transaction, categories);
    const restoredTx: Transaction = {
      ...(withoutMetadata as Transaction),
      categoryId: match.categoryId,
      bucketId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };

    await financeDB.saveTransaction(restoredTx);
    await financeDB.permanentlyDeleteTransaction(transactionId);

    setTransactions((prev) => sortTransactionsDesc([...prev, restoredTx]));
    setDeletedTransactions((prev) => prev.filter((t) => t.id !== transactionId));
  };

  const clearTransactions = async (): Promise<void> => {
    await financeDB.clearTransactions();
    setTransactions([]);
  };

  /* ================== EXPORT & IMPORT ================== */
  const exportConfiguration = async (
    options: ExportOptions = DEFAULT_EXPORT_OPTIONS
  ): Promise<string> => {
    const exportData = await financeDB.exportConfiguration(options);
    return JSON.stringify(exportData, null, 2);
  };

  const importConfiguration = async (
    jsonContent: string
  ): Promise<{
    accountsCount: number;
    categoriesCount: number;
    transactionsCount: number;
  }> => {
    const parsed: FinanceConfigExport = JSON.parse(jsonContent);
    await financeDB.importConfiguration(parsed);

    const loadedCats = parsed.categories || parsed.buckets;
    let accountsCount = 0;
    let categoriesCount = 0;
    let transactionsCount = 0;

    if (Array.isArray(parsed.accounts)) {
      setAccounts(parsed.accounts);
      accountsCount = parsed.accounts.length;
    }
    let nextCategories = categories;
    if (Array.isArray(loadedCats)) {
      nextCategories = loadedCats;
      setCategories(loadedCats);
      categoriesCount = loadedCats.length;
    }

    let nextTransactions = transactions;
    if (Array.isArray(parsed.transactions)) {
      nextTransactions = sortTransactionsDesc(parsed.transactions);
      setTransactions(nextTransactions);
      transactionsCount = parsed.transactions.length;
    } else if (Array.isArray(parsed.manualTransactions) && parsed.manualTransactions.length > 0) {
      const manualTxs = parsed.manualTransactions;
      const existingIds = new Set(manualTxs.map((m) => m.id));
      nextTransactions = sortTransactionsDesc(
        transactions.filter((p) => !existingIds.has(p.id)).concat(manualTxs)
      );
      setTransactions(nextTransactions);
      transactionsCount = manualTxs.length;
    }

    if (Array.isArray(parsed.deletedTransactions)) {
      setDeletedTransactions(sortTransactionsDesc(parsed.deletedTransactions));
    }

    await notifyConfigChanged(nextTransactions, nextCategories);
    return { accountsCount, categoriesCount, transactionsCount };
  };

  const resetWorkspace = async (options: ResetOptions = DEFAULT_RESET_OPTIONS): Promise<void> => {
    try {
      setLoading(true);
      await financeDB.resetDatabase(options);

      const isSeed = options.target !== 'empty';

      if (options.resetAccounts) {
        if (isSeed) {
          const seededAccounts: Account[] = [
            {
              ...SEED_ACCOUNTS[0],
              categoryIds: SEED_CATEGORIES.map((c) => c.id),
              bucketIds: SEED_CATEGORIES.map((c) => c.id),
            },
          ];
          await financeDB.saveAccounts(seededAccounts);
          setAccounts(seededAccounts);
        } else {
          setAccounts([]);
        }
      }

      if (options.resetCategories) {
        if (isSeed) {
          await financeDB.saveCategories(SEED_CATEGORIES);
          setCategories(SEED_CATEGORIES);

          // Falls Konten nicht zurückgesetzt wurden, ihre categoryIds mit Seed synchronisieren
          if (!options.resetAccounts) {
            setAccounts((prev) =>
              prev.map((acc) => ({
                ...acc,
                categoryIds: SEED_CATEGORIES.map((c) => c.id),
                bucketIds: SEED_CATEGORIES.map((c) => c.id),
              }))
            );
          }
        } else {
          setCategories([]);
        }
      }

      if (options.resetTransactions) {
        if (isSeed && options.includeSampleTransactions) {
          await financeDB.saveTransactions(SEED_TRANSACTIONS);
          setTransactions(SEED_TRANSACTIONS);
        } else {
          await financeDB.clearTransactions();
          setTransactions([]);
        }
      } else {
        const doResetSplits = Boolean(options.resetSplits || options.resetTransactionOverrides);
        const doResetOverrides = Boolean(
          options.resetOverrides || options.resetTransactionOverrides
        );

        if (doResetSplits || doResetOverrides) {
          const baseTransactions =
            transactions.length > 0 ? transactions : await financeDB.getTransactions();

          let workingTransactions = [...baseTransactions];

          // 1. Splits auflösen: Split-Kinder entfernen und Elternbuchungen auf den vollen Betrag zurücksetzen
          if (doResetSplits) {
            workingTransactions = workingTransactions
              .filter((t) => !t.splitFromId && t.origin !== 'manual')
              .map((t) => {
                if (t.originalValue !== undefined && t.value !== t.originalValue) {
                  return {
                    ...t,
                    value: t.originalValue,
                  };
                }
                return t;
              });
          }

          // 2. Overrides zurücksetzen: Bank-Originalwerte wiederherstellen & manuelle Zuweisungen aufheben
          let currentCats = categories;
          if (options.resetCategories) {
            currentCats = isSeed ? SEED_CATEGORIES : [];
          }

          if (doResetOverrides) {
            // Kategorien von manuellen Transaktions-IDs bereinigen
            if (!options.resetCategories && currentCats.length > 0) {
              const cleanedCats = currentCats.map((c) => ({
                ...c,
                manualTransactionIds: [],
              }));
              await financeDB.saveCategories(cleanedCats);
              setCategories(cleanedCats);
              currentCats = cleanedCats;
            }

            // Alle importierten Buchungen auf Bank-Originaldaten zurücksetzen
            const restoredTxs = workingTransactions.map((t) => {
              if (t.origin === 'manual') return t;
              return resetTransactionToOriginal(t);
            });

            // Neu matchen gegen aktuelle Kategorien
            workingTransactions = reMatchAllTransactions(restoredTxs, currentCats);
          }

          await financeDB.clearTransactions();
          if (workingTransactions.length > 0) {
            await financeDB.saveTransactions(workingTransactions);
          }
          setTransactions(sortTransactionsDesc(workingTransactions));
        }
      }

      if (options.resetDeletedTransactions) {
        setDeletedTransactions([]);
      }

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
        autoReprogress,
        setAutoReprogress,
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
        addTransaction,
        updateTransaction,
        splitTransaction,
        updateSplitGroup,
        importTransactions,
        assignTransactionCategory,
        assignTransactionBucket: assignTransactionCategory,
        deleteTransaction,
        clearTransactions,
        triggerReMatch,
        resetTransaction,
        deletedTransactions,
        restoreTransaction,
        exportConfiguration,
        importConfiguration,
        resetWorkspace,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export { useFinance } from './useFinance';
