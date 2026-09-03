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

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const SEED_CONFIG = seedConfigurationJson as unknown as FinanceConfigExport;
const SEED_ACCOUNTS: Account[] = SEED_CONFIG.accounts || [];
const SEED_CATEGORIES: Category[] = SEED_CONFIG.categories || SEED_CONFIG.buckets || [];

const REMATCH_STATUS_STORAGE_KEY = 'finance_rematch_status';

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

      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setTransactions(sortTransactionsDesc(loadedTransactions));
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
    setReMatchStatus('needs_reprogress');

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
    setReMatchStatus('needs_reprogress');
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

    const updatedOriginalTx: Transaction = {
      ...originalTx,
      value: updatedOriginalValue,
      originalValue: originalTx.originalValue ?? originalTx.value,
      originalSubject: originalTx.originalSubject ?? originalTx.subject,
      originalReceiver: originalTx.originalReceiver ?? originalTx.receiver,
      originalAccountId: originalTx.originalAccountId ?? originalTx.accountId,
      originalValueDate: originalTx.originalValueDate ?? originalTx.valueDate,
      originalIban: originalTx.originalIban ?? originalTx.iban,
    };

    const splitId = `tx-split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const splitValue = (sign * Math.round(splitAmount * 100)) / 100;
    const newSplitTx: Transaction = {
      id: splitId,
      accountId: originalTx.accountId,
      valueDate: originalTx.valueDate,
      bookingDate: originalTx.bookingDate,
      issuer: originalTx.issuer,
      receiver: splitData.receiver.trim() || originalTx.receiver,
      subject: splitData.subject.trim() || `${originalTx.subject} (Split)`,
      iban: originalTx.iban,
      value: splitValue,
      categoryId: splitData.categoryId || null,
      bucketId: splitData.categoryId || null,
      assignmentSource: splitData.categoryId ? 'manual' : 'unassigned',
      origin: 'manual',
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

    // Nur importierte Bank-Transaktionen wandern in den Papierkorb (Gelöscht-Stapel & CSV-Tombstone).
    // Manuell erstellte Transaktionen (origin === 'manual') werden direkt endgültig gelöscht.
    const isManual = tx.origin === 'manual';

    if (!isManual) {
      await financeDB.saveDeletedTransaction(tx);
    }
    await financeDB.deleteTransaction(transactionId);

    // Eventuell hinterlegte manualTransactionIds in Kategorien bereinigen
    const needsCatUpdate = categories.some(
      (c) => c.manualTransactionIds && c.manualTransactionIds.includes(transactionId)
    );
    if (needsCatUpdate) {
      const updatedCategories = categories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== transactionId),
      }));
      await financeDB.saveCategories(updatedCategories);
      setCategories(updatedCategories);
    }

    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    if (!isManual) {
      setDeletedTransactions((prev) =>
        sortTransactionsDesc([...prev, { ...tx, deletedAt: new Date().toISOString() }])
      );
    }
  };

  /**
   * Setzt eine importierte Transaktion auf ihre Original-Bankdaten zurück.
   * Split-Teile werden dabei nicht gelöscht, sondern bleiben als eigenständige Buchungen erhalten.
   */
  const resetTransaction = async (transactionId: string): Promise<void> => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    const restored = resetTransactionToOriginal(tx);

    // Re-Match auf der zurückgesetzten Transaktion
    const match = matchTransaction(restored, categories);
    const finalTx: Transaction = {
      ...restored,
      categoryId: match.categoryId,
      bucketId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };

    await financeDB.saveTransaction(finalTx);
    setTransactions((prev) =>
      sortTransactionsDesc(prev.map((t) => (t.id === transactionId ? finalTx : t)))
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
    if (Array.isArray(loadedCats)) {
      setCategories(loadedCats);
      categoriesCount = loadedCats.length;
    }

    if (Array.isArray(parsed.transactions)) {
      setTransactions(sortTransactionsDesc(parsed.transactions));
      transactionsCount = parsed.transactions.length;
    } else if (Array.isArray(parsed.manualTransactions) && parsed.manualTransactions.length > 0) {
      const manualTxs = parsed.manualTransactions;
      setTransactions((prev) => {
        const existingIds = new Set(manualTxs.map((m) => m.id));
        const merged = prev.filter((p) => !existingIds.has(p.id)).concat(manualTxs);
        return sortTransactionsDesc(merged);
      });
      transactionsCount = manualTxs.length;
    }

    if (Array.isArray(parsed.deletedTransactions)) {
      setDeletedTransactions(sortTransactionsDesc(parsed.deletedTransactions));
    }

    setReMatchStatus('needs_reprogress');
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
          setTransactions([]);
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
