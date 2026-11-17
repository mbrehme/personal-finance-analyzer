/**
 * @file FinanceProvider.tsx
 * @description Zentraler React Context State für Konten, Kategorien und Transaktionen.
 * Komponiert die Domänen-Hooks hinter den abstrakten Repository-Schnittstellen (Ports).
 * @module domain/modules/finance/FinanceProvider
 */

import React, { createContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  ReMatchStatus,
  CategoryAssignmentSource,
} from '@/types';
import { Repositories, defaultRepositories } from '@/repository';
import { AccountFlowResolver, createAccountFlowResolver } from '../accounts/accountService';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import {
  sortTransactionsDesc,
  resetTransactionToOriginal,
  normalizeLegacyTransaction,
} from '../transactions/transactionService';
import { reMatchAllTransactions } from '../matcher/regexMatcher';
import seedConfigurationJson from '@/data/seedConfiguration.json';
import { SEED_TRANSACTIONS } from '@/data/seedTransactions';

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
  assignTransactionCategoryBatch: (
    transactionIds: string[],
    categoryId: string | null
  ) => Promise<void>;
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
  /** Vorindizierter Resolver für Konto- und Geldfluss-Auflösung */
  accountFlowResolver?: AccountFlowResolver;
}

export const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const SEED_CONFIG = seedConfigurationJson as unknown as FinanceConfigExport;
const SEED_ACCOUNTS: Account[] = SEED_CONFIG.accounts || [];
const SEED_CATEGORIES: Category[] = SEED_CONFIG.categories || [];

const REMATCH_STATUS_STORAGE_KEY = 'finance_rematch_status';
const AUTO_REPROGRESS_STORAGE_KEY = 'finance_auto_reprogress';

export interface FinanceProviderProps {
  children: React.ReactNode;
  repositories?: Repositories;
}

export const FinanceProvider: React.FC<FinanceProviderProps> = ({
  children,
  repositories = defaultRepositories,
}) => {
  const { accountRepository, categoryRepository, transactionRepository, metaRepository } =
    repositories;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const {
    accounts,
    setAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    addBalanceEntry,
    deleteBalanceEntry,
  } = useAccounts(accountRepository);

  const onCategoryConfigChangeRef = useRef<(updatedCats: Category[]) => Promise<void>>(
    async () => {}
  );

  const {
    categories,
    setCategories,
    addCategory,
    updateCategory,
    deleteCategory: removeCategoryFromRepo,
    reorderCategories,
  } = useCategories(categoryRepository, (updatedCats) =>
    onCategoryConfigChangeRef.current(updatedCats)
  );

  const {
    transactions,
    setTransactions,
    deletedTransactions,
    setDeletedTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    clearTransactions,
    splitTransaction,
    updateSplitGroup,
    resetTransaction,
    assignTransactionCategory,
    assignTransactionCategoryBatch,
    importTransactions: importTransactionsWithContext,
  } = useTransactions(transactionRepository, categoryRepository, categories, setCategories);

  const triggerReMatch = useCallback(async () => {
    setReMatchStatus('is_reprogressing');
    try {
      const [currentTxs, currentCats] = await Promise.all([
        transactionRepository.findAll(),
        categoryRepository.findAll(),
      ]);

      const reMatched = reMatchAllTransactions(currentTxs, currentCats);
      await transactionRepository.saveAll(reMatched);
      setTransactions(sortTransactionsDesc(reMatched));
      setReMatchStatus('has_progressed');
    } catch (err) {
      setReMatchStatus('needs_reprogress');
      setError(err instanceof Error ? err.message : 'Fehler beim Neu-Matching der Buchungen.');
    }
  }, [transactionRepository, categoryRepository, setTransactions, setReMatchStatus]);

  const notifyConfigChanged = useCallback(
    async (nextTransactions: Transaction[], nextCategories: Category[]) => {
      if (autoReprogress) {
        setReMatchStatus('is_reprogressing');
        try {
          const reMatched = reMatchAllTransactions(nextTransactions, nextCategories);
          await transactionRepository.saveAll(reMatched);
          setTransactions(sortTransactionsDesc(reMatched));
          setReMatchStatus('has_progressed');
        } catch (err) {
          setReMatchStatus('needs_reprogress');
          setError(err instanceof Error ? err.message : 'Fehler beim automatischen Neu-Matching.');
        }
      } else {
        setReMatchStatus('needs_reprogress');
      }
    },
    [autoReprogress, transactionRepository, setTransactions, setReMatchStatus]
  );

  onCategoryConfigChangeRef.current = async (updatedCats: Category[]) => {
    await notifyConfigChanged(transactions, updatedCats);
  };

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let [loadedAccounts, loadedCategories, loadedTransactions, loadedDeleted] = await Promise.all(
        [
          accountRepository.findAll(),
          categoryRepository.findAll(),
          transactionRepository.findAll(),
          transactionRepository.findDeleted(),
        ]
      );

      if (loadedCategories.length === 0) {
        await categoryRepository.saveAll(SEED_CATEGORIES);
        loadedCategories = SEED_CATEGORIES;
      } else {
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
          await categoryRepository.saveAll(sanitizedCategories);
          loadedCategories = sanitizedCategories;
        }
      }

      if (loadedAccounts.length === 0) {
        const seededAccounts: Account[] = [
          {
            ...SEED_ACCOUNTS[0],
            categoryIds: loadedCategories.map((c) => c.id),
          },
        ];
        await accountRepository.saveAll(seededAccounts);
        loadedAccounts = seededAccounts;
      }

      let needsTxMigrationSave = false;
      const migrated = loadedTransactions.map((tx) => {
        const raw = tx as unknown as Record<string, unknown>;
        if (
          tx.amount === undefined ||
          (!tx.senderIban && !tx.receiverIban && (raw.accountIban || raw.iban))
        ) {
          needsTxMigrationSave = true;
          return normalizeLegacyTransaction(tx);
        }
        return tx;
      });

      if (needsTxMigrationSave) {
        await transactionRepository.saveAll(migrated);
      }

      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setTransactions(sortTransactionsDesc(migrated));
      setDeletedTransactions(sortTransactionsDesc(loadedDeleted));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der lokalen Finanzdatenbank.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    accountRepository,
    categoryRepository,
    transactionRepository,
    setAccounts,
    setCategories,
    setTransactions,
    setDeletedTransactions,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteCategory = async (categoryId: string): Promise<void> => {
    await removeCategoryFromRepo(categoryId);
    const updatedCategories = categories.filter((c) => c.id !== categoryId);

    const updatedTxs = transactions.map((t) =>
      t.categoryId === categoryId
        ? { ...t, categoryId: null, assignmentSource: 'unassigned' as const }
        : t
    );
    await transactionRepository.saveAll(updatedTxs);
    setTransactions(sortTransactionsDesc(updatedTxs));
    await notifyConfigChanged(updatedTxs, updatedCategories);
  };

  const importTransactions = async (newTransactions: Transaction[]): Promise<number> =>
    importTransactionsWithContext(newTransactions, categories, accounts);

  const exportConfiguration = async (
    options: ExportOptions = DEFAULT_EXPORT_OPTIONS
  ): Promise<string> => {
    const exportData = await metaRepository.exportData(options);
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
    await metaRepository.importData(parsed);

    const loadedCats = parsed.categories;
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
      await metaRepository.resetWorkspace(options);

      const isSeed = options.target !== 'empty';

      if (options.resetAccounts) {
        if (isSeed) {
          const seededAccounts: Account[] = [
            {
              ...SEED_ACCOUNTS[0],
              categoryIds: SEED_CATEGORIES.map((c) => c.id),
            },
          ];
          await accountRepository.saveAll(seededAccounts);
          setAccounts(seededAccounts);
        } else {
          setAccounts([]);
        }
      }

      if (options.resetCategories) {
        if (isSeed) {
          await categoryRepository.saveAll(SEED_CATEGORIES);
          setCategories(SEED_CATEGORIES);

          if (!options.resetAccounts) {
            setAccounts((prev) =>
              prev.map((acc) => ({
                ...acc,
                categoryIds: SEED_CATEGORIES.map((c) => c.id),
              }))
            );
          }
        } else {
          setCategories([]);
        }
      }

      if (options.resetTransactions) {
        if (isSeed && options.includeSampleTransactions) {
          await transactionRepository.saveAll(SEED_TRANSACTIONS);
          setTransactions(SEED_TRANSACTIONS);
        } else {
          await transactionRepository.clearAll();
          setTransactions([]);
        }
      } else {
        const doResetSplits = Boolean(options.resetSplits);
        const doResetOverrides = Boolean(options.resetOverrides);

        if (doResetSplits || doResetOverrides) {
          const baseTransactions =
            transactions.length > 0 ? transactions : await transactionRepository.findAll();

          let workingTransactions = [...baseTransactions];

          if (doResetSplits) {
            workingTransactions = workingTransactions
              .filter((t) => !t.splitFromId && t.origin !== 'override')
              .map((t) =>
                t.originalValue !== undefined && t.value !== t.originalValue
                  ? { ...t, value: t.originalValue }
                  : t
              );
          }

          let currentCats = categories;
          if (options.resetCategories) {
            currentCats = isSeed ? SEED_CATEGORIES : [];
          }

          if (doResetOverrides) {
            if (!options.resetCategories && currentCats.length > 0) {
              const cleanedCats = currentCats.map((c) => ({
                ...c,
                manualTransactionIds: [],
              }));
              await categoryRepository.saveAll(cleanedCats);
              setCategories(cleanedCats);
              currentCats = cleanedCats;
            }

            const restoredTxs = workingTransactions.map((t) => {
              if (t.origin === 'override' && !t.originalDate) return t;
              return resetTransactionToOriginal(t);
            });

            workingTransactions = reMatchAllTransactions(restoredTxs, currentCats);
          }

          await transactionRepository.clearAll();
          if (workingTransactions.length > 0) {
            await transactionRepository.saveAll(workingTransactions);
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

  const accountFlowResolver = useMemo(
    () => createAccountFlowResolver(accounts, transactions),
    [accounts, transactions]
  );

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        categories,
        transactions,
        accountFlowResolver,
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
        addTransaction,
        updateTransaction,
        splitTransaction,
        updateSplitGroup,
        importTransactions,
        assignTransactionCategory,
        assignTransactionCategoryBatch,
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
