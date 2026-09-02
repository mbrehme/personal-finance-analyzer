/**
 * @file balanceCalculator.ts
 * @description Berechnungs-Engine für historische und prognostizierte Kontostand-Entwicklungen
 * basierend auf hinterlegten Stichtags-Salden (Checkpoints) und Transaktions-Cashflows.
 * @module services/analytics/balanceCalculator
 */

import { Account, BalanceEntry, PeriodGranularity, Transaction } from '@/types/finance';
import { extractPeriodKeys } from './cashflowCalculator';
import { getPeriodKey } from '@/utils/dateUtils';

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
 */
export function calculateBalanceTimeline(
  account: Account,
  transactions: Transaction[],
  periodKeys: string[],
  granularity: PeriodGranularity
): AccountBalanceRow {
  const accountTxs = transactions
    .filter((t) => t.accountId === account.id)
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

/**
 * Berechnet die gesamte Kontostand-Matrix über alle Konten und Perioden.
 */
export function calculateAllBalances(
  accounts: Account[],
  transactions: Transaction[],
  granularity: PeriodGranularity
): BalanceAnalysisResult {
  const periodKeys = extractPeriodKeys(transactions, granularity);

  const sortedAccounts = [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows: AccountBalanceRow[] = sortedAccounts.map((acc) =>
    calculateBalanceTimeline(acc, transactions, periodKeys, granularity)
  );

  // Gesamtsummenzeile über alle Konten
  const totalRowPeriods: Record<string, AccountPeriodBalance> = {};
  let totalLatest = 0;

  periodKeys.forEach((pKey) => {
    let start = 0;
    let cf = 0;
    let end = 0;

    rows.forEach((r) => {
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

  rows.forEach((r) => {
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
