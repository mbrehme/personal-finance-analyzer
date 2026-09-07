/**
 * @file indexedDbRepositories.ts
 * @description IndexedDB-Adapter zur Umsetzung der abstrakten Repository-Schnittstellen.
 * @module repository/indexeddb/indexedDbRepositories
 */

import {
  Account,
  Category,
  Transaction,
  ExportOptions,
  FinanceConfigExport,
  ResetOptions,
} from '@/types';
import { AccountRepository } from '../contracts/accountRepository';
import { CategoryRepository } from '../contracts/categoryRepository';
import { TransactionRepository } from '../contracts/transactionRepository';
import { MetaRepository } from '../contracts/metaRepository';
import { financeDB } from './db';

export class IndexedDbAccountRepository implements AccountRepository {
  async findAll(): Promise<Account[]> {
    return financeDB.getAccounts();
  }

  async findById(id: string): Promise<Account | null> {
    const list = await this.findAll();
    return list.find((a) => a.id === id) || null;
  }

  async save(account: Account): Promise<void> {
    await financeDB.saveAccount(account);
  }

  async saveAll(accounts: Account[]): Promise<void> {
    await financeDB.saveAccounts(accounts);
  }

  async delete(id: string): Promise<void> {
    await financeDB.deleteAccount(id);
  }

  async clearAll(): Promise<void> {
    const list = await this.findAll();
    for (const a of list) {
      await financeDB.deleteAccount(a.id);
    }
  }
}

export class IndexedDbCategoryRepository implements CategoryRepository {
  async findAll(): Promise<Category[]> {
    return financeDB.getCategories();
  }

  async findById(id: string): Promise<Category | null> {
    const list = await this.findAll();
    return list.find((c) => c.id === id) || null;
  }

  async save(category: Category): Promise<void> {
    await financeDB.saveCategory(category);
  }

  async saveAll(categories: Category[]): Promise<void> {
    await financeDB.saveCategories(categories);
  }

  async delete(id: string): Promise<void> {
    await financeDB.deleteCategory(id);
  }

  async clearAll(): Promise<void> {
    const list = await this.findAll();
    for (const c of list) {
      await financeDB.deleteCategory(c.id);
    }
  }
}

export class IndexedDbTransactionRepository implements TransactionRepository {
  async findAll(): Promise<Transaction[]> {
    return financeDB.getTransactions();
  }

  async findById(id: string): Promise<Transaction | null> {
    const list = await this.findAll();
    return list.find((t) => t.id === id) || null;
  }

  async save(transaction: Transaction): Promise<void> {
    await financeDB.saveTransaction(transaction);
  }

  async saveAll(transactions: Transaction[]): Promise<void> {
    await financeDB.saveTransactions(transactions);
  }

  async delete(id: string): Promise<void> {
    await financeDB.deleteTransaction(id);
  }

  async clearAll(): Promise<void> {
    await financeDB.clearTransactions();
  }

  async findDeleted(): Promise<Transaction[]> {
    return financeDB.getDeletedTransactions();
  }

  async saveDeleted(transactions: Transaction[]): Promise<void> {
    await financeDB.saveDeletedTransactions(transactions);
  }

  async deleteFromTrash(id: string): Promise<void> {
    await financeDB.permanentlyDeleteTransaction(id);
  }

  async clearDeleted(): Promise<void> {
    await financeDB.clearDeletedTransactions();
  }
}

export class IndexedDbMetaRepository implements MetaRepository {
  async exportData(options?: ExportOptions): Promise<FinanceConfigExport> {
    return financeDB.exportConfiguration(options);
  }

  async importData(config: FinanceConfigExport): Promise<void> {
    await financeDB.importConfiguration(config);
  }

  async resetWorkspace(options?: ResetOptions): Promise<void> {
    await financeDB.resetDatabase(options);
  }
}
