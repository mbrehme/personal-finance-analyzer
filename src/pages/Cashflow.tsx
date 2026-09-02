/**
 * @file Cashflow.tsx
 * @description Cashflow-Matrix-Ansicht mit umschaltbarer Granularität (Monat, Quartal,
 * Halbjahr, Jahr), hierarchischem Roll-Up von Kindersummen und Soll-Ist-Abgleich.
 * @module pages/Cashflow
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { PeriodGranularity } from '@/types/finance';
import { calculateCashflowMatrix, BucketCashflowRow } from '@/services/analytics/cashflowCalculator';
import { PeriodSelector } from '@/components/PeriodSelector';
import { IconRenderer } from '@/components/IconRenderer';
import {
  getCurrentPeriodKey,
  getYearFromPeriodKey,
  formatSubPeriodLabel,
  normalizeBudgetToGranularity,
} from '@/utils/dateUtils';
import {
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';

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

export const CASHFLOW_ACCOUNT_FILTER_KEY = 'cashflow_filter_account_id';
export const CASHFLOW_GRANULARITY_KEY = 'cashflow_filter_granularity';

export const Cashflow: React.FC = () => {
  const { buckets, transactions, accounts } = useFinance();

  const [granularity, setGranularity] = useState<PeriodGranularity>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(CASHFLOW_GRANULARITY_KEY);
        if (
          stored === 'monthly' ||
          stored === 'quarterly' ||
          stored === 'halfYearly' ||
          stored === 'yearly'
        ) {
          return stored;
        }
      }
    } catch {
      // Storage access error handling
    }
    return 'monthly';
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(CASHFLOW_ACCOUNT_FILTER_KEY);
        if (stored) {
          return stored;
        }
      }
    } catch {
      // Storage access error handling
    }
    return 'all';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CASHFLOW_GRANULARITY_KEY, granularity);
      }
    } catch {
      // Storage access error handling
    }
  }, [granularity]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CASHFLOW_ACCOUNT_FILTER_KEY, selectedAccountId);
      }
    } catch {
      // Storage access error handling
    }
  }, [selectedAccountId]);

  // Wenn das gespeicherte Konto in den geladenen Konten nicht mehr existiert, auf 'all' zurücksetzen
  useEffect(() => {
    if (
      selectedAccountId !== 'all' &&
      accounts.length > 0 &&
      !accounts.some((a) => a.id === selectedAccountId)
    ) {
      setSelectedAccountId('all');
    }
  }, [accounts, selectedAccountId]);

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

  const matrix = useMemo(() => {
    return calculateCashflowMatrix(
      buckets,
      transactions,
      granularity,
      selectedAccountId !== 'all' ? selectedAccountId : undefined
    );
  }, [buckets, transactions, granularity, selectedAccountId]);

  const currentPeriodKey = useMemo(() => getCurrentPeriodKey(granularity), [granularity]);
  const currentYear = useMemo(() => getYearFromPeriodKey(currentPeriodKey), [currentPeriodKey]);
  const hasCurrentPeriod = matrix.periodKeys.includes(currentPeriodKey);

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
        row.periods[matrix.periodKeys[0]]?.budget ??
        (row.bucket.targetBudget
          ? normalizeBudgetToGranularity(
              row.bucket.targetBudget.amount,
              row.bucket.targetBudget.period,
              granularity
            )
          : undefined);

      return (
        <React.Fragment key={row.bucket.id}>
          <tr className="hover:bg-slate-50/80 group border-b border-slate-100 transition-colors text-xs">
            {/* Bucket Name & Hierarchie */}
            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 py-2.5 px-4 whitespace-nowrap min-w-[240px] w-[240px] max-w-[240px] border-r-2 border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors">
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
                    <span className="text-[10px] text-slate-400 font-mono font-medium truncate">
                      Soll: {targetBudget.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* Perioden Spalten (einzeln oder komprimiert) */}
            {displayColumns.map((col) => {
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
              const borderRight = col.isLastInYear ? 'border-r-2 border-slate-300' : 'border-r border-slate-100';
              const bgHighlight = col.isCurrent
                ? 'bg-blue-50/50 border-x-2 border-blue-200/80 font-semibold'
                : col.type === 'collapsed_year'
                ? 'bg-slate-50/80 font-medium'
                : '';

              return (
                <td
                  key={col.id}
                  className={`py-3 px-3 text-right whitespace-nowrap font-mono transition-colors ${borderRight} ${bgHighlight}`}
                >
                  {net !== 0 ? (
                    <div>
                      <span
                        className={`font-bold ${
                          net < 0 ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {net.toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
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
                          {diffToBudget.toLocaleString('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                            signDisplay: 'always',
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={col.isCurrent ? 'text-slate-400' : 'text-slate-300'}>-</span>
                  )}
                </td>
              );
            })}
          </tr>

          {!isCollapsed && children.map((c) => renderTreeRow(c))}
        </React.Fragment>
      );
    };

    const rootRows = childrenMap.get(null) || [];
    return rootRows.map((r) => renderTreeRow(r));
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Cashflow Matrix
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gegenüberstellung von Einnahmen, Ausgaben und Budgets nach Kategorien.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Konto-Filter */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Konten</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          {/* Granularitäts-Umschalter */}
          <PeriodSelector value={granularity} onChange={setGranularity} />

          {/* Button: Zu aktuellem Zeitraum springen */}
          {hasCurrentPeriod && (
            <button
              type="button"
              onClick={scrollToCurrentPeriod}
              title="Zum aktuellen Zeitraum scrollen"
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Heute</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Gesamt Einnahmen</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {matrix.totalRow.totalInbound.toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Gesamt Ausgaben</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {matrix.totalRow.totalOutbound.toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}
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
            {matrix.totalRow.totalNet.toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
              signDisplay: 'always',
            })}
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto scroll-smooth">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Zeile 1: Übergeordnete Jahres-Gruppen mit Auf-/Zuklappen */}
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 py-3 px-4 min-w-[240px] w-[240px] max-w-[240px] text-left border-r-2 border-slate-300 bg-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                >
                  Bucket
                </th>
                {yearGroups.map((group) => {
                  const isCurrentYear = group.year === currentYear;
                  return (
                    <th
                      key={group.year}
                      colSpan={group.colSpan}
                      className={`py-2 px-3 text-center border-r-2 border-slate-300 transition-colors ${
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
                              ? `${group.year} aufklappen`
                              : `${group.year} einklappen`
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded hover:bg-slate-200/80 transition-colors text-xs font-bold"
                        >
                          {group.isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{group.year}</span>
                          {group.isCollapsed && (
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                              komprimiert ({group.periodKeys.length})
                            </span>
                          )}
                        </button>
                      ) : (
                        <span>{group.year}</span>
                      )}
                    </th>
                  );
                })}
              </tr>

              {/* Zeile 2: Einzelne Unterperioden (Monate/Quartale) oder Jahressumme */}
              <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                {displayColumns.map((col) => {
                  const borderRight = col.isLastInYear
                    ? 'border-r-2 border-slate-300'
                    : 'border-r border-slate-100';
                  return (
                    <th
                      key={col.id}
                      ref={col.isCurrent ? currentPeriodHeaderRef : undefined}
                      data-testid={col.isCurrent ? 'current-period-header' : undefined}
                      className={`py-2 px-3 text-right min-w-[100px] transition-colors ${borderRight} ${
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
              {matrix.rows.length > 0 ? (
                renderRows()
              ) : (
                <tr>
                  <td
                    colSpan={displayColumns.length + 1}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Noch keine Daten für diesen Zeitraum vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {displayColumns.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-xs">
                  <td className="sticky left-0 z-10 bg-slate-100 py-3.5 px-4 text-slate-900 font-bold border-r-2 border-slate-300 min-w-[240px] w-[240px] max-w-[240px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Netto-Gesamtergebnis
                  </td>
                  {displayColumns.map((col) => {
                    let net = 0;
                    if (col.type === 'period') {
                      net = matrix.totalRow.periods[col.id]?.net || 0;
                    } else {
                      net = col.periodKeys.reduce(
                        (sum, k) => sum + (matrix.totalRow.periods[k]?.net || 0),
                        0
                      );
                    }

                    const borderRight = col.isLastInYear
                      ? 'border-r-2 border-slate-300'
                      : 'border-r border-slate-200';
                    const highlightClass = col.isCurrent
                      ? 'bg-blue-100/90 border-x-2 border-blue-400'
                      : col.type === 'collapsed_year'
                      ? 'bg-slate-200/50 text-slate-800'
                      : '';

                    return (
                      <td
                        key={col.id}
                        className={`py-3.5 px-3 text-right font-mono font-bold transition-colors ${borderRight} ${highlightClass} ${
                          net >= 0 ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {net.toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
