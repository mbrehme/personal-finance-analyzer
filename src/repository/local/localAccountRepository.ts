/**
 * @file localAccountRepository.ts
 * @description Konkrete LocalStorage-Implementierung des AccountRepository.
 * @module repository/local/localAccountRepository
 */

import { Account } from '@/types';
import { AccountRepository } from '../contracts/accountRepository';
import { STORAGE_KEYS } from './storageKeys';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storageUtils';

export class LocalAccountRepository implements AccountRepository {
  async findAll(): Promise<Account[]> {
    return safeGetItem<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
  }

  async findById(id: string): Promise<Account | null> {
    const list = await this.findAll();
    return list.find((a) => a.id === id) || null;
  }

  async save(account: Account): Promise<void> {
    const list = await this.findAll();
    const idx = list.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
      list[idx] = account;
    } else {
      list.push(account);
    }
    safeSetItem(STORAGE_KEYS.ACCOUNTS, list);
  }

  async saveAll(accounts: Account[]): Promise<void> {
    safeSetItem(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  async delete(id: string): Promise<void> {
    const list = await this.findAll();
    const filtered = list.filter((a) => a.id !== id);
    safeSetItem(STORAGE_KEYS.ACCOUNTS, filtered);
  }

  async clearAll(): Promise<void> {
    safeRemoveItem(STORAGE_KEYS.ACCOUNTS);
  }
}
