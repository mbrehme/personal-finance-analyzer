/**
 * @file balanceCalculator.ts
 * @description Berechnungs-Engine für historische und prognostizierte Kontostand-Entwicklungen
 * basierend auf hinterlegten Stichtags-Salden (Checkpoints) und Transaktions-Cashflows.
 * @module services/analytics/balanceCalculator
 */

import {
  Account,
  BalanceEntry,
  ISODateString,
  PeriodGranularity,
  Transaction,
  getTransactionEffectiveValueForAccount,
} from '@/types/finance';
import {
  getPeriodKey,
  getCurrentPeriodKey,
  fillPeriodKeyRange,
  getPeriodKeysBetween,
  getPeriodDateRange,
  getDayBefore,
} from '@/utils/dateUtils';
import { roundToTwoDecimals } from '@/utils/moneyUtils';

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
 *
 * @param {Account} account - Das zu berechnende Konto
 * @param {Transaction[]} transactions - Alle Transaktionen
 * @param {string[]} periodKeys - Alle relevanten Perioden-Schlüssel
 * @param {PeriodGranularity} granularity - Perioden-Granularität
 * @param {Account} [parentAccount] - Übergeordnetes Hauptkonto (bei virtuellen Konten)
 * @param {Account[]} [accounts] - Alle Konten im Workspace zur Beziehungsauflösung
 * @returns {AccountBalanceRow} Zeile mit Ständen und Cashflow pro Periode
 */
export function calculateBalanceTimeline(
  account: Account,
  transactions: Transaction[],
  periodKeys: string[],
  granularity: PeriodGranularity,
  parentAccount?: Account,
  accounts?: Account[]
): AccountBalanceRow {
  let contextAccounts = accounts;
  if (!contextAccounts || contextAccounts.length === 0) {
    const list: Account[] = [account];
    if (parentAccount && parentAccount.id !== account.id) {
      list.push(parentAccount);
    }
    contextAccounts = list;
  }

  const targetAcc: Account =
    account.accountType === 'virtual' && !account.parentAccountId && parentAccount
      ? { ...account, parentAccountId: parentAccount.id }
      : account;

  const relevantTxsWithDeltas: { tx: Transaction; delta: number }[] = [];

  transactions.forEach((tx) => {
    const delta = getTransactionEffectiveValueForAccount(tx, targetAcc, contextAccounts!);
    if (delta !== null) {
      relevantTxsWithDeltas.push({ tx, delta });
    }
  });

  relevantTxsWithDeltas.sort((a, b) => a.tx.valueDate.localeCompare(b.tx.valueDate));

  // Sortierte Stichtags-Salden
  const checkpoints: BalanceEntry[] = [...account.balanceEntries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  /**
   * Berechnet den Saldo zu einem beliebigen Stichtag (Tagesende).
   * Verwendet bei vorhandenen Checkpoints den zeitlich nächsten Stichtag als Anker
   * und summiert Transaktionsdeltas vorwärts (bei Stichtag nach Checkpoint)
   * bzw. zieht Transaktionsdeltas rückwärts ab (bei Stichtag vor erstem Checkpoint).
   */
  const getBalanceAtDate = (targetDate: string): number => {
    if (checkpoints.length === 0) {
      const sum = relevantTxsWithDeltas
        .filter((item) => item.tx.valueDate <= targetDate)
        .reduce((acc, item) => acc + item.delta, 0);
      return roundToTwoDecimals(sum);
    }

    const checkpointsBeforeOrOn = checkpoints.filter((c) => c.date <= targetDate);

    if (checkpointsBeforeOrOn.length > 0) {
      const anchor = checkpointsBeforeOrOn[checkpointsBeforeOrOn.length - 1];
      const sumAfterAnchor = relevantTxsWithDeltas
        .filter((item) => item.tx.valueDate > anchor.date && item.tx.valueDate <= targetDate)
        .reduce((acc, item) => acc + item.delta, 0);
      return roundToTwoDecimals(anchor.amount + sumAfterAnchor);
    }

    // Stichtag liegt VOR dem allerersten Checkpoint: Rückwärts-Rechnung
    const firstCheckpoint = checkpoints[0];
    const sumBetween = relevantTxsWithDeltas
      .filter((item) => item.tx.valueDate > targetDate && item.tx.valueDate <= firstCheckpoint.date)
      .reduce((acc, item) => acc + item.delta, 0);
    return roundToTwoDecimals(firstCheckpoint.amount - sumBetween);
  };

  // Für jede Periode Startsaldo, Cashflow und Endsaldo berechnen
  const periods: Record<string, AccountPeriodBalance> = {};

  periodKeys.forEach((pKey, index) => {
    const range = getPeriodDateRange(pKey, granularity);

    let startBalance: number;
    if (index === 0) {
      const dayBefore = getDayBefore(range.startDate);
      startBalance = getBalanceAtDate(dayBefore);
    } else {
      const prevKey = periodKeys[index - 1];
      startBalance = periods[prevKey].endBalance;
    }

    const periodCashflow = roundToTwoDecimals(
      relevantTxsWithDeltas
        .filter(
          (item) => item.tx.valueDate >= range.startDate && item.tx.valueDate <= range.endDate
        )
        .reduce((acc, item) => acc + item.delta, 0)
    );

    const checkpointsInPeriod = checkpoints.filter(
      (c) => c.date >= range.startDate && c.date <= range.endDate
    );

    let endBalance: number;
    if (checkpointsInPeriod.length > 0) {
      endBalance = getBalanceAtDate(range.endDate);
      const checkpointOnStart = checkpointsInPeriod.find((c) => c.date === range.startDate);
      if (checkpointOnStart && index === 0) {
        startBalance = checkpointOnStart.amount;
        endBalance = roundToTwoDecimals(startBalance + periodCashflow);
      }
    } else {
      endBalance = roundToTwoDecimals(startBalance + periodCashflow);
    }

    periods[pKey] = {
      startBalance,
      cashflow: periodCashflow,
      endBalance,
    };
  });

  const latestBalance = getBalanceAtDate('9999-12-31');

  return {
    account,
    periods,
    latestBalance,
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
    const allDates: ISODateString[] = transactions.map((tx) => tx.valueDate);
    accounts.forEach((acc) => {
      acc.balanceEntries.forEach((be) => {
        if (be.date) allDates.push(be.date as ISODateString);
      });
    });
    const rawPeriodKeys = Array.from(
      new Set(allDates.map((d) => getPeriodKey(d, granularity)))
    ).sort();
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
    calculateBalanceTimeline(account, transactions, periodKeys, granularity, parent, accounts)
  );

  // Gesamtsummenzeile: Summiert primär echte Konten, um Doppelzählungen zu verhindern.
  // Falls durch Kontofilterung nur ein virtuelles Unterkonto dargestellt wird, summiert sie dieses.
  const realRows = rows.filter((r) => r.account.accountType !== 'virtual');
  const rowsToSum = realRows.length > 0 ? realRows : rows;
  const totalRowPeriods: Record<string, AccountPeriodBalance> = {};
  let totalLatest = 0;

  periodKeys.forEach((pKey) => {
    let start = 0;
    let cf = 0;
    let end = 0;

    rowsToSum.forEach((r) => {
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

  rowsToSum.forEach((r) => {
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
