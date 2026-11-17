/**
 * @file inMemoryRepositories.ts
 * @description In-Memory Repository-Adapter für isolierte Domänen- und Provider-Tests.
 * @module repository/testing/inMemoryRepositories
 */

import {
  Account,
  Category,
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_RESET_OPTIONS,
  ExportOptions,
  FinanceConfigExport,
  ResetOptions,
  Transaction,
} from '@/types';
import { Repositories } from '../index';
import { isTransactionOverridden } from '@/domain/modules/transactions/transactionService';

/**
 * Erzeugt ein vollständig isoliertes In-Memory Repository-Set für Unit-Tests.
 *
 * @returns {Repositories} Frische In-Memory-Adapter hinter den Repository-Verträgen
 */
export function createInMemoryRepositories(): Repositories {
  let accounts: Account[] = [];
  let categories: Category[] = [];
  let transactions: Transaction[] = [];
  let deletedTransactions: Transaction[] = [];

  return {
    accountRepository: {
      findAll: async () => [...accounts],
      findById: async (id) => accounts.find((a) => a.id === id) ?? null,
      save: async (account) => {
        accounts = accounts.some((a) => a.id === account.id)
          ? accounts.map((a) => (a.id === account.id ? account : a))
          : [...accounts, account];
      },
      saveAll: async (list) => {
        accounts = [...list];
      },
      delete: async (id) => {
        accounts = accounts.filter((a) => a.id !== id);
      },
      clearAll: async () => {
        accounts = [];
      },
    },
    categoryRepository: {
      findAll: async () => [...categories],
      findById: async (id) => categories.find((c) => c.id === id) ?? null,
      save: async (category) => {
        categories = categories.some((c) => c.id === category.id)
          ? categories.map((c) => (c.id === category.id ? category : c))
          : [...categories, category];
      },
      saveAll: async (list) => {
        categories = [...list];
      },
      delete: async (id) => {
        categories = categories.filter((c) => c.id !== id);
      },
      clearAll: async () => {
        categories = [];
      },
    },
    transactionRepository: {
      findAll: async () => [...transactions],
      findById: async (id) => transactions.find((t) => t.id === id) ?? null,
      save: async (tx) => {
        transactions = transactions.some((t) => t.id === tx.id)
          ? transactions.map((t) => (t.id === tx.id ? tx : t))
          : [...transactions, tx];
      },
      saveAll: async (list) => {
        const map = new Map(transactions.map((t) => [t.id, t]));
        for (const item of list) {
          map.set(item.id, item);
        }
        transactions = Array.from(map.values());
      },
      delete: async (id) => {
        transactions = transactions.filter((t) => t.id !== id);
      },
      clearAll: async () => {
        transactions = [];
      },
      findDeleted: async () => [...deletedTransactions],
      saveDeleted: async (list) => {
        const map = new Map(deletedTransactions.map((t) => [t.id, t]));
        for (const item of list) {
          map.set(item.id, item);
        }
        deletedTransactions = Array.from(map.values());
      },
      deleteFromTrash: async (id) => {
        deletedTransactions = deletedTransactions.filter((t) => t.id !== id);
      },
      clearDeleted: async () => {
        deletedTransactions = [];
      },
    },
    metaRepository: {
      exportData: async (
        _options: ExportOptions = DEFAULT_EXPORT_OPTIONS
      ): Promise<FinanceConfigExport> => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: [...accounts],
        categories: [...categories],
        manualTransactions: transactions.filter(isTransactionOverridden),
        transactions: [...transactions],
        deletedTransactions: [...deletedTransactions],
      }),
      importData: async (config: FinanceConfigExport) => {
        if (Array.isArray(config.accounts)) accounts = [...config.accounts];
        if (Array.isArray(config.categories)) categories = [...config.categories];
        if (Array.isArray(config.transactions)) transactions = [...config.transactions];
        if (Array.isArray(config.deletedTransactions)) {
          deletedTransactions = [...config.deletedTransactions];
        }
      },
      resetWorkspace: async (options: ResetOptions = DEFAULT_RESET_OPTIONS) => {
        if (options.resetAccounts) accounts = [];
        if (options.resetCategories) categories = [];
        if (options.resetTransactions) transactions = [];
        if (options.resetDeletedTransactions) deletedTransactions = [];
      },
    },
  };
}
