/**
 * @file finance.ts
 * @description Abwärtskompatibler Re-Export-Barrel für alle Domänen-Typen und Hilfsfunktionen.
 * Verweist direkt auf die Schicht 1 Typen und Schicht 3 Domänen-Services.
 * @module types/finance
 */

export * from './index';

// Re-export domain calculations for backwards compatibility
export {
  normalizeIban,
  resolveDeepestAccount,
  getTransactionAccountInfo,
  getSubAccountIds,
  getTransactionEffectiveValueForAccount,
  hasDirectCounterpart,
  isTransactionMatchingAccount,
  isInternalTransfer,
  getEffectiveTransactionPartner,
} from '@/domain/modules/accounts/accountService';

export {
  sanitizeParentCategoryRules,
  buildCompoundSearchField,
  matchTransaction,
  reMatchAllTransactions,
} from '@/domain/modules/categories/categoryService';

export {
  getTransactionType,
  getTransactionOrigin,
  isTransactionOverridden,
  isManualTransaction,
  resetTransactionToOriginal,
  sortTransactionsDesc,
  calculateSingleSplit,
} from '@/domain/modules/transactions/transactionService';

export type { TransactionAccountInfo } from '@/domain/modules/accounts/accountService';

export type { CategoryMatchResult } from '@/domain/modules/categories/categoryService';

export type {
  SplitInput,
  CalculatedSplitResult,
} from '@/domain/modules/transactions/transactionService';
