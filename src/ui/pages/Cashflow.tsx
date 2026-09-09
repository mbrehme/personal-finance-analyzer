/**
 * @file Cashflow.tsx
 * @description Cashflow-Matrix-Ansicht mit umschaltbarer Granularität (Monat, Quartal,
 * Halbjahr, Jahr), hierarchischem Roll-Up von Kindersummen und Soll-Ist-Abgleich.
 * @module pages/Cashflow
 */

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  useFinance,
  calculateCashflowMatrix,
  calculateAccountCashflowMatrix,
  convertAccountResultToCashflowResult,
  CategoryCashflowRow,
  AccountCashflowRow,
} from '@/domain';
import { StackedCategoryBarChart } from '@/ui/components/analytics/StackedCategoryBarChart';
import { IconRenderer } from '@/ui/components/IconRenderer';
import {
  getCurrentPeriodKey,
  getYearFromPeriodKey,
  formatPeriodLabel,
  formatSubPeriodLabel,
  normalizeBudgetToGranularity,
  getPeriodDateRange,
} from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { buildTransactionsUrl, useSafeNavigate } from '@/ui/pages/Transactions';
import {
  useAnalyticsFilter,
  ANALYTICS_ACCOUNT_KEY as CASHFLOW_ACCOUNT_FILTER_KEY,
  ANALYTICS_GRANULARITY_KEY as CASHFLOW_GRANULARITY_KEY,
  ANALYTICS_START_DATE_KEY as CASHFLOW_START_DATE_KEY,
  ANALYTICS_END_DATE_KEY as CASHFLOW_END_DATE_KEY,
  ANALYTICS_CATEGORIES_KEY as CASHFLOW_CATEGORIES_KEY,
} from '@/ui/pages/analytics';
import {
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  FolderTree,
  Landmark,
} from 'lucide-react';

export const CASHFLOW_VIEW_MODE_KEY = 'cashflow_view_mode';
export type CashflowViewMode = 'categories' | 'accounts';

export {
  CASHFLOW_ACCOUNT_FILTER_KEY,
  CASHFLOW_GRANULARITY_KEY,
  CASHFLOW_START_DATE_KEY,
  CASHFLOW_END_DATE_KEY,
  CASHFLOW_CATEGORIES_KEY,
};

/**
 * Anzuzeigende Spalte in der Cashflow-Tabelle:
 * Entweder eine atomare Periode (z. B. Monat) oder ein zusammengeklapptes Jahr.
 */
export interface CashflowDisplayColumn {
  id: string;
  type: 'period' | 'collapsed_year';
  year: string;
  label: string;
  isCurrent: boolean;
  isLastInYear: boolean;
  periodKeys: string[];
}

interface YearGroup {
  year: string;
  periodKeys: string[];
  isCollapsed: boolean;
  colSpan: number;
}

export const Cashflow: React.FC = () => {
  const { categories, transactions, accounts } = useFinance();
  const { granularity, selectedAccountId, startDate, endDate, selectedCategoryIds } =
    useAnalyticsFilter();
  const navigate = useSafeNavigate();

  const [viewMode, setViewModeState] = useState<CashflowViewMode>(() => {
    const saved = localStorage.getItem(CASHFLOW_VIEW_MODE_KEY);
    return saved === 'accounts' ? 'accounts' : 'categories';
  });

  const setViewMode = (mode: CashflowViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(CASHFLOW_VIEW_MODE_KEY, mode);
  };

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const currentPeriodHeaderRef = useRef<HTMLTableCellElement>(null);

  const toggleCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleAccountCollapse = (accountId: string) => {
    setCollapsedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const isCurrentPeriodInRange = useMemo(() => {
    const todayIso = new Date().toISOString().substring(0, 10);
    if (startDate && todayIso < startDate) return false;
    if (endDate && todayIso > endDate) return false;
    return true;
  }, [startDate, endDate]);

  const categoryMatrix = useMemo(() => {
    return calculateCashflowMatrix(
      categories,
      transactions,
      granularity,
      selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : undefined,
      {
        includeCurrentPeriod: isCurrentPeriodInRange,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        selectedCategoryIds: selectedCategoryIds || undefined,
        accounts,
      }
    );
  }, [
    categories,
    transactions,
    granularity,
    selectedAccountId,
    isCurrentPeriodInRange,
    startDate,
    endDate,
    selectedCategoryIds,
    accounts,
  ]);

  const accountMatrix = useMemo(() => {
    return calculateAccountCashflowMatrix(
      accounts,
      transactions,
      granularity,
      selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : undefined,
      {
        includeCurrentPeriod: isCurrentPeriodInRange,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        selectedCategoryIds: selectedCategoryIds || undefined,
      }
    );
  }, [
    accounts,
    transactions,
    granularity,
    selectedAccountId,
    isCurrentPeriodInRange,
    startDate,
    endDate,
    selectedCategoryIds,
  ]);

  const activePeriodKeys = useMemo(() => {
    return viewMode === 'categories' ? categoryMatrix.periodKeys : accountMatrix.periodKeys;
  }, [viewMode, categoryMatrix.periodKeys, accountMatrix.periodKeys]);

  const activeTotalRow = useMemo(() => {
    return viewMode === 'categories' ? categoryMatrix.totalRow : accountMatrix.totalRow;
  }, [viewMode, categoryMatrix.totalRow, accountMatrix.totalRow]);

  const chartResult = useMemo(() => {
    if (viewMode === 'categories') {
      return categoryMatrix;
    }
    return convertAccountResultToCashflowResult(accountMatrix);
  }, [viewMode, categoryMatrix, accountMatrix]);

  const currentPeriodKey = useMemo(() => getCurrentPeriodKey(granularity), [granularity]);
  const currentYear = useMemo(() => getYearFromPeriodKey(currentPeriodKey), [currentPeriodKey]);

  // Status für eingeklappte Jahre (vergangene Jahre vor aktuellem Jahr standardmäßig eingeklappt)
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    activePeriodKeys.forEach((pKey) => {
      const y = getYearFromPeriodKey(pKey);
      if (y < currentYear) {
        initial.add(y);
      }
    });
    return initial;
  });

  // Automatisch vergangene Jahre einklappen, wenn neue Daten geladen werden
  useEffect(() => {
    setCollapsedYears((prev) => {
      let changed = false;
      const next = new Set(prev);
      activePeriodKeys.forEach((pKey) => {
        const y = getYearFromPeriodKey(pKey);
        if (y < currentYear && !prev.has(y)) {
          next.add(y);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activePeriodKeys, currentYear]);

  const toggleYearCollapse = (year: string) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Gruppierung nach Kalenderjahren
  const yearGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    activePeriodKeys.forEach((pKey) => {
      const y = getYearFromPeriodKey(pKey);
      const list = map.get(y) || [];
      list.push(pKey);
      map.set(y, list);
    });

    const groups: YearGroup[] = [];
    map.forEach((keys, year) => {
      const isCollapsed = granularity !== 'yearly' && collapsedYears.has(year);
      groups.push({
        year,
        periodKeys: keys,
        isCollapsed,
        colSpan: isCollapsed ? 1 : keys.length,
      });
    });
    return groups;
  }, [activePeriodKeys, collapsedYears, granularity]);

  // Aufgelöste Liste aller anzuzeigenden Spalten (Einzelperioden oder komprimierte Jahresspalten)
  const displayColumns = useMemo(() => {
    const cols: CashflowDisplayColumn[] = [];
    yearGroups.forEach((group) => {
      if (group.isCollapsed) {
        cols.push({
          id: `year-${group.year}-collapsed`,
          type: 'collapsed_year',
          year: group.year,
          label: 'Jahressumme',
          isCurrent: false,
          isLastInYear: true,
          periodKeys: group.periodKeys,
        });
      } else {
        group.periodKeys.forEach((pKey, idx) => {
          cols.push({
            id: pKey,
            type: 'period',
            year: group.year,
            label: formatSubPeriodLabel(pKey, granularity),
            isCurrent: pKey === currentPeriodKey,
            isLastInYear: idx === group.periodKeys.length - 1,
            periodKeys: [pKey],
          });
        });
      }
    });
    return cols;
  }, [yearGroups, granularity, currentPeriodKey]);

  // Automatisches und manuelles Scrollen zum aktuellen Zeitraum (ohne Animation für ruhiges Laden)
  const scrollToCurrentPeriod = useCallback(() => {
    if (!tableContainerRef.current) return;

    const container = tableContainerRef.current;
    const targetEl = currentPeriodHeaderRef.current;

    if (targetEl) {
      const targetLeft = targetEl.offsetLeft;
      const targetWidth = targetEl.offsetWidth;
      const containerWidth = container.clientWidth;
      const scrollLeft = Math.max(0, targetLeft - containerWidth / 2 + targetWidth / 2);

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left: scrollLeft, behavior: 'auto' });
      } else {
        container.scrollLeft = scrollLeft;
      }
      return;
    }

    // Fallback: Wenn heutiger Zeitraum jünger als alle Daten ist, zum neuesten Zeitraum scrollen
    if (
      activePeriodKeys.length > 0 &&
      currentPeriodKey > activePeriodKeys[activePeriodKeys.length - 1]
    ) {
      const scrollLeft = container.scrollWidth;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left: scrollLeft, behavior: 'auto' });
      } else {
        container.scrollLeft = scrollLeft;
      }
    }
  }, [currentPeriodKey, activePeriodKeys]);

  useLayoutEffect(() => {
    scrollToCurrentPeriod();
  }, [scrollToCurrentPeriod]);

  // Rekursives Rendern der Zeilen unter Beachtung des Collapse-States für Kategorien
  const renderCategoryRows = (): React.ReactNode => {
    // Map der Kinder
    const childrenMap = new Map<string | null, CategoryCashflowRow[]>();
    categoryMatrix.rows.forEach((r) => {
      const pId = r.category.parentId;
      const list = childrenMap.get(pId) || [];
      list.push(r);
      childrenMap.set(pId, list);
    });

    const renderTreeRow = (row: CategoryCashflowRow): React.ReactNode => {
      const isCollapsed = collapsedCategories.has(row.category.id);
      const children = childrenMap.get(row.category.id) || [];
      const targetBudget =
        row.effectiveBudget ??
        row.periods[categoryMatrix.periodKeys[0]]?.budget ??
        (row.category.targetBudget
          ? normalizeBudgetToGranularity(
              row.category.targetBudget.amount,
              row.category.targetBudget.period,
              granularity
            )
          : undefined);

      const periodCount = categoryMatrix.periodKeys.length;
      const avgNet = periodCount > 0 ? row.totalNet / periodCount : 0;
      const avgDiff =
        targetBudget !== undefined && avgNet !== 0 ? Math.abs(avgNet) - targetBudget : undefined;

      return (
        <React.Fragment key={row.category.id}>
          <tr className="group text-xs transition-colors hover:bg-slate-50">
            {/* Kategorie Name & Hierarchie (deutlich abgesetzte sticky Spalte) */}
            <td className="sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap border-b border-r-2 border-b-slate-200 border-r-slate-300 bg-slate-100 px-4 py-2.5 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
              <div
                className="flex items-center gap-2 truncate"
                style={{ paddingLeft: `${row.depth * 20}px` }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(row.category.id)}
                    className="flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    aria-label={
                      isCollapsed ? 'Unterkategorien aufklappen' : 'Unterkategorien einklappen'
                    }
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}

                {/* Kategorie-Icon mit Hintergrundfarbe */}
                <div
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${row.category.color || '#3b82f6'}20`,
                    color: row.category.color || '#3b82f6',
                  }}
                >
                  <IconRenderer name={row.category.icon} className="h-3.5 w-3.5" />
                </div>

                <div className="flex min-w-0 flex-col truncate">
                  <span
                    className={`truncate ${row.depth === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}
                    title={row.category.name}
                  >
                    {row.category.name}
                  </span>
                  {/* Soll-Budget Kennzeichnung */}
                  {targetBudget !== undefined && (
                    <span className="text-[10px] text-slate-500">
                      Soll: {formatMoney(targetBudget)}
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* Perioden Spalten (einzeln oder komprimiert) */}
            {displayColumns.map((col, cIdx) => {
              let net = 0;
              let budget = 0;
              let diffToBudget: number | undefined = undefined;

              if (col.type === 'period') {
                const p = row.periods[col.id];
                if (p) {
                  net = p.net;
                  budget = p.budget || 0;
                  diffToBudget = p.diffToBudget;
                }
              } else {
                col.periodKeys.forEach((k) => {
                  const p = row.periods[k];
                  if (p) {
                    net += p.net;
                    if (p.budget !== undefined) budget += p.budget;
                  }
                });
                if (budget > 0) {
                  diffToBudget = Math.abs(net) - budget;
                }
              }
              const isLastCol = cIdx === displayColumns.length - 1;
              const borderRight = isLastCol
                ? ''
                : col.isLastInYear
                  ? 'border-r-2 border-slate-300'
                  : 'border-r border-slate-100';
              const bgHighlight = col.isCurrent
                ? 'bg-blue-50/50 border-x-2 border-blue-200/80 font-semibold'
                : col.type === 'collapsed_year'
                  ? 'bg-slate-50 font-medium'
                  : '';

              const cellDateRange =
                col.type === 'period'
                  ? getPeriodDateRange(col.id, granularity)
                  : { startDate: `${col.year}-01-01`, endDate: `${col.year}-12-31` };
              const cellUrl = buildTransactionsUrl({
                categoryIds: [row.category.id],
                startDate: cellDateRange.startDate,
                endDate: cellDateRange.endDate,
                accountId:
                  selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : undefined,
              });

              const periodDesc =
                col.type === 'period'
                  ? `im Zeitraum ${formatPeriodLabel(col.id, granularity)}`
                  : `im Jahr ${col.year}`;

              return (
                <td
                  key={col.id}
                  className={`cursor-pointer whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right font-mono transition-colors hover:bg-blue-100/60 focus:bg-blue-100/60 focus:outline-none ${borderRight} ${bgHighlight}`}
                  tabIndex={0}
                  title={`Buchungen für "${row.category.name}" ${periodDesc} anzeigen`}
                  onClick={() => navigate(cellUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(cellUrl);
                    }
                  }}
                >
                  {net !== 0 ? (
                    <div>
                      <span
                        className={`font-bold ${net < 0 ? 'text-slate-900' : 'text-emerald-600'}`}
                      >
                        {formatMoney(net)}
                      </span>

                      {/* Budget Abweichung (Über- oder Unterschreitung) */}
                      {diffToBudget !== undefined && Math.abs(diffToBudget) >= 0.01 && (
                        <div
                          className={`font-mono text-[10px] font-semibold ${
                            (net >= 0 ? diffToBudget > 0 : diffToBudget < 0)
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatMoney(diffToBudget, { signDisplay: 'always' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={col.isCurrent ? 'text-slate-400' : 'text-slate-300'}>-</span>
                  )}
                </td>
              );
            })}

            {/* Sticky Durchschnitts-Spalte rechts (deutlich abgesetzt) */}
            <td className="sticky right-0 z-20 w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap border-b border-l-2 border-b-slate-200 border-l-slate-300 bg-slate-100 px-3 py-2.5 text-right font-mono shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
              {avgNet !== 0 ? (
                <div>
                  <span
                    className={`font-bold ${avgNet < 0 ? 'text-slate-900' : 'text-emerald-600'}`}
                  >
                    {formatMoney(avgNet)}
                  </span>

                  {/* Budget Abweichung auf Durchschnittsbasis */}
                  {avgDiff !== undefined && Math.abs(avgDiff) >= 0.01 && (
                    <div
                      className={`font-mono text-[10px] font-semibold ${
                        (avgNet >= 0 ? avgDiff > 0 : avgDiff < 0)
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatMoney(avgDiff, { signDisplay: 'always' })}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
          </tr>

          {!isCollapsed && children.map((c) => renderTreeRow(c))}
        </React.Fragment>
      );
    };

    const rootRows = childrenMap.get(null) || [];
    return rootRows.map((r) => renderTreeRow(r));
  };

  // Rekursives Rendern der Zeilen für Konten
  const renderAccountRows = (): React.ReactNode => {
    const periodCount = activePeriodKeys.length;

    // Map von Parent-Account-ID zu Kindern
    const childrenMap = new Map<string | null, AccountCashflowRow[]>();
    accountMatrix.rows.forEach((r) => {
      const pId = r.parent ? r.parent.id : null;
      const list = childrenMap.get(pId) || [];
      list.push(r);
      childrenMap.set(pId, list);
    });

    const renderAccountTreeRow = (row: AccountCashflowRow): React.ReactNode => {
      const isCollapsed = collapsedAccounts.has(row.account.id);
      const children = childrenMap.get(row.account.id) || [];
      const hasChildren = row.hasChildren && children.length > 0;
      const isVirtual = row.account.accountType === 'virtual';

      const avgNet = periodCount > 0 ? row.totalNet / periodCount : 0;

      return (
        <React.Fragment key={row.account.id}>
          <tr className="group text-xs transition-colors hover:bg-slate-50">
            {/* Konto Name & Hierarchie (sticky Spalte links) */}
            <td className="sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap border-b border-r-2 border-b-slate-200 border-r-slate-300 bg-slate-100 px-4 py-2.5 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
              <div
                className="flex items-center gap-2 truncate"
                style={{ paddingLeft: `${row.depth * 20}px` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleAccountCollapse(row.account.id)}
                    className="flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    aria-label={isCollapsed ? 'Unterkonten aufklappen' : 'Unterkonten einklappen'}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}

                <div
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${row.account.color || '#3b82f6'}20`,
                    color: row.account.color || '#3b82f6',
                  }}
                >
                  <IconRenderer name={row.account.icon} className="h-3.5 w-3.5" />
                </div>

                <div className="flex min-w-0 flex-col truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`truncate ${row.depth === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}
                      title={row.account.name}
                    >
                      {row.account.name}
                    </span>
                    {isVirtual && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-700">
                        Virtuell
                      </span>
                    )}
                  </div>
                  {row.account.iban && (
                    <span className="truncate font-mono text-[10px] text-slate-400">
                      {row.account.iban}
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* Perioden Spalten */}
            {displayColumns.map((col, cIdx) => {
              let net = 0;

              if (col.type === 'period') {
                net = row.periods[col.id]?.net || 0;
              } else {
                col.periodKeys.forEach((k) => {
                  const p = row.periods[k];
                  if (p) net += p.net;
                });
              }

              const isLastCol = cIdx === displayColumns.length - 1;
              const borderRight = isLastCol
                ? ''
                : col.isLastInYear
                  ? 'border-r-2 border-slate-300'
                  : 'border-r border-slate-100';
              const bgHighlight = col.isCurrent
                ? 'bg-blue-50/50 border-x-2 border-blue-200/80 font-semibold'
                : col.type === 'collapsed_year'
                  ? 'bg-slate-50 font-medium'
                  : '';

              const cellDateRange =
                col.type === 'period'
                  ? getPeriodDateRange(col.id, granularity)
                  : { startDate: `${col.year}-01-01`, endDate: `${col.year}-12-31` };
              const cellUrl = buildTransactionsUrl({
                accountId: row.account.id,
                startDate: cellDateRange.startDate,
                endDate: cellDateRange.endDate,
              });

              const periodDesc =
                col.type === 'period'
                  ? `im Zeitraum ${formatPeriodLabel(col.id, granularity)}`
                  : `im Jahr ${col.year}`;

              return (
                <td
                  key={col.id}
                  className={`cursor-pointer whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right font-mono transition-colors hover:bg-purple-100/60 focus:bg-purple-100/60 focus:outline-none ${borderRight} ${bgHighlight}`}
                  tabIndex={0}
                  title={`Buchungen für "${row.account.name}" ${periodDesc} anzeigen`}
                  onClick={() => navigate(cellUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(cellUrl);
                    }
                  }}
                >
                  {net !== 0 ? (
                    <span
                      className={`font-bold ${net < 0 ? 'text-slate-900' : 'text-emerald-600'}`}
                    >
                      {formatMoney(net)}
                    </span>
                  ) : (
                    <span className={col.isCurrent ? 'text-slate-400' : 'text-slate-300'}>-</span>
                  )}
                </td>
              );
            })}

            {/* Sticky Durchschnitts-Spalte rechts */}
            <td className="sticky right-0 z-20 w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap border-b border-l-2 border-b-slate-200 border-l-slate-300 bg-slate-100 px-3 py-2.5 text-right font-mono shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
              {avgNet !== 0 ? (
                <span className={`font-bold ${avgNet < 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {formatMoney(avgNet)}
                </span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
          </tr>

          {!isCollapsed && children.map((c) => renderAccountTreeRow(c))}
        </React.Fragment>
      );
    };

    const rootRows = childrenMap.get(null) || [];
    return rootRows.map((r) => renderAccountTreeRow(r));
  };

  // Dispatcher für die Tabellenzeilen
  const renderRows = (): React.ReactNode => {
    if (viewMode === 'categories') {
      return renderCategoryRows();
    }
    return renderAccountRows();
  };

  // Vorletzte Zeile: Unkategorisierte Buchungen (nur in der Kategorienansicht)
  const renderUncategorizedRow = (): React.ReactNode => {
    const periodCount = categoryMatrix.periodKeys.length;
    const avgNet = periodCount > 0 ? categoryMatrix.uncategorizedRow.totalNet / periodCount : 0;

    return (
      <tr
        key="__uncategorized__"
        data-testid="cashflow-uncategorized-row"
        className="group border-t-2 border-slate-200 text-xs transition-colors hover:bg-slate-50"
      >
        {/* Name & Icon (deutlich abgesetzte sticky Spalte) */}
        <td className="sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap border-b border-r-2 border-b-slate-200 border-r-slate-300 bg-slate-100 px-4 py-2.5 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
          <div className="flex items-center gap-2 truncate">
            <div className="w-4 flex-shrink-0" />
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-400 text-white">
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div className="flex min-w-0 flex-col truncate">
              <span className="truncate font-semibold text-slate-700">Nicht kategorisiert</span>
            </div>
          </div>
        </td>

        {/* Perioden Spalten (einzeln oder komprimiert) */}
        {displayColumns.map((col, cIdx) => {
          let net = 0;
          if (col.type === 'period') {
            const pData = categoryMatrix.uncategorizedRow.periods[col.id];
            if (pData) net = pData.net;
          } else {
            col.periodKeys.forEach((k) => {
              const p = categoryMatrix.uncategorizedRow.periods[k];
              if (p) net += p.net;
            });
          }

          const isLastCol = cIdx === displayColumns.length - 1;
          const borderRight = isLastCol
            ? ''
            : col.isLastInYear
              ? 'border-r-2 border-slate-300'
              : 'border-r border-slate-100';
          const bgHighlight = col.isCurrent
            ? 'bg-blue-50/50 border-x-2 border-blue-200/80 font-semibold'
            : col.type === 'collapsed_year'
              ? 'bg-slate-50 font-medium'
              : '';

          const cellDateRange =
            col.type === 'period'
              ? getPeriodDateRange(col.id, granularity)
              : { startDate: `${col.year}-01-01`, endDate: `${col.year}-12-31` };
          const cellUrl = buildTransactionsUrl({
            categoryIds: ['__uncategorized__'],
            startDate: cellDateRange.startDate,
            endDate: cellDateRange.endDate,
            accountId:
              selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : undefined,
          });

          const periodDesc =
            col.type === 'period'
              ? `im Zeitraum ${formatPeriodLabel(col.id, granularity)}`
              : `im Jahr ${col.year}`;

          return (
            <td
              key={col.id}
              className={`cursor-pointer whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right font-mono transition-colors hover:bg-amber-100/60 focus:bg-amber-100/60 focus:outline-none ${borderRight} ${bgHighlight}`}
              tabIndex={0}
              title={`Nicht kategorisierte Buchungen ${periodDesc} anzeigen`}
              onClick={() => navigate(cellUrl)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(cellUrl);
                }
              }}
            >
              {net !== 0 ? (
                <span className={`font-bold ${net < 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {formatMoney(net)}
                </span>
              ) : (
                <span className={col.isCurrent ? 'text-slate-400' : 'text-slate-300'}>-</span>
              )}
            </td>
          );
        })}

        {/* Sticky Durchschnitts-Spalte rechts */}
        <td className="sticky right-0 z-20 w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap border-b border-l-2 border-b-slate-200 border-l-slate-300 bg-slate-100 px-3 py-2.5 text-right font-mono shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors group-hover:bg-slate-200">
          {avgNet !== 0 ? (
            <span className={`font-bold ${avgNet < 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
              {formatMoney(avgNet)}
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>
      </tr>
    );
  };

  const totalAvgNet = useMemo(() => {
    return activePeriodKeys.length > 0 ? activeTotalRow.totalNet / activePeriodKeys.length : 0;
  }, [activePeriodKeys.length, activeTotalRow.totalNet]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Gesamt Einnahmen</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-600">
            {formatMoney(activeTotalRow.totalInbound)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Gesamt Ausgaben</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900">
            {formatMoney(activeTotalRow.totalOutbound)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Netto Cashflow</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div
            className={`font-mono text-2xl font-bold ${
              activeTotalRow.totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatMoney(activeTotalRow.totalNet, { signDisplay: 'always' })}
          </div>
        </div>
      </div>

      {/* Ansichts-Umschalter: Kategorien vs. Konten */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="shadow-xs inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm font-medium"
          role="group"
          aria-label="Cashflow-Ansichtsmodus"
        >
          <button
            type="button"
            data-testid="cashflow-view-categories-btn"
            onClick={() => setViewMode('categories')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'categories'
                ? 'shadow-xs bg-white text-blue-700'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>Kategorien</span>
          </button>
          <button
            type="button"
            data-testid="cashflow-view-accounts-btn"
            onClick={() => setViewMode('accounts')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'accounts'
                ? 'shadow-xs bg-white text-blue-700'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            <span>Konten</span>
          </button>
        </div>
        <div className="text-xs font-medium text-slate-500">
          {viewMode === 'categories'
            ? 'Aufschlüsselung nach Budget-Kategorien'
            : 'Aufschlüsselung nach Bank- und virtuellen Unterkonten'}
        </div>
      </div>

      {/* Gestapeltes Balkendiagramm */}
      <StackedCategoryBarChart
        result={chartResult}
        granularity={granularity}
        mode={viewMode}
        selectedAccountId={selectedAccountId || undefined}
        startDate={startDate || undefined}
        endDate={endDate || undefined}
      />

      {/* Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div ref={tableContainerRef} className="no-scrollbar overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left">
            <colgroup>
              <col className="w-[240px] min-w-[240px] max-w-[240px]" style={{ width: '240px' }} />
              {displayColumns.map((col) => (
                <col
                  key={col.id}
                  className="min-w-[100px]"
                  style={{
                    width: `${100 / (displayColumns.length || 1)}%`,
                  }}
                />
              ))}
              <col className="w-[110px] min-w-[110px] max-w-[110px]" style={{ width: '110px' }} />
            </colgroup>
            <thead>
              {/* Zeile 1: Übergeordnete Jahres-Gruppen mit Auf-/Zuklappen */}
              <tr className="bg-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 w-[240px] min-w-[240px] max-w-[240px] border-b-2 border-r-2 border-slate-300 bg-slate-200 px-4 py-3 text-left text-slate-900 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)]"
                >
                  {viewMode === 'categories' ? 'Kategorie' : 'Konto'}
                </th>
                {yearGroups.map((group, gIdx) => {
                  const isCurrentYear = group.year === currentYear;
                  const isLastGroup = gIdx === yearGroups.length - 1;
                  return (
                    <th
                      key={group.year}
                      colSpan={group.colSpan}
                      className={`border-b-2 border-slate-300 px-3 py-2 text-center transition-colors ${
                        isLastGroup ? '' : 'border-r-2 border-slate-300'
                      } ${
                        isCurrentYear
                          ? 'bg-blue-100/70 font-extrabold text-blue-900'
                          : 'bg-slate-100/90 text-slate-700'
                      }`}
                    >
                      {granularity !== 'yearly' ? (
                        <button
                          type="button"
                          onClick={() => toggleYearCollapse(group.year)}
                          title={
                            group.isCollapsed
                              ? `${group.year} aufklappen (${group.periodKeys.length} ${granularity === 'monthly' ? 'Monate' : 'Perioden'})`
                              : `${group.year} einklappen`
                          }
                          className="group inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
                        >
                          {group.isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
                          )}
                          <span>{group.year}</span>
                          {group.isCollapsed && (
                            <span className="rounded-full bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-500">
                              {group.periodKeys.length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span>{group.year}</span>
                      )}
                    </th>
                  );
                })}

                {/* Sticky Spalte rechts für Durchschnitt - durchgängiger border-l-2 */}
                <th
                  rowSpan={2}
                  className="sticky right-0 z-30 w-[110px] min-w-[110px] max-w-[110px] border-b-2 border-l-2 border-slate-300 bg-slate-200 px-3 py-3 text-center text-slate-900 shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)]"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-base font-extrabold text-slate-900">Ø</span>
                    <span className="text-[10px] font-semibold normal-case text-slate-600">
                      pro{' '}
                      {granularity === 'monthly'
                        ? 'Monat'
                        : granularity === 'quarterly'
                          ? 'Quartal'
                          : granularity === 'halfYearly'
                            ? 'Halbjahr'
                            : 'Jahr'}
                    </span>
                  </div>
                </th>
              </tr>

              {/* Zeile 2: Einzelne Unterperioden (Monate/Quartale) oder Jahressumme */}
              <tr className="bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
                {displayColumns.map((col, cIdx) => {
                  const isLastCol = cIdx === displayColumns.length - 1;
                  const borderRight = isLastCol
                    ? ''
                    : col.isLastInYear
                      ? 'border-r-2 border-slate-300'
                      : 'border-r border-slate-100';
                  return (
                    <th
                      key={col.id}
                      ref={col.isCurrent ? currentPeriodHeaderRef : undefined}
                      data-testid={col.isCurrent ? 'current-period-header' : undefined}
                      className={`min-w-[100px] border-b-2 border-slate-300 px-3 py-2 text-right transition-colors ${borderRight} ${
                        col.isCurrent
                          ? 'bg-blue-100/90 font-extrabold text-blue-950 shadow-inner'
                          : col.type === 'collapsed_year'
                            ? 'bg-slate-100/70 font-semibold text-slate-600'
                            : ''
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{col.label}</span>
                        {col.isCurrent && (
                          <span className="shadow-xs inline-flex items-center rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                            Aktuell
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayColumns.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-12 text-center text-sm text-slate-400">
                    Noch keine Daten für diesen Zeitraum vorhanden.
                  </td>
                </tr>
              ) : (
                <>
                  {viewMode === 'categories' ? (
                    categoryMatrix.rows.length > 0 ? (
                      renderRows()
                    ) : (
                      <tr>
                        <td
                          colSpan={displayColumns.length + 2}
                          className="py-12 text-center text-sm text-slate-400"
                        >
                          Noch keine Kategorien konfiguriert.
                        </td>
                      </tr>
                    )
                  ) : accountMatrix.rows.length > 0 ? (
                    renderRows()
                  ) : (
                    <tr>
                      <td
                        colSpan={displayColumns.length + 2}
                        className="py-12 text-center text-sm text-slate-400"
                      >
                        Noch keine Konten konfiguriert.
                      </td>
                    </tr>
                  )}
                  {viewMode === 'categories' &&
                    (!selectedCategoryIds || selectedCategoryIds.includes('__uncategorized__')) &&
                    renderUncategorizedRow()}
                </>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {displayColumns.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-200 text-xs font-extrabold">
                  <td className="sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] border-r-2 border-t-2 border-slate-300 bg-slate-200 px-4 py-3.5 font-extrabold text-slate-900 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)]">
                    Netto-Gesamtergebnis
                  </td>
                  {displayColumns.map((col, cIdx) => {
                    let net = 0;
                    if (col.type === 'period') {
                      net = activeTotalRow.periods[col.id]?.net || 0;
                    } else {
                      net = col.periodKeys.reduce(
                        (sum, k) => sum + (activeTotalRow.periods[k]?.net || 0),
                        0
                      );
                    }

                    const isLastCol = cIdx === displayColumns.length - 1;
                    const borderRight = isLastCol
                      ? ''
                      : col.isLastInYear
                        ? 'border-r-2 border-slate-300'
                        : 'border-r border-slate-200';
                    const highlightClass = col.isCurrent
                      ? 'bg-blue-100 border-x-2 border-blue-400'
                      : col.type === 'collapsed_year'
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-slate-200';

                    return (
                      <td
                        key={col.id}
                        className={`border-t-2 border-slate-300 px-3 py-3.5 text-right font-mono font-extrabold transition-colors ${borderRight} ${highlightClass} ${
                          net >= 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {formatMoney(net)}
                      </td>
                    );
                  })}

                  {/* Sticky Durchschnitts-Spalte rechts */}
                  <td className="sticky right-0 z-20 w-[110px] min-w-[110px] max-w-[110px] border-l-2 border-t-2 border-slate-300 bg-slate-200 px-3 py-3.5 text-right font-mono font-extrabold shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)]">
                    <span className={totalAvgNet >= 0 ? 'text-emerald-700' : 'text-slate-900'}>
                      {formatMoney(totalAvgNet, { signDisplay: 'always' })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
