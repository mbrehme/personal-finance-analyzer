/**
 * @file transactionQuery.ts
 * @description Reine Domänen-Logik für Transaktionssuche, Multikriterien-Filterung und perspektivische Summierung.
 * @module domain/modules/transactions/transactionQuery
 */

import { Account, Category, ISODateString, Transaction, TransactionFlowType } from '@/types';
import { formatMoney, roundToTwoDecimals } from '@/utils/moneyUtils';
import { AccountFlowResolver, createAccountFlowResolver } from '../accounts/accountService';
import { buildCompoundSearchField } from '../categories/categoryService';
import { getTransactionOrigin, sortTransactionsDesc } from './transactionService';

export type TransactionOriginFilter =
  'all' | 'imported' | 'split' | 'override' | 'manual' | 'deleted';

export interface TransactionQueryFilters {
  searchTerm: string;
  accountId: string;
  categoryIds: string[] | null;
  type: TransactionFlowType | 'all';
  origin: TransactionOriginFilter;
  startDate: string;
  endDate: string;
}

export interface TransactionQueryInput {
  transactions: Transaction[];
  deletedTransactions?: Transaction[];
  accounts: Account[];
  categories: Category[];
  filters: TransactionQueryFilters;
  flowResolver?: AccountFlowResolver;
}

export interface TransactionQueryResult {
  transactions: Transaction[];
  totalSum: number;
  inboundSum: number;
  outboundSum: number;
}

/**
 * Prüft, ob eine Transaktion einen Suchbegriff im Compound-Key, Betrag oder Kategorienamen enthält.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {string} term - Der Suchbegriff
 * @param {Map<string, string>} [categoryNameMap] - Optionales Mapping von Kategorie-ID auf Name
 * @returns {boolean} true, falls die Transaktion zum Suchbegriff passt
 */
export function matchesSearch(
  tx: Transaction,
  term: string,
  categoryNameMap?: Map<string, string>
): boolean {
  if (!term) return true;
  const normTerm = term.trim().toLowerCase();
  if (!normTerm) return true;

  const compound = buildCompoundSearchField(tx).toLowerCase();
  if (compound.includes(normTerm)) return true;

  const amt = tx.amount !== undefined ? tx.amount : Math.abs(tx.value);
  const formattedValue = formatMoney(tx.value).toLowerCase();
  const formattedAmount = formatMoney(amt).toLowerCase();
  const rawValue = String(tx.value).toLowerCase();
  const rawAmount = String(amt).toLowerCase();
  const fixedAmount = amt.toFixed(2);
  const germanFixedAmount = fixedAmount.replace('.', ',');

  if (
    formattedValue.includes(normTerm) ||
    formattedAmount.includes(normTerm) ||
    rawValue.includes(normTerm) ||
    rawAmount.includes(normTerm) ||
    fixedAmount.includes(normTerm) ||
    germanFixedAmount.includes(normTerm)
  ) {
    return true;
  }

  if (tx.categoryId && categoryNameMap) {
    const catName = categoryNameMap.get(tx.categoryId);
    if (catName && catName.toLowerCase().includes(normTerm)) {
      return true;
    }
  }

  return false;
}

/**
 * Summiert Transaktionen perspektivisch für ein optional ausgewähltes Konto.
 *
 * @param {Transaction[]} transactions - Zu summierende Transaktionen
 * @param {Account | undefined} selectedAccount - Optionales Zielkonto
 * @param {AccountFlowResolver} flowResolver - Vorindizierter Flow-Resolver
 * @returns {number} Gerundete Gesamtsumme
 */
export function sumTransactionsForAccount(
  transactions: Transaction[],
  selectedAccount: Account | undefined,
  flowResolver: AccountFlowResolver
): number {
  let total = 0;
  for (const tx of transactions) {
    const eff = selectedAccount
      ? (flowResolver.getEffectiveValue(tx, selectedAccount) ?? tx.value)
      : tx.value;
    total += eff;
  }
  return roundToTwoDecimals(total);
}

/**
 * Filtert, sortiert und summiert Transaktionen anhand aller UI-Filterkriterien.
 *
 * @param {TransactionQueryInput} input - Daten, Filter und optionaler vorindizierter Resolver
 * @returns {TransactionQueryResult} Gefilterte Transaktionen inkl. Gesamtsummen
 */
export function queryTransactions({
  transactions,
  deletedTransactions = [],
  accounts,
  categories,
  filters,
  flowResolver: providedResolver,
}: TransactionQueryInput): TransactionQueryResult {
  const resolver = providedResolver ?? createAccountFlowResolver(accounts, transactions);
  const categoryNameMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  const selectedAccount =
    filters.accountId !== 'all' ? accounts.find((a) => a.id === filters.accountId) : undefined;

  const { searchTerm, accountId, categoryIds, type, origin, startDate, endDate } = filters;
  const trimmedSearch = searchTerm.trim();

  let filtered: Transaction[];

  if (origin === 'deleted') {
    filtered = sortTransactionsDesc(
      deletedTransactions.filter((tx) => matchesSearch(tx, trimmedSearch, categoryNameMap))
    );
  } else {
    const allowedSet = categoryIds !== null ? new Set(categoryIds) : null;

    const matches = transactions.filter((tx) => {
      if (accountId !== 'all' && !resolver.isMatchingAccount(tx, accountId)) {
        return false;
      }

      if (allowedSet !== null) {
        if (allowedSet.size === 0) return false;
        const txCatId = tx.categoryId ?? null;
        if (!txCatId) {
          if (!allowedSet.has('__uncategorized__')) return false;
        } else if (!allowedSet.has(txCatId)) {
          return false;
        }
      }

      if (type !== 'all' && !resolver.matchesFlowType(tx, type, selectedAccount)) {
        return false;
      }

      if (origin !== 'all') {
        const txOrigin = getTransactionOrigin(tx);
        if (origin === 'imported' && txOrigin !== 'imported') return false;
        if (origin === 'split' && txOrigin !== 'split') return false;
        if ((origin === 'override' || origin === 'manual') && txOrigin !== 'override') {
          return false;
        }
      }

      const txDate = tx.date;
      if (startDate && txDate < (startDate as ISODateString)) return false;
      if (endDate && txDate > (endDate as ISODateString)) return false;

      if (trimmedSearch && !matchesSearch(tx, trimmedSearch, categoryNameMap)) {
        return false;
      }

      return true;
    });

    filtered = sortTransactionsDesc(matches);
  }

  let total = 0;
  let inbound = 0;
  let outbound = 0;

  for (const tx of filtered) {
    const eff = selectedAccount
      ? (resolver.getEffectiveValue(tx, selectedAccount) ?? tx.value)
      : tx.value;

    total += eff;
    if (eff > 0) {
      inbound += eff;
    } else if (eff < 0) {
      outbound += eff;
    }
  }

  return {
    transactions: filtered,
    totalSum: roundToTwoDecimals(total),
    inboundSum: roundToTwoDecimals(inbound),
    outboundSum: roundToTwoDecimals(outbound),
  };
}
