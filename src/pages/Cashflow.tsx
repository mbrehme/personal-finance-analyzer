/**
 * @file Cashflow.tsx
 * @description Cashflow-Matrix-Ansicht mit umschaltbarer Granularität (Monat, Quartal,
 * Halbjahr, Jahr), hierarchischem Roll-Up von Kindersummen und Soll-Ist-Abgleich.
 * @module pages/Cashflow
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { PeriodGranularity } from '@/types/finance';
import { calculateCashflowMatrix, BucketCashflowRow } from '@/services/analytics/cashflowCalculator';
import { PeriodSelector } from '@/components/PeriodSelector';
import { IconRenderer } from '@/components/IconRenderer';
import { formatPeriodLabel } from '@/utils/dateUtils';
import {
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Target,
} from 'lucide-react';

export const Cashflow: React.FC = () => {
  const { buckets, transactions, accounts } = useFinance();

  const [granularity, setGranularity] = useState<PeriodGranularity>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

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

      return (
        <React.Fragment key={row.bucket.id}>
          <tr className="hover:bg-slate-50/80 border-b border-slate-100 transition-colors text-xs">
            {/* Bucket Name & Hierarchie */}
            <td className="py-3 px-4 whitespace-nowrap">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 20}px` }}>
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(row.bucket.id)}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <div className="w-4" />
                )}
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: row.bucket.color || '#64748b' }}
                >
                  <IconRenderer name={row.bucket.icon} className="w-3.5 h-3.5" />
                </div>
                <span className={`font-semibold ${row.depth === 0 ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                  {row.bucket.name}
                </span>
              </div>
            </td>

            {/* Soll-Budget Spalte */}
            <td className="py-3 px-3 text-right whitespace-nowrap text-slate-500 font-mono">
              {row.periods[matrix.periodKeys[0]]?.budget !== undefined ? (
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                  {row.periods[matrix.periodKeys[0]].budget?.toLocaleString('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>

            {/* Perioden Spalten */}
            {matrix.periodKeys.map((pKey) => {
              const pData = row.periods[pKey] || { inbound: 0, outbound: 0, net: 0 };
              const isOverBudget =
                pData.diffToBudget !== undefined && pData.diffToBudget > 0;

              return (
                <td key={pKey} className="py-3 px-4 text-right whitespace-nowrap font-mono">
                  {pData.net !== 0 ? (
                    <div>
                      <span
                        className={`font-bold ${
                          pData.net < 0 ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {pData.net.toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>

                      {/* Budget Abweichung */}
                      {isOverBudget && (
                        <div className="text-[10px] text-red-600 font-semibold flex items-center justify-end gap-0.5">
                          <Target className="w-2.5 h-2.5" />
                          +{pData.diffToBudget?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              );
            })}

            {/* Gesamt-Spalte */}
            <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold bg-slate-50/50">
              <span className={row.totalNet < 0 ? 'text-slate-900' : 'text-emerald-600'}>
                {row.totalNet.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </td>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 min-w-[220px]">Kategorie / Bucket</th>
                <th className="py-3.5 px-3 text-right">Soll / Periode</th>
                {matrix.periodKeys.map((pKey) => (
                  <th key={pKey} className="py-3.5 px-4 text-right min-w-[120px]">
                    {formatPeriodLabel(pKey, granularity)}
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right min-w-[130px] bg-slate-100/70">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.length > 0 ? (
                renderRows()
              ) : (
                <tr>
                  <td
                    colSpan={matrix.periodKeys.length + 3}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Noch keine Daten für diesen Zeitraum vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {matrix.periodKeys.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-xs">
                  <td className="py-3.5 px-4 text-slate-900 font-bold">Netto-Gesamtergebnis</td>
                  <td className="py-3.5 px-3 text-right text-slate-400">-</td>
                  {matrix.periodKeys.map((pKey) => {
                    const net = matrix.totalRow.periods[pKey]?.net || 0;
                    return (
                      <td
                        key={pKey}
                        className={`py-3.5 px-4 text-right font-mono font-bold ${
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
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold bg-slate-200/60 text-slate-900">
                    {matrix.totalRow.totalNet.toLocaleString('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                      signDisplay: 'always',
                    })}
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
