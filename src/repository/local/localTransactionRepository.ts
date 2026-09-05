/**
 * @file localTransactionRepository.ts
 * @description Konkrete LocalStorage-Implementierung des TransactionRepository.
 * @module repository/local/localTransactionRepository
 */

import { Transaction } from '@/types';
import { TransactionRepository } from '../contracts/transactionRepository';
import { STORAGE_KEYS } from './storageKeys';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storageUtils';

export class LocalTransactionRepository implements TransactionRepository {
  async findAll(): Promise<Transaction[]> {
    return safeGetItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  }

  async findById(id: string): Promise<Transaction | null> {
    const list = await this.findAll();
    return list.find((t) => t.id === id) || null;
  }

  async save(transaction: Transaction): Promise<void> {
    const list = await this.findAll();
    const idx = list.findIndex((t) => t.id === transaction.id);
    if (idx >= 0) {
      list[idx] = transaction;
    } else {
      list.push(transaction);
    }
    safeSetItem(STORAGE_KEYS.TRANSACTIONS, list);
  }

  async saveAll(transactions: Transaction[]): Promise<void> {
    safeSetItem(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  async delete(id: string): Promise<void> {
    const list = await this.findAll();
    const filtered = list.filter((t) => t.id !== id);
    safeSetItem(STORAGE_KEYS.TRANSACTIONS, filtered);
  }

  async clearAll(): Promise<void> {
    safeRemoveItem(STORAGE_KEYS.TRANSACTIONS);
  }

  async findDeleted(): Promise<Transaction[]> {
    return safeGetItem<Transaction[]>(STORAGE_KEYS.DELETED_TRANSACTIONS, []);
  }

  async saveDeleted(transactions: Transaction[]): Promise<void> {
    const existing = await this.findDeleted();
    const map = new Map<string, Transaction>();
    existing.forEach((t) => map.set(t.id, t));
    transactions.forEach((t) => map.set(t.id, t));
    safeSetItem(STORAGE_KEYS.DELETED_TRANSACTIONS, Array.from(map.values()));
  }

  async deleteFromTrash(id: string): Promise<void> {
    const list = await this.findDeleted();
    const filtered = list.filter((t) => t.id !== id);
    safeSetItem(STORAGE_KEYS.DELETED_TRANSACTIONS, filtered);
  }

  async clearDeleted(): Promise<void> {
    safeRemoveItem(STORAGE_KEYS.DELETED_TRANSACTIONS);
  }
}
