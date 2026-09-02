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
  Loader2,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { reMatchStatus, triggerReMatch } = useFinance();

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

        {/* Header Actions: Re-Match Status Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerReMatch}
            disabled={reMatchStatus === 'is_reprogressing'}
            data-testid="rematch-button"
            data-status={reMatchStatus}
            title={
              reMatchStatus === 'needs_reprogress'
                ? 'Regeln oder Konfiguration wurden geändert. Klicke hier, um alle Buchungen neu zuzuordnen.'
                : reMatchStatus === 'is_reprogressing'
                ? 'Buchungen werden aktuell neu zugeordnet...'
                : 'Alle Buchungen sind synchronisiert. Klicke für ein erneutes manuelles Matching.'
            }
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs transition-all ${
              reMatchStatus === 'needs_reprogress'
                ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 shadow-sm font-semibold'
                : reMatchStatus === 'is_reprogressing'
                ? 'bg-blue-50 text-blue-800 border border-blue-200 cursor-wait font-medium'
                : 'text-slate-600 bg-white hover:bg-slate-100 border border-slate-200/80 shadow-sm hover:text-slate-900 font-medium disabled:opacity-40'
            }`}
          >
            {/* Status-Icon / Indikator */}
            {reMatchStatus === 'is_reprogressing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            ) : reMatchStatus === 'needs_reprogress' ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            )}

            {/* Kompaktes Label */}
            <span>
              {reMatchStatus === 'is_reprogressing'
                ? 'Progressing...'
                : 'Reprogress'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
