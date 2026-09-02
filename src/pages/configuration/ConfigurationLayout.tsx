/**
 * @file ConfigurationLayout.tsx
 * @description Layout-Container für den Konfigurationsbereich mit globalem Header,
 * JSON Export/Import, Reset-Funktion und Tabs zur Navigation zwischen den Subpages.
 * @module pages/configuration/ConfigurationLayout
 */

import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFinance } from '@/services/storage/FinanceContext';
import {
  Layers,
  Landmark,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';

export const ConfigurationLayout: React.FC = () => {
  const {
    buckets,
    accounts,
    exportConfiguration,
    importConfiguration,
    resetWorkspace,
  } = useFinance();

  const location = useLocation();
  const isAccounts = location.pathname.includes('/accounts');

  // Export JSON
  const handleExport = async () => {
    const jsonStr = await exportConfiguration();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-configuration-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importConfiguration(text);
        alert('Konfiguration erfolgreich importiert!');
      } catch {
        alert('Fehler beim Importieren der JSON-Datei.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header & Aktionen */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-blue-600" />
            Konfiguration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Verwalte hierarchische Buckets, Regex-Muster, Soll-Budgets und Konten. Klicke auf eine Zeile zum Bearbeiten oder nutze Drag & Drop zum Sortieren & Unterordnen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Download className="w-4 h-4" />
            JSON Export
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            JSON Import
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  'Möchtest du wirklich alle Daten zurücksetzen? Alle Konten, Buckets und Buchungen werden auf die Standardeinstellungen zurückgesetzt.'
                )
              ) {
                resetWorkspace();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 rounded-lg transition-colors border border-rose-200"
            title="Alle Daten auf Standardeinstellungen zurücksetzen"
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Zurücksetzen</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <NavLink
          to="/configuration/buckets"
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            !isAccounts
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Buckets ({buckets.length})
        </NavLink>

        <NavLink
          to="/configuration/accounts"
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            isAccounts
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Konten ({accounts.length})
        </NavLink>
      </div>

      {/* Aktive Subpage */}
      <Outlet />
    </div>
  );
};

