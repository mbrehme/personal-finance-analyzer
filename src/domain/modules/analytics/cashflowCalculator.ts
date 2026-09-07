/**
 * @file cashflowCalculator.ts
 * @description Analyse- und Aggregations-Engine für Cashflow-Matrizen über konfigurierbare
 * Zeitperioden (Monat, Quartal, Halbjahr, Jahr) mit hierarchischem Roll-Up und Soll-Ist-Vergleich.
 * @module domain/modules/analytics/cashflowCalculator
 */

import {
  Account,
  Category,
  PeriodGranularity,
  Transaction,
  isTransactionMatchingAccount,
  getTransactionEffectiveValueForAccount,
  isInternalTransfer,
} from '@/types/finance';
import {
  fillPeriodKeyRange,
  getCurrentPeriodKey,
  getPeriodKey,
  getPeriodKeysBetween,
  normalizeBudgetToGranularity,
} from '@/utils/dateUtils';
import { roundToTwoDecimals } from '@/utils/moneyUtils';

export interface CategoryPeriodCashflow {
  inbound: number;
  outbound: number;
  net: number;
  budget?: number;
  diffToBudget?: number;
}

export interface AccountCashflowRow {
  account: Account;
  parent?: Account;
  depth: number;
  hasChildren: boolean;
  periods: Record<string, CategoryPeriodCashflow>;
  totalInbound: number;
  totalOutbound: number;
  totalNet: number;
}

export interface AccountCashflowAnalysisResult {
  periodKeys: string[];
  rows: AccountCashflowRow[];
  totalRow: {
    periods: Record<string, CategoryPeriodCashflow>;
    totalInbound: number;
    totalOutbound: number;
    totalNet: number;
  };
}

export interface CategoryCashflowRow {
  category: Category;
  depth: number;
  hasChildren: boolean;
  periods: Record<string, CategoryPeriodCashflow>;
  totalInbound: number;
  totalOutbound: number;
  totalNet: number;
  totalBudget?: number;
  /** Effektives Soll-Budget (entweder manuell konfiguriert oder Rollup von Kinderelementen) */
  effectiveBudget?: number;
  /** Kennzeichnet, ob das Budget durch Summation von Kind-Budgets zustande kam */
  isBudgetRollup?: boolean;
}

export interface CashflowAnalysisResult {
  periodKeys: string[];
  rows: CategoryCashflowRow[];
  uncategorizedRow: {
    periods: Record<string, CategoryPeriodCashflow>;
    totalInbound: number;
    totalOutbound: number;
    totalNet: number;
  };
  totalRow: {
    periods: Record<string, CategoryPeriodCashflow>;
    totalInbound: number;
    totalOutbound: number;
    totalNet: number;
  };
}

/**
 * Ermittelt alle eindeutigen, chronologisch sortierten Periodenschlüssel aus Transaktionen.
 */
export function extractPeriodKeys(
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
 * Rekursive Berechnung der Kategorie-Hierarchie mit Summierung der Kinderelemente.
 */
export function calculateCashflowMatrix(
  categories: Category[],
  transactions: Transaction[],
  granularity: PeriodGranularity,
  selectedAccountId?: string,
  options?: {
    includeCurrentPeriod?: boolean;
    referenceDate?: Date | string | number;
    startDate?: string;
    endDate?: string;
    selectedCategoryIds?: string[];
    accounts?: Account[];
  }
): CashflowAnalysisResult {
  // 1. Transaktionen filtern (nach Konto, Datumsbereich und/oder Kategorien)
  let filteredTx = selectedAccountId
    ? transactions.filter((t) => {
        if (options?.accounts) {
          return isTransactionMatchingAccount(t, selectedAccountId, options.accounts, transactions);
        }
        return false;
      })
    : transactions;

  if (options?.startDate || options?.endDate) {
    filteredTx = filteredTx.filter((tx) => {
      const txDate = tx.date || '';
      if (options.startDate && txDate < options.startDate) return false;
      if (options.endDate && txDate > options.endDate) return false;
      return true;
    });
  }

  if (options?.selectedCategoryIds !== undefined) {
    const allowed = new Set(options.selectedCategoryIds);
    const allowUncategorized = allowed.has('__uncategorized__');

    filteredTx = filteredTx.filter((tx) => {
      const catId = tx.categoryId;
      if (!catId) {
        return allowUncategorized;
      }
      return allowed.has(catId);
    });
  }

  // 2. Periodenschlüssel ermitteln
  let periodKeys: string[] = [];

  if (options?.startDate && options?.endDate) {
    // Wenn ein expliziter Bereich gewählt wurde: Immer alle Perioden dieses Bereichs generieren!
    periodKeys = getPeriodKeysBetween(options.startDate, options.endDate, granularity);
  } else {
    // Sonst aus Transaktionen extrahieren und Lücken bis zum aktuellen Zeitraum schließen
    const rawPeriodKeys = extractPeriodKeys(filteredTx, granularity);
    const includeCurrent = options?.includeCurrentPeriod ?? false;
    const currentKey = includeCurrent
      ? getCurrentPeriodKey(granularity, options?.referenceDate)
      : undefined;

    if (rawPeriodKeys.length > 0) {
      periodKeys = includeCurrent
        ? fillPeriodKeyRange(rawPeriodKeys, granularity, currentKey)
        : rawPeriodKeys;
    } else if (currentKey) {
      periodKeys = [currentKey];
    }
  }

  // 3. Direkte Transaktions-Summen pro Kategorie und Periode berechnen
  const directSums = new Map<string, Record<string, { inbound: number; outbound: number }>>();

  categories.forEach((c) => {
    const periodMap: Record<string, { inbound: number; outbound: number }> = {};
    periodKeys.forEach((k) => {
      periodMap[k] = { inbound: 0, outbound: 0 };
    });
    directSums.set(c.id, periodMap);
  });

  // Uncategorized Category für Buchungen ohne Kategorie
  const uncategorizedCategoryId = '__uncategorized__';
  const uncatPeriodMap: Record<string, { inbound: number; outbound: number }> = {};
  periodKeys.forEach((k) => {
    uncatPeriodMap[k] = { inbound: 0, outbound: 0 };
  });
  directSums.set(uncategorizedCategoryId, uncatPeriodMap);

  const categoryIdsSet = new Set(categories.map((c) => c.id));

  const targetAccount =
    selectedAccountId && options?.accounts
      ? options.accounts.find((a) => a.id === selectedAccountId)
      : undefined;

  const getEffectiveValue = (tx: Transaction): number | null => {
    if (targetAccount && options?.accounts) {
      return getTransactionEffectiveValueForAccount(
        tx,
        targetAccount,
        options.accounts,
        filteredTx
      );
    }
    // In der Gesamtsicht ohne Kontofilter: Interne Umbuchungen zwischen eigenen Konten
    // heben sich gegenseitig auf und sind kein externes Haushaltseinkommen bzw. keine Ausgabe
    if (options?.accounts && isInternalTransfer(tx, options.accounts)) {
      return null;
    }
    return tx.value;
  };

  filteredTx.forEach((tx) => {
    const txDate = tx.date || '';
    const pKey = getPeriodKey(txDate, granularity);
    const rawCatId = tx.categoryId ?? null;
    const catId = rawCatId && categoryIdsSet.has(rawCatId) ? rawCatId : uncategorizedCategoryId;
    const catPeriods = directSums.get(catId);

    if (catPeriods && catPeriods[pKey]) {
      const val = getEffectiveValue(tx);
      if (val === null) return;
      if (val >= 0) {
        catPeriods[pKey].inbound += val;
      } else {
        catPeriods[pKey].outbound += val;
      }
    }
  });

  // 4. Baumstruktur aufbauen und Summen von Kindern zu Eltern hochrollen
  const childrenMap = new Map<string | null, Category[]>();
  categories.forEach((c) => {
    const list = childrenMap.get(c.parentId) || [];
    list.push(c);
    childrenMap.set(c.parentId, list);
  });

  // Nach 'order' sortieren
  childrenMap.forEach((list) => {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  const getSubtreeCategoryIds = (categoryId: string): string[] => {
    const ids = [categoryId];
    const children = childrenMap.get(categoryId) || [];
    children.forEach((c) => {
      ids.push(...getSubtreeCategoryIds(c.id));
    });
    return ids;
  };

  const rows: CategoryCashflowRow[] = [];

  const allowedCategories =
    options?.selectedCategoryIds !== undefined ? new Set(options.selectedCategoryIds) : null;

  /**
   * Rekursive Berechnung des effektiven Budgets:
   * 1. Hat die Kategorie Kinder -> Reines Rollup der AUSGEWÄHLTEN Kinder (Elternkategorien dürfen keine eigenen Werte haben).
   * 2. Ist es eine Blatt-Kategorie (keine Kinder) -> eigenes targetBudget verwenden, sofern ausgewählt.
   * 3. Ansonsten undefined.
   */
  const getEffectiveCategoryBudget = (
    cId: string
  ): { amount: number; isRollup: boolean } | undefined => {
    const c = categories.find((item) => item.id === cId);
    if (!c) return undefined;

    const children = childrenMap.get(cId) || [];
    const hasChildren = children.length > 0;

    // Wenn die Kategorie Kinder hat, darf sie keine eigenen Werte haben -> reines Rollup der Kinder
    if (hasChildren) {
      let sum = 0;
      let hasAnyChildBudget = false;

      children.forEach((child) => {
        // Kind nur berücksichtigen, wenn es (oder eines seiner Sub-Kinder) im Filter ausgewählt ist
        const childSubtree = getSubtreeCategoryIds(child.id);
        const childIsActive =
          !allowedCategories || childSubtree.some((id) => allowedCategories.has(id));

        if (childIsActive) {
          const childRes = getEffectiveCategoryBudget(child.id);
          if (childRes !== undefined) {
            sum += childRes.amount;
            hasAnyChildBudget = true;
          }
        }
      });

      if (hasAnyChildBudget) {
        return {
          amount: sum,
          isRollup: true,
        };
      }
      return undefined;
    }

    // Blatt-Kategorie (ohne Kinder): nur dann ein Budget, wenn sie im Filter ausgewählt ist
    const isAllowed = !allowedCategories || allowedCategories.has(c.id);
    if (!isAllowed) {
      return undefined;
    }

    if (c.targetBudget) {
      return {
        amount: normalizeBudgetToGranularity(
          c.targetBudget.amount,
          c.targetBudget.period,
          granularity
        ),
        isRollup: false,
      };
    }

    return undefined;
  };

  const processCategory = (category: Category, depth: number) => {
    const subtreeIds = getSubtreeCategoryIds(category.id);
    const isIncluded = !allowedCategories || subtreeIds.some((id) => allowedCategories.has(id));

    if (!isIncluded) {
      return;
    }

    const hasChildren = (childrenMap.get(category.id) || []).length > 0;

    const periods: Record<string, CategoryPeriodCashflow> = {};
    let totalInbound = 0;
    let totalOutbound = 0;

    // Effektives Budget (eigenes manuelles Budget oder Rollup aus Kind-Elementen)
    const effectiveBudgetInfo = getEffectiveCategoryBudget(category.id);
    const budgetAmount = effectiveBudgetInfo?.amount;
    const isBudgetRollup = effectiveBudgetInfo?.isRollup ?? false;

    // Bei Rollups in der Matrix nur die aktuell ausgewählten Subtree-Kategorien summieren
    const effectiveSubtreeIds = allowedCategories
      ? subtreeIds.filter((id) => allowedCategories.has(id))
      : subtreeIds;

    periodKeys.forEach((pKey) => {
      let inbound = 0;
      let outbound = 0;

      effectiveSubtreeIds.forEach((id) => {
        const pData = directSums.get(id)?.[pKey];
        if (pData) {
          inbound += pData.inbound;
          outbound += pData.outbound;
        }
      });

      const net = inbound + outbound;
      totalInbound += inbound;
      totalOutbound += outbound;

      const actualAmount = Math.abs(net);
      const diffToBudget = budgetAmount !== undefined ? actualAmount - budgetAmount : undefined;

      periods[pKey] = {
        inbound,
        outbound,
        net,
        budget: budgetAmount,
        diffToBudget,
      };
    });

    const totalNet = totalInbound + totalOutbound;
    const totalBudget = budgetAmount !== undefined ? budgetAmount * periodKeys.length : undefined;

    rows.push({
      category,
      depth,
      hasChildren,
      periods,
      totalInbound,
      totalOutbound,
      totalNet,
      totalBudget,
      effectiveBudget: budgetAmount,
      isBudgetRollup,
    });

    // Kinder verarbeiten
    const children = childrenMap.get(category.id) || [];
    children.forEach((child) => processCategory(child, depth + 1));
  };

  // Top-Level Kategorien (parentId === null) verarbeiten
  const rootCategories = childrenMap.get(null) || [];
  rootCategories.forEach((root) => processCategory(root, 0));

  // Gesamtsummenzeile (Total Row) berechnen
  const totalRowPeriods: Record<string, CategoryPeriodCashflow> = {};
  let grandInbound = 0;
  let grandOutbound = 0;

  periodKeys.forEach((pKey) => {
    let inbound = 0;
    let outbound = 0;

    filteredTx.forEach((tx) => {
      const txDate = tx.date || '';
      if (getPeriodKey(txDate, granularity) === pKey) {
        const val = getEffectiveValue(tx);
        if (val === null) return;
        if (val >= 0) {
          inbound += val;
        } else {
          outbound += val;
        }
      }
    });

    grandInbound += inbound;
    grandOutbound += outbound;

    totalRowPeriods[pKey] = {
      inbound,
      outbound,
      net: inbound + outbound,
    };
  });

  // Unkategorisierte Zeile berechnen
  const uncatRowPeriods: Record<string, CategoryPeriodCashflow> = {};
  let uncatTotalInbound = 0;
  let uncatTotalOutbound = 0;

  periodKeys.forEach((pKey) => {
    const pData = directSums.get(uncategorizedCategoryId)?.[pKey] || { inbound: 0, outbound: 0 };
    const net = pData.inbound + pData.outbound;
    uncatTotalInbound += pData.inbound;
    uncatTotalOutbound += pData.outbound;

    uncatRowPeriods[pKey] = {
      inbound: pData.inbound,
      outbound: pData.outbound,
      net,
    };
  });

  return {
    periodKeys,
    rows,
    uncategorizedRow: {
      periods: uncatRowPeriods,
      totalInbound: uncatTotalInbound,
      totalOutbound: uncatTotalOutbound,
      totalNet: uncatTotalInbound + uncatTotalOutbound,
    },
    totalRow: {
      periods: totalRowPeriods,
      totalInbound: grandInbound,
      totalOutbound: grandOutbound,
      totalNet: grandInbound + grandOutbound,
    },
  };
}

/**
 * Berechnet die Cashflow-Matrix aufgeschlüsselt nach Konten (echte Bankkonten und deren virtuelle Unterkonten).
 *
 * @param {Account[]} accounts - Alle konfigurierten Konten
 * @param {Transaction[]} transactions - Alle Transaktionen
 * @param {PeriodGranularity} granularity - Zeit-Granularität (monthly, quarterly, halfYearly, yearly)
 * @param {string} [selectedAccountId] - Optionale Filterung auf ein bestimmtes Konto
 * @param {object} [options] - Filteroptionen (Datumsbereich, Kategorien, etc.)
 * @returns {AccountCashflowAnalysisResult} Ergebnis mit hierarchischen Kontenzeilen und Gesamtsumme
 *
 * @example
 * const result = calculateAccountCashflowMatrix(accounts, transactions, 'monthly');
 * console.log(result.rows[0].account.name, result.rows[0].totalNet);
 */
export function calculateAccountCashflowMatrix(
  accounts: Account[],
  transactions: Transaction[],
  granularity: PeriodGranularity,
  selectedAccountId?: string,
  options?: {
    includeCurrentPeriod?: boolean;
    referenceDate?: Date | string | number;
    startDate?: string;
    endDate?: string;
    selectedCategoryIds?: string[];
  }
): AccountCashflowAnalysisResult {
  // 1. Transaktionen filtern (nach Konto, Datumsbereich und/oder Kategorien)
  let filteredTx = transactions;

  if (selectedAccountId) {
    filteredTx = filteredTx.filter((t) =>
      isTransactionMatchingAccount(t, selectedAccountId, accounts)
    );
  }

  if (options?.startDate || options?.endDate) {
    filteredTx = filteredTx.filter((tx) => {
      const txDate = tx.date || '';
      if (options.startDate && txDate < options.startDate) return false;
      if (options.endDate && txDate > options.endDate) return false;
      return true;
    });
  }

  if (options?.selectedCategoryIds !== undefined) {
    const allowed = new Set(options.selectedCategoryIds);
    const allowUncategorized = allowed.has('__uncategorized__');

    filteredTx = filteredTx.filter((tx) => {
      const catId = tx.categoryId;
      if (!catId) {
        return allowUncategorized;
      }
      return allowed.has(catId);
    });
  }

  // 2. Periodenschlüssel ermitteln
  let periodKeys: string[] = [];

  if (options?.startDate && options?.endDate) {
    periodKeys = getPeriodKeysBetween(options.startDate, options.endDate, granularity);
  } else {
    const rawPeriodKeys = extractPeriodKeys(filteredTx, granularity);
    const includeCurrent = options?.includeCurrentPeriod ?? false;
    const currentKey = includeCurrent
      ? getCurrentPeriodKey(granularity, options?.referenceDate)
      : undefined;

    if (rawPeriodKeys.length > 0) {
      periodKeys = includeCurrent
        ? fillPeriodKeyRange(rawPeriodKeys, granularity, currentKey)
        : rawPeriodKeys;
    } else if (currentKey) {
      periodKeys = [currentKey];
    }
  }

  // 3. Konten-Hierarchie aufbauen: Echte Konten mit ihren virtuellen Unterkonten
  const accountsToProcess = selectedAccountId
    ? accounts.filter((a) => a.id === selectedAccountId || a.parentAccountId === selectedAccountId)
    : accounts;

  const realAccounts = accountsToProcess
    .filter((a) => a.accountType !== 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const virtualAccounts = accountsToProcess
    .filter((a) => a.accountType === 'virtual')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const rows: AccountCashflowRow[] = [];
  const assignedVirtualIds = new Set<string>();

  realAccounts.forEach((realAcc) => {
    const subs = virtualAccounts.filter((va) => va.parentAccountId === realAcc.id);
    const realRow: AccountCashflowRow = {
      account: realAcc,
      depth: 0,
      hasChildren: subs.length > 0,
      periods: {},
      totalInbound: 0,
      totalOutbound: 0,
      totalNet: 0,
    };
    periodKeys.forEach((k) => {
      realRow.periods[k] = { inbound: 0, outbound: 0, net: 0 };
    });
    rows.push(realRow);

    subs.forEach((sub) => {
      assignedVirtualIds.add(sub.id);
      const subRow: AccountCashflowRow = {
        account: sub,
        parent: realAcc,
        depth: 1,
        hasChildren: false,
        periods: {},
        totalInbound: 0,
        totalOutbound: 0,
        totalNet: 0,
      };
      periodKeys.forEach((k) => {
        subRow.periods[k] = { inbound: 0, outbound: 0, net: 0 };
      });
      rows.push(subRow);
    });
  });

  // Verwaiste virtuelle Konten anhängen
  virtualAccounts
    .filter((va) => !assignedVirtualIds.has(va.id))
    .forEach((sub) => {
      const subRow: AccountCashflowRow = {
        account: sub,
        depth: 0,
        hasChildren: false,
        periods: {},
        totalInbound: 0,
        totalOutbound: 0,
        totalNet: 0,
      };
      periodKeys.forEach((k) => {
        subRow.periods[k] = { inbound: 0, outbound: 0, net: 0 };
      });
      rows.push(subRow);
    });

  // 4. Cashflow für jede Zeile berechnen
  rows.forEach((row) => {
    filteredTx.forEach((tx) => {
      const txDate = tx.date || '';
      const pKey = getPeriodKey(txDate, granularity);
      const p = row.periods[pKey];
      if (!p) return;

      // Auswertung des effektiven Betrags (berücksichtigt Buchungskonto, Gegenkonto bei Umbuchungen und Unterkonten)
      const eff = getTransactionEffectiveValueForAccount(tx, row.account, accounts, transactions);
      if (eff !== null) {
        if (eff >= 0) {
          p.inbound += eff;
          row.totalInbound += eff;
        } else {
          p.outbound += eff;
          row.totalOutbound += eff;
        }
      }
    });

    // Runden für jede Periode der Zeile
    periodKeys.forEach((k) => {
      const p = row.periods[k];
      p.inbound = roundToTwoDecimals(p.inbound);
      p.outbound = roundToTwoDecimals(p.outbound);
      p.net = roundToTwoDecimals(p.inbound + p.outbound);
    });

    row.totalInbound = roundToTwoDecimals(row.totalInbound);
    row.totalOutbound = roundToTwoDecimals(row.totalOutbound);
    row.totalNet = roundToTwoDecimals(row.totalInbound + row.totalOutbound);
  });

  // 5. Gesamtergebnis-Zeile (nur echte Bankkonten summieren zur Vermeidung von Doppelzählungen)
  const totalRowPeriods: Record<string, CategoryPeriodCashflow> = {};
  let grandInbound = 0;
  let grandOutbound = 0;

  const realRows = rows.filter((r) => r.account.accountType !== 'virtual');
  const rowsToSumForTotal = realRows.length > 0 ? realRows : rows;

  periodKeys.forEach((pKey) => {
    const periodInbound = roundToTwoDecimals(
      rowsToSumForTotal.reduce((sum, r) => sum + (r.periods[pKey]?.inbound || 0), 0)
    );
    const periodOutbound = roundToTwoDecimals(
      rowsToSumForTotal.reduce((sum, r) => sum + (r.periods[pKey]?.outbound || 0), 0)
    );

    grandInbound += periodInbound;
    grandOutbound += periodOutbound;

    totalRowPeriods[pKey] = {
      inbound: periodInbound,
      outbound: periodOutbound,
      net: roundToTwoDecimals(periodInbound + periodOutbound),
    };
  });

  grandInbound = roundToTwoDecimals(grandInbound);
  grandOutbound = roundToTwoDecimals(grandOutbound);

  return {
    periodKeys,
    rows,
    totalRow: {
      periods: totalRowPeriods,
      totalInbound: grandInbound,
      totalOutbound: grandOutbound,
      totalNet: roundToTwoDecimals(grandInbound + grandOutbound),
    },
  };
}

/**
 * Konvertiert ein AccountCashflowAnalysisResult in das CashflowAnalysisResult-Format,
 * damit Diagramme (wie StackedCategoryBarChart) die Konten direkt visualisieren können.
 *
 * @param {AccountCashflowAnalysisResult} accountResult - Das Konten-Cashflow-Ergebnis
 * @returns {CashflowAnalysisResult} Konvertiertes Ergebnis mit Konten als Zeilen
 */
export function convertAccountResultToCashflowResult(
  accountResult: AccountCashflowAnalysisResult
): CashflowAnalysisResult {
  const rows: CategoryCashflowRow[] = accountResult.rows.map((ar) => ({
    category: {
      id: ar.account.id,
      name: ar.account.name,
      color: ar.account.color || '#3b82f6',
      icon: ar.account.icon || 'Landmark',
      parentId: ar.parent?.id ?? null,
    },
    depth: ar.depth,
    hasChildren: ar.hasChildren,
    periods: ar.periods,
    totalInbound: ar.totalInbound,
    totalOutbound: ar.totalOutbound,
    totalNet: ar.totalNet,
  }));

  return {
    periodKeys: accountResult.periodKeys,
    rows,
    uncategorizedRow: {
      periods: {},
      totalInbound: 0,
      totalOutbound: 0,
      totalNet: 0,
    },
    totalRow: accountResult.totalRow,
  };
}
