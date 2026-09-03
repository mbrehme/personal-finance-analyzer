/**
 * @file ConfigurationLayout.tsx
 * @description Layout-Container für den Konfigurationsbereich mit globalem Header,
 * JSON Export/Import, Reset-Funktion und Tabs zur Navigation zwischen den Subpages.
 * @module pages/configuration/ConfigurationLayout
 */

import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFinance } from '@/services/storage/FinanceContext';
import { Layers, Landmark, Download, Upload, RotateCcw } from 'lucide-react';

export const ConfigurationLayout: React.FC = () => {
  const { categories, accounts, exportConfiguration, importConfiguration, resetWorkspace } =
    useFinance();

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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Layers className="h-7 w-7 text-blue-600" />
            Konfiguration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Verwalte hierarchische Kategorien, Regex-Muster, Soll-Budgets und Konten. Klicke auf
            eine Zeile zum Bearbeiten oder nutze Drag & Drop zum Sortieren & Unterordnen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Download className="h-4 w-4" />
            JSON Export
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200">
            <Upload className="h-4 w-4" />
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
                  'Möchtest du wirklich alle Daten zurücksetzen? Alle Konten, Kategorien und Buchungen werden auf die Standardeinstellungen zurückgesetzt.'
                )
              ) {
                resetWorkspace();
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800"
            title="Alle Daten auf Standardeinstellungen zurücksetzen"
          >
            <RotateCcw className="h-4 w-4 text-rose-600" />
            <span>Zurücksetzen</span>
          </button>
        </div>
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
