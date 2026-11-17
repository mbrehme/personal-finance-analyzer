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
  getActiveCategoryBudgetForDate,
} from '@/types';
import { createAccountFlowResolver } from '@/domain/modules/accounts/accountService';
import {
  buildAccountHierarchy,
  extractPeriodKeysFromTransactions,
  filterAnalyticsTransactions,
  resolveCashflowPeriodKeys,
} from './analyticsHelpers';
import {
  getCurrentPeriodKey,
  getPeriodDateRange,
  getPeriodKey,
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
export const extractPeriodKeys = extractPeriodKeysFromTransactions;

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
  const flowResolver = createAccountFlowResolver(options?.accounts || [], transactions);

  // 1. Transaktionen filtern (nach Konto, Datumsbereich und/oder Kategorien)
  const filteredTx = filterAnalyticsTransactions(transactions, flowResolver, {
    selectedAccountId,
    hasAccounts: Boolean(options?.accounts),
    startDate: options?.startDate,
    endDate: options?.endDate,
    selectedCategoryIds: options?.selectedCategoryIds,
  });

  // 2. Periodenschlüssel ermitteln
  const periodKeys = resolveCashflowPeriodKeys(filteredTx, granularity, {
    startDate: options?.startDate,
    endDate: options?.endDate,
    includeCurrentPeriod: options?.includeCurrentPeriod,
    referenceDate: options?.referenceDate,
  });

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
      return flowResolver.getEffectiveValue(tx, targetAccount);
    }
    // In der Gesamtsicht ohne Kontofilter: Interne Umbuchungen zwischen eigenen Konten
    // heben sich gegenseitig auf und sind kein externes Haushaltseinkommen bzw. keine Ausgabe
    if (options?.accounts && flowResolver.isInternalTransfer(tx)) {
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
   * Rekursive Berechnung des effektiven Budgets für einen bestimmten Zeitraum / Stichtag:
   * 1. Hat die Kategorie Kinder -> Reines Rollup der AUSGEWÄHLTEN Kinder für diesen Zeitraum.
   * 2. Ist es eine Blatt-Kategorie (keine Kinder) -> aktives Budget zum Stichtag verwenden, sofern ausgewählt.
   * 3. Ansonsten undefined.
   */
  const getEffectiveCategoryBudget = (
    cId: string,
    targetDate: string
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
          const childRes = getEffectiveCategoryBudget(child.id, targetDate);
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

    const activeBudget = getActiveCategoryBudgetForDate(c, targetDate);
    if (activeBudget) {
      return {
        amount: normalizeBudgetToGranularity(activeBudget.amount, activeBudget.period, granularity),
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

    // Referenzdatum für das Zeilen-Budget: späteste Periode oder heute
    const referencePeriodKey =
      periodKeys.length > 0 ? periodKeys[periodKeys.length - 1] : getCurrentPeriodKey(granularity);
    const referenceEndDate = getPeriodDateRange(referencePeriodKey, granularity).endDate;

    // Effektives Budget der Zeile (zum Referenz-Zeitraum)
    const effectiveBudgetInfo = getEffectiveCategoryBudget(category.id, referenceEndDate);
    const budgetAmount = effectiveBudgetInfo?.amount;
    const isBudgetRollup = effectiveBudgetInfo?.isRollup ?? false;

    // Bei Rollups in der Matrix nur die aktuell ausgewählten Subtree-Kategorien summieren
    const effectiveSubtreeIds = allowedCategories
      ? subtreeIds.filter((id) => allowedCategories.has(id))
      : subtreeIds;

    let sumBudget = 0;
    let hasAnyPeriodBudget = false;

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

      const pEndDate = getPeriodDateRange(pKey, granularity).endDate;
      const periodBudgetInfo = getEffectiveCategoryBudget(category.id, pEndDate);
      const periodBudgetAmount = periodBudgetInfo?.amount;

      if (periodBudgetAmount !== undefined) {
        sumBudget += periodBudgetAmount;
        hasAnyPeriodBudget = true;
      }

      const actualAmount = Math.abs(net);
      const diffToBudget =
        periodBudgetAmount !== undefined ? actualAmount - periodBudgetAmount : undefined;

      periods[pKey] = {
        inbound,
        outbound,
        net,
        budget: periodBudgetAmount,
        diffToBudget,
      };
    });

    const totalNet = totalInbound + totalOutbound;
    const totalBudget = hasAnyPeriodBudget ? roundToTwoDecimals(sumBudget) : undefined;

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
  const flowResolver = createAccountFlowResolver(accounts, transactions);

  // 1. Transaktionen filtern (nach Konto, Datumsbereich und/oder Kategorien)
  const filteredTx = filterAnalyticsTransactions(transactions, flowResolver, {
    selectedAccountId,
    hasAccounts: true,
    startDate: options?.startDate,
    endDate: options?.endDate,
    selectedCategoryIds: options?.selectedCategoryIds,
  });

  // 2. Periodenschlüssel ermitteln
  const periodKeys = resolveCashflowPeriodKeys(filteredTx, granularity, {
    startDate: options?.startDate,
    endDate: options?.endDate,
    includeCurrentPeriod: options?.includeCurrentPeriod,
    referenceDate: options?.referenceDate,
  });

  // 3. Konten-Hierarchie aufbauen: Echte Konten mit ihren virtuellen Unterkonten
  const hierarchyNodes = buildAccountHierarchy(accounts, selectedAccountId);
  const rows: AccountCashflowRow[] = hierarchyNodes.map((node) => {
    const periods: Record<string, { inbound: number; outbound: number; net: number }> = {};
    periodKeys.forEach((k) => {
      periods[k] = { inbound: 0, outbound: 0, net: 0 };
    });
    return {
      account: node.account,
      ...(node.depth === 1 && node.parent ? { parent: node.parent } : {}),
      depth: node.depth,
      hasChildren: node.hasChildren,
      periods,
      totalInbound: 0,
      totalOutbound: 0,
      totalNet: 0,
    };
  });

  // 4. Cashflow für jede Zeile berechnen
  rows.forEach((row) => {
    filteredTx.forEach((tx) => {
      const txDate = tx.date || '';
      const pKey = getPeriodKey(txDate, granularity);
      const p = row.periods[pKey];
      if (!p) return;

      // Auswertung des effektiven Betrags (berücksichtigt Buchungskonto, Gegenkonto bei Umbuchungen und Unterkonten)
      const eff = flowResolver.getEffectiveValue(tx, row.account);
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
