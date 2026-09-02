/**
 * @file Header.tsx
 * @description Hauptnavigation der Anwendung mit Brand, Routen-Links und Umgebungs-Badge.
 * @module components/Header
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wallet, LayoutDashboard, Home } from 'lucide-react';

/**
 * Header-Komponente der Anwendung.
 * Zeigt die Navigation und bei Non-Production-Deployments (Stage, PR Preview) ein optisches Badge an.
 *
 * @returns {JSX.Element} Die gerenderte Header-Leiste
 */
export const Header: React.FC = () => {
  const env = import.meta.env.VITE_APP_ENV;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">FinanceFlow</span>
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 sm:inline">
              Analyzer
            </span>
            {env && env !== 'production' && (
              <span
                data-testid="env-badge"
                className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  env === 'stage'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : env === 'preview'
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {env === 'preview' ? 'PR Preview' : env}
              </span>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <NavLink to="/" end className={navLinkClass}>
            <Home className="h-4 w-4" />
            <span>Home</span>
          </NavLink>
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </NavLink>
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            React + Vite + TS
          </span>
        </div>
      </div>
    </header>
  );
};
