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
import {
  Wallet,
  Landmark,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const Balances: React.FC = () => {
  const { accounts, transactions } = useFinance();
  const {
    granularity,
    selectedAccountId,
    startDate,
    endDate,
  } = useAnalyticsFilter();

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Aktueller Gesamtsaldo</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {formatMoney(balanceMatrix.totalRow.latestBalance)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Aktive Konten</span>
            <Landmark className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {accounts.length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Stichtags-Salden</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {accounts.reduce((sum, acc) => sum + acc.balanceEntries.length, 0)}
          </div>
        </div>
      </div>

      {/* Salden-Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 min-w-[200px]">Konto</th>
                {balanceMatrix.periodKeys.map((pKey) => (
                  <th key={pKey} className="py-3.5 px-4 text-right min-w-[140px]">
                    {formatPeriodLabel(pKey, granularity)}
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right min-w-[140px] bg-slate-100/70">
                  Aktueller Stand
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {balanceMatrix.rows.length > 0 ? (
                balanceMatrix.rows.map((row) => (
                  <tr key={row.account.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Konto Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: row.account.color || '#3b82f6' }}
                        >
                          <IconRenderer name={row.account.icon} className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{row.account.name}</div>
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
                        <td key={pKey} className="py-3 px-4 text-right whitespace-nowrap font-mono">
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
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold bg-slate-50/50 text-slate-900 text-sm">
                      {formatMoney(row.latestBalance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={balanceMatrix.periodKeys.length + 2}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Keine Konten konfiguriert.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Gesamtsummenzeile */}
            {balanceMatrix.periodKeys.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-xs">
                  <td className="py-3.5 px-4 text-slate-900 font-bold">Gesamtvermögen</td>
                  {balanceMatrix.periodKeys.map((pKey) => {
                    const endBal = balanceMatrix.totalRow.periods[pKey]?.endBalance || 0;
                    return (
                      <td
                        key={pKey}
                        className="py-3.5 px-4 text-right font-mono font-bold text-slate-900"
                      >
                        {formatMoney(endBal)}
                      </td>
                    );
                  })}
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold bg-slate-200/60 text-slate-900 text-sm">
                    {formatMoney(balanceMatrix.totalRow.latestBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Checkpoints Info Banner */}
      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
        <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Automatische Salden-Rekonstruktion:</p>
          <p className="text-blue-700">
            Die Salden werden ausgehend von deinen in den Konten hinterlegten Stichtagen durch die
            tatsächlichen Einnahmen und Ausgaben exakt fortgeschrieben. Zusätzliche Stichtags-Salden kannst
            du jederzeit in der Konfiguration hinzufügen.
          </p>
        </div>
      </div>
    </div>
  );
};
