/**
 * @file balanceCalculator.ts
 * @description Berechnungs-Engine für historische und prognostizierte Kontostand-Entwicklungen
 * basierend auf hinterlegten Stichtags-Salden (Checkpoints) und Transaktions-Cashflows.
 * @module services/analytics/balanceCalculator
 */

import {
  Account,
  BalanceEntry,
  PeriodGranularity,
  Transaction,
  normalizeIban,
} from '@/types/finance';
import { extractPeriodKeys } from './cashflowCalculator';
import {
  getPeriodKey,
  getCurrentPeriodKey,
  fillPeriodKeyRange,
  getPeriodKeysBetween,
} from '@/utils/dateUtils';

export interface AccountPeriodBalance {
  startBalance: number;
  cashflow: number;
  endBalance: number;
}

export interface AccountBalanceRow {
  account: Account;
  periods: Record<string, AccountPeriodBalance>;
  latestBalance: number;
}

export interface BalanceAnalysisResult {
  periodKeys: string[];
  rows: AccountBalanceRow[];
  totalRow: {
    periods: Record<string, AccountPeriodBalance>;
    latestBalance: number;
  };
}

/**
 * Berechnet den Kontostand für ein Konto zu einem beliebigen Zeitpunkt basierend
 * auf Stichtags-Salden und summierten Transaktionen.
 * Berücksichtigt für echte Konten die IBAN und für virtuelle Unterkonten
 * die Transaktionen des übergeordneten echten Kontos gefiltert nach Kategorien.
 */
export function calculateBalanceTimeline(
  account: Account,
  transactions: Transaction[],
  periodKeys: string[],
  granularity: PeriodGranularity,
  parentAccount?: Account
): AccountBalanceRow {
  const normAccIban = normalizeIban(account.iban);
  const normParentIban = parentAccount ? normalizeIban(parentAccount.iban) : '';

  const accountTxs = transactions
    .filter((t) => {
      const normAccountIban = normalizeIban(t.accountIban);
      const normTxIban = normalizeIban(t.iban);

      if (account.accountType === 'virtual') {
        // Virtuelles Unterkonto: Buchungen des Elternkontos, die den Filter-Kategorien entsprechen
        const belongsToParent =
          (account.parentAccountId && t.accountId === account.parentAccountId) ||
          (normParentIban !== '' &&
            (normAccountIban === normParentIban || normTxIban === normParentIban));

        if (!belongsToParent) return false;

        const catId = t.categoryId || t.bucketId || null;
        const catIds = account.categoryIds || account.bucketIds || [];
        if (catIds.length === 0) return true;
        return Boolean(catId && catIds.includes(catId));
      }

      // Echtes Bankkonto: Buchungen dieses Kontos via accountIban, IBAN oder legacy accountId
      return (
        (normAccIban !== '' && (normAccountIban === normAccIban || normTxIban === normAccIban)) ||
        (t.accountId !== undefined && t.accountId === account.id)
      );
    })
    .sort((a, b) => a.valueDate.localeCompare(b.valueDate));

  // Sortierte Stichtags-Salden
  const checkpoints: BalanceEntry[] = [...account.balanceEntries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Basis-Startwert: Entweder ältester Checkpoint oder 0
  let baseDate = '1970-01-01';
  let baseAmount = 0;

  if (checkpoints.length > 0) {
    baseDate = checkpoints[0].date;
    baseAmount = checkpoints[0].amount;

    // Transaktionen vor dem ersten Checkpoint zurückrechnen
    const txsBeforeBase = accountTxs.filter((t) => t.valueDate < baseDate);
    const sumBefore = txsBeforeBase.reduce((sum, t) => sum + t.value, 0);
    // Wenn Checkpoint bei t0=1000€ liegt und vorher 200€ flossen, war Start bei 800€
    baseAmount -= sumBefore;
  }

  // Für jede Periode den Netto-Cashflow berechnen
  const periodCashflows: Record<string, number> = {};
  periodKeys.forEach((pKey) => {
    periodCashflows[pKey] = 0;
  });

  accountTxs.forEach((tx) => {
    const pKey = getPeriodKey(tx.valueDate, granularity);
    if (periodCashflows[pKey] !== undefined) {
      periodCashflows[pKey] += tx.value;
    }
  });

  // Fortlaufenden Saldo berechnen
  const periods: Record<string, AccountPeriodBalance> = {};
  let runningBalance = baseAmount;

  periodKeys.forEach((pKey) => {
    const startBalance = runningBalance;
    const cashflow = periodCashflows[pKey] || 0;
    const endBalance = startBalance + cashflow;

    periods[pKey] = {
      startBalance,
      cashflow,
      endBalance,
    };

    runningBalance = endBalance;
  });

  return {
    account,
    periods,
    latestBalance: runningBalance,
  };
}

export interface BalanceCalculatorOptions {
  /** Optionales Startdatum zur Filterung / Begrenzung der Perioden */
  startDate?: string | null;
  /** Optionales Enddatum zur Filterung / Begrenzung der Perioden */
  endDate?: string | null;
}

/**
 * Berechnet die gesamte Kontostand-Matrix über alle Konten und Perioden.
 * Ordnet virtuelle Unterkonten hierarchisch unter ihren Elternkonten an.
 * In die Gesamtsummenzeile fließen nur echte Konten ein, um Doppelzählungen zu vermeiden.
 */
export function calculateAllBalances(
  accounts: Account[],
  transactions: Transaction[],
  granularity: PeriodGranularity,
  selectedAccountId?: string | null,
  options?: BalanceCalculatorOptions
): BalanceAnalysisResult {
  let periodKeys: string[];
  if (options?.startDate && options?.endDate) {
    periodKeys = getPeriodKeysBetween(options.startDate, options.endDate, granularity);
  } else {
    const rawPeriodKeys = extractPeriodKeys(transactions, granularity);
    const currentPeriodKey = getCurrentPeriodKey(granularity);
    periodKeys =
      rawPeriodKeys.length > 0
        ? fillPeriodKeyRange(rawPeriodKeys, granularity, currentPeriodKey)
        : [currentPeriodKey];
  }

  const accountsToProcess = selectedAccountId
    ? accounts.filter((a) => a.id === selectedAccountId || a.parentAccountId === selectedAccountId)
    : accounts;

  // Konten hierarchisch anordnen: Echte Konten und direkt darunter ihre virtuellen Unterkonten
  const realAccounts = accountsToProcess
    .filter((a) => a.accountType !== 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const virtualAccounts = accountsToProcess
    .filter((a) => a.accountType === 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const hierarchicalAccounts: { account: Account; parent?: Account }[] = [];
  const assignedVirtualIds = new Set<string>();

  realAccounts.forEach((realAcc) => {
    hierarchicalAccounts.push({ account: realAcc });
    const subs = virtualAccounts.filter((va) => va.parentAccountId === realAcc.id);
    subs.forEach((sub) => {
      hierarchicalAccounts.push({ account: sub, parent: realAcc });
      assignedVirtualIds.add(sub.id);
    });
  });

  // Eventuelle verwaiste virtuelle Konten anhängen
  virtualAccounts.forEach((va) => {
    if (!assignedVirtualIds.has(va.id)) {
      const parent = accounts.find((a) => a.id === va.parentAccountId);
      hierarchicalAccounts.push({ account: va, parent });
    }
  });

  const rows: AccountBalanceRow[] = hierarchicalAccounts.map(({ account, parent }) =>
    calculateBalanceTimeline(account, transactions, periodKeys, granularity, parent)
  );

  // Gesamtsummenzeile: Summiert nur echte Konten, um Doppelzählungen zu verhindern
  const realRows = rows.filter((r) => r.account.accountType !== 'virtual');
  const totalRowPeriods: Record<string, AccountPeriodBalance> = {};
  let totalLatest = 0;

  periodKeys.forEach((pKey) => {
    let start = 0;
    let cf = 0;
    let end = 0;

    realRows.forEach((r) => {
      const p = r.periods[pKey];
      if (p) {
        start += p.startBalance;
        cf += p.cashflow;
        end += p.endBalance;
      }
    });

    totalRowPeriods[pKey] = {
      startBalance: start,
      cashflow: cf,
      endBalance: end,
    };
  });

  realRows.forEach((r) => {
    totalLatest += r.latestBalance;
  });

  return {
    periodKeys,
    rows,
    totalRow: {
      periods: totalRowPeriods,
      latestBalance: totalLatest,
    },
  };
}
