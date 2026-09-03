/**
 * @file Cashflow.tsx
 * @description Cashflow-Matrix-Ansicht mit umschaltbarer Granularität (Monat, Quartal,
 * Halbjahr, Jahr), hierarchischem Roll-Up von Kindersummen und Soll-Ist-Abgleich.
 * @module pages/Cashflow
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { calculateCashflowMatrix, BucketCashflowRow } from '@/services/analytics/cashflowCalculator';
import { IconRenderer } from '@/components/IconRenderer';
import {
  getCurrentPeriodKey,
  getYearFromPeriodKey,
  formatSubPeriodLabel,
  normalizeBudgetToGranularity,
} from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import {
  useAnalyticsFilter,
  ANALYTICS_ACCOUNT_KEY as CASHFLOW_ACCOUNT_FILTER_KEY,
  ANALYTICS_GRANULARITY_KEY as CASHFLOW_GRANULARITY_KEY,
  ANALYTICS_START_DATE_KEY as CASHFLOW_START_DATE_KEY,
  ANALYTICS_END_DATE_KEY as CASHFLOW_END_DATE_KEY,
} from '@/pages/analytics';
import {
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export {
  CASHFLOW_ACCOUNT_FILTER_KEY,
  CASHFLOW_GRANULARITY_KEY,
  CASHFLOW_START_DATE_KEY,
  CASHFLOW_END_DATE_KEY,
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
  const { buckets, transactions } = useFinance();
  const {
    granularity,
    selectedAccountId,
    startDate,
    endDate,
  } = useAnalyticsFilter();

  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const currentPeriodHeaderRef = useRef<HTMLTableCellElement>(null);

  const toggleCollapse = (bucketId: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  };

  const isCurrentPeriodInRange = useMemo(() => {
    if (!startDate && !endDate) return true;
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (startDate && todayIso < startDate) return false;
    if (endDate && todayIso > endDate) return false;
    return true;
  }, [startDate, endDate]);

  const matrix = useMemo(() => {
    return calculateCashflowMatrix(
      buckets,
      transactions,
      granularity,
      selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : undefined,
      {
        includeCurrentPeriod: isCurrentPeriodInRange,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }
    );
  }, [buckets, transactions, granularity, selectedAccountId, isCurrentPeriodInRange, startDate, endDate]);

  const currentPeriodKey = useMemo(() => getCurrentPeriodKey(granularity), [granularity]);
  const currentYear = useMemo(() => getYearFromPeriodKey(currentPeriodKey), [currentPeriodKey]);

  // Status für eingeklappte Jahre (vergangene Jahre vor aktuellem Jahr standardmäßig eingeklappt)
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    matrix.periodKeys.forEach((pKey) => {
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
      matrix.periodKeys.forEach((pKey) => {
        const y = getYearFromPeriodKey(pKey);
        if (y < currentYear && !prev.has(y)) {
          next.add(y);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [matrix.periodKeys, currentYear]);

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
    matrix.periodKeys.forEach((pKey) => {
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
  }, [matrix.periodKeys, collapsedYears, granularity]);

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

  // Automatisches und manuelles Scrollen zum aktuellen Zeitraum
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
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      } else {
        container.scrollLeft = scrollLeft;
      }
      return;
    }

    // Fallback: Wenn heutiger Zeitraum jünger als alle Daten ist, zum neuesten Zeitraum scrollen
    if (
      matrix.periodKeys.length > 0 &&
      currentPeriodKey > matrix.periodKeys[matrix.periodKeys.length - 1]
    ) {
      const scrollLeft = container.scrollWidth;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      } else {
        container.scrollLeft = scrollLeft;
      }
    }
  }, [currentPeriodKey, matrix.periodKeys]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      scrollToCurrentPeriod();
    });
    return () => cancelAnimationFrame(frameId);
  }, [scrollToCurrentPeriod]);

  // Rekursives Rendern der Zeilen unter Beachtung des Collapse-States
  const renderRows = (): React.ReactNode => {
    // Map der Kinder
    const childrenMap = new Map<string | null, BucketCashflowRow[]>();
    matrix.rows.forEach((r) => {
      const pId = r.bucket.parentId;
      const list = childrenMap.get(pId) || [];
      list.push(r);
      childrenMap.set(pId, list);
    });

    const renderTreeRow = (row: BucketCashflowRow): React.ReactNode => {
      const isCollapsed = collapsedBuckets.has(row.bucket.id);
      const children = childrenMap.get(row.bucket.id) || [];
      const targetBudget =
        row.effectiveBudget ??
        row.periods[matrix.periodKeys[0]]?.budget ??
        (row.bucket.targetBudget
          ? normalizeBudgetToGranularity(
              row.bucket.targetBudget.amount,
              row.bucket.targetBudget.period,
              granularity
            )
          : undefined);

      const periodCount = matrix.periodKeys.length;
      const avgNet = periodCount > 0 ? row.totalNet / periodCount : 0;
      const avgDiff =
        targetBudget !== undefined && avgNet !== 0
          ? Math.abs(avgNet) - targetBudget
          : undefined;

      return (
        <React.Fragment key={row.bucket.id}>
          <tr className="hover:bg-slate-50 group transition-colors text-xs">
            {/* Bucket Name & Hierarchie (deutlich abgesetzte sticky Spalte) */}
            <td className="sticky left-0 z-20 bg-slate-100 group-hover:bg-slate-200 py-2.5 px-4 whitespace-nowrap min-w-[240px] w-[240px] max-w-[240px] border-b border-b-slate-200 border-r-2 border-r-slate-300 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)] transition-colors">
              <div className="flex items-center gap-2 truncate" style={{ paddingLeft: `${row.depth * 20}px` }}>
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(row.bucket.id)}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 flex-shrink-0"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )}
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: row.bucket.color || '#64748b' }}
                >
                  <IconRenderer name={row.bucket.icon} className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 truncate">
                  <span className={`truncate font-semibold ${row.depth === 0 ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                    {row.bucket.name}
                  </span>
                  {targetBudget !== undefined && targetBudget > 0 && (
                    <span className="text-[10px] text-slate-500 font-mono font-medium truncate">
                      Soll: {formatMoney(targetBudget)}
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* Perioden Spalten (einzeln oder komprimiert) */}
            {displayColumns.map((col, cIdx) => {
              let net = 0;
              let diffToBudget: number | undefined = undefined;

              if (col.type === 'period') {
                const pData = row.periods[col.id] || { inbound: 0, outbound: 0, net: 0 };
                net = pData.net;
                diffToBudget = pData.diffToBudget;
              } else {
                // Aggregierte Jahressumme für das eingeklappte Jahr
                let budget = 0;
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

              return (
                <td
                  key={col.id}
                  className={`py-3 px-3 text-right whitespace-nowrap font-mono transition-colors border-b border-slate-100 ${borderRight} ${bgHighlight}`}
                >
                  {net !== 0 ? (
                    <div>
                      <span
                        className={`font-bold ${
                          net < 0 ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {formatMoney(net)}
                      </span>

                      {/* Budget Abweichung (Über- oder Unterschreitung) */}
                      {diffToBudget !== undefined && Math.abs(diffToBudget) >= 0.01 && (
                        <div
                          className={`text-[10px] font-semibold font-mono ${
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
            <td className="sticky right-0 z-20 bg-slate-100 group-hover:bg-slate-200 py-2.5 px-3 text-right whitespace-nowrap font-mono border-b border-b-slate-200 border-l-2 border-l-slate-300 shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)] min-w-[110px] w-[110px] max-w-[110px] transition-colors">
              {avgNet !== 0 ? (
                <div>
                  <span
                    className={`font-bold ${
                      avgNet < 0 ? 'text-slate-900' : 'text-emerald-600'
                    }`}
                  >
                    {formatMoney(avgNet)}
                  </span>

                  {/* Budget Abweichung auf Durchschnittsbasis */}
                  {avgDiff !== undefined && Math.abs(avgDiff) >= 0.01 && (
                    <div
                      className={`text-[10px] font-semibold font-mono ${
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

  const totalAvgNet = useMemo(() => {
    return matrix.periodKeys.length > 0
      ? matrix.totalRow.totalNet / matrix.periodKeys.length
      : 0;
  }, [matrix.periodKeys.length, matrix.totalRow.totalNet]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Gesamt Einnahmen</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {formatMoney(matrix.totalRow.totalInbound)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Gesamt Ausgaben</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {formatMoney(matrix.totalRow.totalOutbound)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Netto Cashflow</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              matrix.totalRow.totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatMoney(matrix.totalRow.totalNet, { signDisplay: 'always' })}
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto scroll-smooth no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
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
              <tr className="bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 py-3 px-4 min-w-[240px] w-[240px] max-w-[240px] text-left border-r-2 border-b-2 border-slate-300 bg-slate-200 text-slate-900 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)]"
                >
                  Bucket
                </th>
                {yearGroups.map((group, gIdx) => {
                  const isCurrentYear = group.year === currentYear;
                  const isLastGroup = gIdx === yearGroups.length - 1;
                  return (
                    <th
                      key={group.year}
                      colSpan={group.colSpan}
                      className={`py-2 px-3 text-center border-b-2 border-slate-300 transition-colors ${
                        isLastGroup ? '' : 'border-r-2 border-slate-300'
                      } ${
                        isCurrentYear
                          ? 'bg-blue-100/70 text-blue-900 font-extrabold'
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
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors text-xs font-bold text-slate-700 hover:text-slate-900 group cursor-pointer"
                        >
                          {group.isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors flex-shrink-0" />
                          )}
                          <span>{group.year}</span>
                          {group.isCollapsed && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/90 px-1.5 py-0.5 rounded-full leading-none">
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
                  className="sticky right-0 z-30 py-3 px-3 min-w-[110px] w-[110px] max-w-[110px] text-center border-l-2 border-b-2 border-slate-300 bg-slate-200 text-slate-900 shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)]"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-base font-extrabold text-slate-900">Ø</span>
                    <span className="text-[10px] font-semibold text-slate-600 normal-case">
                      pro {granularity === 'monthly' ? 'Monat' : granularity === 'quarterly' ? 'Quartal' : granularity === 'halfYearly' ? 'Halbjahr' : 'Jahr'}
                    </span>
                  </div>
                </th>
              </tr>

              {/* Zeile 2: Einzelne Unterperioden (Monate/Quartale) oder Jahressumme */}
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
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
                      className={`py-2 px-3 text-right min-w-[100px] border-b-2 border-slate-300 transition-colors ${borderRight} ${
                        col.isCurrent
                          ? 'bg-blue-100/90 text-blue-950 font-extrabold shadow-inner'
                          : col.type === 'collapsed_year'
                          ? 'bg-slate-100/70 text-slate-600 font-semibold'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{col.label}</span>
                        {col.isCurrent && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-600 text-white shadow-xs">
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
                  <td
                    colSpan={2}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Noch keine Daten für diesen Zeitraum vorhanden.
                  </td>
                </tr>
              ) : matrix.rows.length > 0 ? (
                renderRows()
              ) : (
                <tr>
                  <td
                    colSpan={displayColumns.length + 2}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Noch keine Buckets konfiguriert.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {displayColumns.length > 0 && (
              <tfoot>
                <tr className="bg-slate-200 font-extrabold border-t-2 border-slate-300 text-xs">
                  <td className="sticky left-0 z-20 bg-slate-200 py-3.5 px-4 text-slate-900 font-extrabold border-r-2 border-t-2 border-slate-300 min-w-[240px] w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)]">
                    Netto-Gesamtergebnis
                  </td>
                  {displayColumns.map((col, cIdx) => {
                    let net = 0;
                    if (col.type === 'period') {
                      net = matrix.totalRow.periods[col.id]?.net || 0;
                    } else {
                      net = col.periodKeys.reduce(
                        (sum, k) => sum + (matrix.totalRow.periods[k]?.net || 0),
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
                        className={`py-3.5 px-3 text-right font-mono font-extrabold transition-colors border-t-2 border-slate-300 ${borderRight} ${highlightClass} ${
                          net >= 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {formatMoney(net)}
                      </td>
                    );
                  })}

                  {/* Sticky Durchschnitts-Spalte rechts */}
                  <td className="sticky right-0 z-20 bg-slate-200 py-3.5 px-3 text-right font-mono font-extrabold border-l-2 border-t-2 border-slate-300 shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.15)] min-w-[110px] w-[110px] max-w-[110px]">
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
