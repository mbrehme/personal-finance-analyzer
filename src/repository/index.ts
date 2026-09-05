/**
 * @file index.ts
 * @description Zentraler Export- und Factory-Layer für die Persistenz (Schicht 2).
 * Ermöglicht den transparenten Austausch zwischen LocalStorage und IndexedDB.
 * @module repository
 */

export * from './contracts';
export * from './local/storageKeys';
export * from './utils/storageUtils';

import { AccountRepository } from './contracts/accountRepository';
import { CategoryRepository } from './contracts/categoryRepository';
import { TransactionRepository } from './contracts/transactionRepository';
import { MetaRepository } from './contracts/metaRepository';

import { LocalAccountRepository } from './local/localAccountRepository';
import { LocalCategoryRepository } from './local/localCategoryRepository';
import { LocalTransactionRepository } from './local/localTransactionRepository';
import { LocalMetaRepository } from './local/localMetaRepository';

import {
  IndexedDbAccountRepository,
  IndexedDbCategoryRepository,
  IndexedDbTransactionRepository,
  IndexedDbMetaRepository,
} from './indexeddb/indexedDbRepositories';

export type StorageBackendType = 'local_storage' | 'indexed_db';

/**
 * Standard-Backend: IndexedDB für performante und unbegrenzte Offline-Speicherung.
 * Kann dynamisch auf 'local_storage' umgeschaltet werden.
 */
let currentBackend: StorageBackendType = 'indexed_db';

export function setStorageBackend(backend: StorageBackendType): void {
  currentBackend = backend;
}

export function getStorageBackend(): StorageBackendType {
  return currentBackend;
}

/**
 * Factory zur Instanziierung der aktiven Repositories.
 */
export function createRepositories(backend: StorageBackendType = currentBackend): {
  accountRepository: AccountRepository;
  categoryRepository: CategoryRepository;
  transactionRepository: TransactionRepository;
  metaRepository: MetaRepository;
} {
  if (backend === 'local_storage') {
    const accountRepository = new LocalAccountRepository();
    const categoryRepository = new LocalCategoryRepository();
    const transactionRepository = new LocalTransactionRepository();
    const metaRepository = new LocalMetaRepository(
      accountRepository,
      categoryRepository,
      transactionRepository
    );
    return {
      accountRepository,
      categoryRepository,
      transactionRepository,
      metaRepository,
    };
  }

  return {
    accountRepository: new IndexedDbAccountRepository(),
    categoryRepository: new IndexedDbCategoryRepository(),
    transactionRepository: new IndexedDbTransactionRepository(),
    metaRepository: new IndexedDbMetaRepository(),
  };
}

// Singleton-Instanzen für Default-Verwendung
export const defaultRepositories = createRepositories();
export const accountRepository = defaultRepositories.accountRepository;
export const categoryRepository = defaultRepositories.categoryRepository;
export const transactionRepository = defaultRepositories.transactionRepository;
export const metaRepository = defaultRepositories.metaRepository;
