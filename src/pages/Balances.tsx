/**
 * @file Balances.tsx
 * @description Salden- und Kontostand-Ansicht mit historischer Rekonstruktion
 * über Zeitperioden basierend auf Stichtags-Salden und Transaktions-Deltas.
 * @module pages/Balances
 */

import React, { useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { calculateAllBalances } from '@/services/analytics/balanceCalculator';
import { IconRenderer } from '@/components/IconRenderer';
import { formatPeriodLabel } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { useAnalyticsFilter } from '@/pages/analytics';
import { Wallet, Landmark, ShieldCheck, Calendar, CornerDownRight } from 'lucide-react';

export const Balances: React.FC = () => {
  const { accounts, transactions } = useFinance();
  const { granularity, selectedAccountId, startDate, endDate } = useAnalyticsFilter();

  const balanceMatrix = useMemo(() => {
    return calculateAllBalances(
      accounts,
      transactions,
      granularity,
      selectedAccountId !== 'all' ? selectedAccountId : undefined,
      {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }
    );
  }, [accounts, transactions, granularity, selectedAccountId, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Aktueller Gesamtsaldo</span>
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900">
            {formatMoney(balanceMatrix.totalRow.latestBalance)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Aktive Konten</span>
            <Landmark className="h-4 w-4 text-slate-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900">{accounts.length}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Stichtags-Salden</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900">
            {accounts.reduce((sum, acc) => sum + acc.balanceEntries.length, 0)}
          </div>
        </div>
      </div>

      {/* Salden-Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="min-w-[200px] px-4 py-3.5">Konto</th>
                {balanceMatrix.periodKeys.map((pKey) => (
                  <th key={pKey} className="min-w-[140px] px-4 py-3.5 text-right">
                    {formatPeriodLabel(pKey, granularity)}
                  </th>
                ))}
                <th className="min-w-[140px] bg-slate-100/70 px-4 py-3.5 text-right">
                  Aktueller Stand
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {balanceMatrix.rows.length > 0 ? (
                balanceMatrix.rows.map((row) => {
                  const isVirtual = row.account.accountType === 'virtual';

                  return (
                    <tr
                      key={row.account.id}
                      className={
                        isVirtual
                          ? 'bg-slate-50/50 transition-colors hover:bg-slate-100/60'
                          : 'transition-colors hover:bg-slate-50/80'
                      }
                    >
                      {/* Konto Name */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div
                          className={`flex items-center gap-2.5 ${isVirtual ? 'pl-5 sm:pl-7' : ''}`}
                        >
                          {isVirtual && (
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          )}
                          <div
                            className="shadow-2xs flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: row.account.color || '#3b82f6' }}
                          >
                            <IconRenderer name={row.account.icon} className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{row.account.name}</span>
                              {isVirtual && (
                                <span className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                  Virtuell
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Perioden Salden */}
                      {balanceMatrix.periodKeys.map((pKey) => {
                        const pData = row.periods[pKey] || {
                          startBalance: 0,
                          cashflow: 0,
                          endBalance: 0,
                        };

                        return (
                          <td
                            key={pKey}
                            className="whitespace-nowrap px-4 py-3 text-right font-mono"
                          >
                            <div className="font-bold text-slate-900">
                              {formatMoney(pData.endBalance)}
                            </div>
                            {pData.cashflow !== 0 && (
                              <div
                                className={`text-[10px] ${
                                  pData.cashflow >= 0 ? 'text-emerald-600' : 'text-slate-500'
                                }`}
                              >
                                ({formatMoney(pData.cashflow, { signDisplay: 'always' })})
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Aktueller Stand */}
                      <td className="whitespace-nowrap bg-slate-50/50 px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">
                        {formatMoney(row.latestBalance)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={balanceMatrix.periodKeys.length + 2}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    Keine Konten konfiguriert.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {balanceMatrix.periodKeys.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100/80 text-xs font-bold">
                  <td className="px-4 py-3.5 font-bold text-slate-900">Gesamtvermögen</td>
                  {balanceMatrix.periodKeys.map((pKey) => {
                    const endBal = balanceMatrix.totalRow.periods[pKey]?.endBalance || 0;
                    return (
                      <td
                        key={pKey}
                        className="px-4 py-3.5 text-right font-mono font-bold text-slate-900"
                      >
                        {formatMoney(endBal)}
                      </td>
                    );
                  })}
                  <td className="bg-slate-200/60 px-4 py-3.5 text-right font-mono text-sm font-extrabold text-slate-900">
                    {formatMoney(balanceMatrix.totalRow.latestBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Checkpoints Info Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
        <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
        <div>
          <p className="mb-0.5 font-semibold">Automatische Salden-Rekonstruktion:</p>
          <p className="text-blue-700">
            Die Salden werden ausgehend von deinen in den Konten hinterlegten Stichtagen durch die
            tatsächlichen Einnahmen und Ausgaben exakt fortgeschrieben. Zusätzliche Stichtags-Salden
            kannst du jederzeit in der Konfiguration hinzufügen.
          </p>
        </div>
      </div>
    </div>
  );
};
