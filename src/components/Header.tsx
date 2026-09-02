/**
 * @file Header.tsx
 * @description Hauptnavigation der Anwendung mit Navigation zu Konfiguration, Buchungen,
 * Cashflow-Matrix und Kontoständen.
 * @module components/Header
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useFinance } from '@/services/storage/FinanceContext';
import {
  Wallet,
  Layers,
  Receipt,
  TrendingUp,
  Shield,
  Sparkles,
  Loader2,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { needsReMatch, reMatching, triggerReMatch, transactions } = useFinance();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">Finance Analyzer</span>
            <span className="hidden rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700 sm:inline-flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-600" />
              100% Client-Side
            </span>
          </div>
        </NavLink>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
          <NavLink to="/configuration" className={navLinkClass}>
            <Layers className="h-4 w-4" />
            <span>Konfiguration</span>
          </NavLink>

          <NavLink to="/transactions" className={navLinkClass}>
            <Receipt className="h-4 w-4" />
            <span>Buchungen</span>
          </NavLink>

          <NavLink to="/cashflow" className={navLinkClass}>
            <TrendingUp className="h-4 w-4" />
            <span>Cashflow</span>
          </NavLink>

          <NavLink to="/balances" className={navLinkClass}>
            <Wallet className="h-4 w-4" />
            <span>Salden</span>
          </NavLink>
        </nav>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {/* Globaler Neu-Matchen Knopf */}
          <button
            type="button"
            onClick={triggerReMatch}
            disabled={reMatching || transactions.length === 0}
            title={
              needsReMatch
                ? 'Regeln oder Buckets wurden angepasst. Klicke hier, um alle Buchungen neu zuzuordnen.'
                : 'Regex-Regeln und Bucket-Zuweisungen auf alle Buchungen anwenden'
            }
            className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              needsReMatch
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md ring-2 ring-amber-400/50'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm disabled:opacity-40'
            }`}
          >
            {reMatching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
            ) : (
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  needsReMatch ? 'text-amber-100 animate-bounce' : 'text-amber-500'
                }`}
              />
            )}
            <span>{reMatching ? 'Matche...' : 'Neu matchen'}</span>

            {/* Pulsierender Indikator bei Änderungsbedarf */}
            {needsReMatch && !reMatching && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
