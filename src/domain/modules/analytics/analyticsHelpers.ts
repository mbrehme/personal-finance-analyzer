/**
 * @file analyticsHelpers.ts
 * @description Gemeinsame Domänen-Hilfsfunktionen für Cashflow- und Salden-Analysen:
 * Transaktionsfilterung, Periodenschlüssel-Auflösung und Konten-Hierarchieaufbau.
 * @module domain/modules/analytics/analyticsHelpers
 */

import { Account, PeriodGranularity, Transaction } from '@/types';
import {
  fillPeriodKeyRange,
  getCurrentPeriodKey,
  getPeriodKey,
  getPeriodKeysBetween,
} from '@/utils/dateUtils';
import { AccountFlowResolver } from '../accounts/accountService';

export interface AccountHierarchyNode {
  account: Account;
  parent?: Account;
  depth: 0 | 1;
  hasChildren: boolean;
}

/**
 * Filtert Transaktionen konsistent nach Konto, Datumsbereich und Kategorie-Auswahl.
 */
export function filterAnalyticsTransactions(
  transactions: Transaction[],
  flowResolver: AccountFlowResolver,
  options?: {
    selectedAccountId?: string;
    hasAccounts?: boolean;
    startDate?: string;
    endDate?: string;
    selectedCategoryIds?: string[];
  }
): Transaction[] {
  let filtered = options?.selectedAccountId
    ? transactions.filter((t) =>
        options.hasAccounts === false
          ? false
          : flowResolver.isMatchingAccount(t, options.selectedAccountId!)
      )
    : transactions;

  if (options?.startDate || options?.endDate) {
    filtered = filtered.filter((tx) => {
      const txDate = tx.date || '';
      if (options.startDate && txDate < options.startDate) return false;
      if (options.endDate && txDate > options.endDate) return false;
      return true;
    });
  }

  if (options?.selectedCategoryIds !== undefined) {
    const allowed = new Set(options.selectedCategoryIds);
    const allowUncategorized = allowed.has('__uncategorized__');

    filtered = filtered.filter((tx) => {
      const catId = tx.categoryId;
      if (!catId) {
        return allowUncategorized;
      }
      return allowed.has(catId);
    });
  }

  return filtered;
}

/**
 * Ermittelt alle eindeutigen, chronologisch sortierten Periodenschlüssel aus Transaktionen.
 */
export function extractPeriodKeysFromTransactions(
  transactions: Transaction[],
  granularity: PeriodGranularity
): string[] {
  const keys = new Set<string>();
  transactions.forEach((tx) => {
    const d = tx.date || '';
    if (d) {
      keys.add(getPeriodKey(d, granularity));
    }
  });
  return Array.from(keys).sort();
}

/**
 * Löst die anzuzeigenden Periodenschlüssel für Cashflow-Matrizen auf.
 */
export function resolveCashflowPeriodKeys(
  transactions: Transaction[],
  granularity: PeriodGranularity,
  options?: {
    startDate?: string;
    endDate?: string;
    includeCurrentPeriod?: boolean;
    referenceDate?: Date | string | number;
  }
): string[] {
  if (options?.startDate && options?.endDate) {
    return getPeriodKeysBetween(options.startDate, options.endDate, granularity);
  }

  const rawPeriodKeys = extractPeriodKeysFromTransactions(transactions, granularity);
  const includeCurrent = options?.includeCurrentPeriod ?? false;
  const currentKey = includeCurrent
    ? getCurrentPeriodKey(granularity, options?.referenceDate)
    : undefined;

  if (rawPeriodKeys.length > 0) {
    return includeCurrent
      ? fillPeriodKeyRange(rawPeriodKeys, granularity, currentKey)
      : rawPeriodKeys;
  }

  return currentKey ? [currentKey] : [];
}

/**
 * Baut die hierarchische Kontenliste (echte Konten mit virtuellen Unterkonten + verwaiste virtuelle Konten).
 */
export function buildAccountHierarchy(
  accounts: Account[],
  selectedAccountId?: string
): AccountHierarchyNode[] {
  const accountsToProcess = selectedAccountId
    ? accounts.filter((a) => a.id === selectedAccountId || a.parentAccountId === selectedAccountId)
    : accounts;

  const realAccounts = accountsToProcess
    .filter((a) => a.accountType !== 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const virtualAccounts = accountsToProcess
    .filter((a) => a.accountType === 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const nodes: AccountHierarchyNode[] = [];
  const assignedVirtualIds = new Set<string>();

  realAccounts.forEach((realAcc) => {
    const subs = virtualAccounts.filter((va) => va.parentAccountId === realAcc.id);
    nodes.push({
      account: realAcc,
      depth: 0,
      hasChildren: subs.length > 0,
    });

    subs.forEach((sub) => {
      assignedVirtualIds.add(sub.id);
      nodes.push({
        account: sub,
        parent: realAcc,
        depth: 1,
        hasChildren: false,
      });
    });
  });

  virtualAccounts
    .filter((va) => !assignedVirtualIds.has(va.id))
    .forEach((va) => {
      const parent = accounts.find((a) => a.id === va.parentAccountId);
      nodes.push({
        account: va,
        parent,
        depth: 0,
        hasChildren: false,
      });
    });

  return nodes;
}
