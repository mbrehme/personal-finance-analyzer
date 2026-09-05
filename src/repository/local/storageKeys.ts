/**
 * @file storageKeys.ts
 * @description Versionierte Schlüsselkonstanten für den LocalStorage-Adapter.
 * @module repository/local/storageKeys
 */

export const STORAGE_KEYS = {
  ACCOUNTS: 'pfa_accounts_v1',
  CATEGORIES: 'pfa_categories_v1',
  TRANSACTIONS: 'pfa_transactions_v1',
  DELETED_TRANSACTIONS: 'pfa_deleted_transactions_v1',
  CONFIG_VERSION: 'pfa_storage_version',
} as const;

export const CURRENT_STORAGE_VERSION = '1.0.0';
