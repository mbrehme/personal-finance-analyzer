/**
 * @file ConfigurationLayout.tsx
 * @description Layout-Container für den Konfigurationsbereich mit globalem Header,
 * JSON Export/Import, Reset-Funktion und Tabs zur Navigation zwischen den Subpages.
 * @module pages/configuration/ConfigurationLayout
 */

import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFinance } from '@/domain';
import { Layers, Landmark } from 'lucide-react';

export const CONFIGURATION_LAST_SUBPAGE_KEY = 'configuration_last_subpage';

export const ConfigurationLayout: React.FC = () => {
  const { categories, accounts } = useFinance();

  const location = useLocation();
  const isAccounts = location.pathname.includes('/accounts');

  // Zuletzt besuchte Subpage im Konfigurations-Bereich speichern
  useEffect(() => {
    if (location.pathname.includes('/accounts')) {
      localStorage.setItem(CONFIGURATION_LAST_SUBPAGE_KEY, 'accounts');
    } else if (location.pathname.includes('/categories')) {
      localStorage.setItem(CONFIGURATION_LAST_SUBPAGE_KEY, 'categories');
    }
  }, [location.pathname]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Layers className="h-7 w-7 text-blue-600" />
          Konfiguration
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Verwalte hierarchische Kategorien, Regex-Muster, Soll-Budgets und Konten. Klicke auf eine
          Zeile zum Bearbeiten oder nutze Drag & Drop zum Sortieren & Unterordnen.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <NavLink
          to="/configuration/categories"
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            !isAccounts
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          Kategorien ({categories.length})
        </NavLink>

        <NavLink
          to="/configuration/accounts"
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            isAccounts
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="h-4 w-4" />
          Konten ({accounts.length})
        </NavLink>
      </div>

      {/* Aktive Subpage */}
      <Outlet />
    </div>
  );
};
