/**
 * @file Header.tsx
 * @description Hauptnavigation der Anwendung mit Navigation zu Konfiguration, Buchungen,
 * Cashflow-Matrix und Kontoständen.
 * @module components/Header
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Wallet,
  Layers,
  Receipt,
  TrendingUp,
  Shield,
} from 'lucide-react';

export const Header: React.FC = () => {
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
          <div>
            <span className="text-base font-bold text-slate-900">Finance Analyzer</span>
            <span className="ml-2 hidden rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 sm:inline">
              Local-First
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

        {/* Local Privacy Badge */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            100% Client-Side
          </span>
        </div>
      </div>
    </header>
  );
};
