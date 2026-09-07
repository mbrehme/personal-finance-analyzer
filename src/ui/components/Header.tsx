/**
 * @file Header.tsx
 * @description Hauptnavigation der Anwendung mit Navigation zu Konfiguration, Buchungen,
 * Cashflow-Matrix und Kontoständen sowie globaler Datenverwaltung (Export, Import, Reset).
 * @module components/Header
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useFinance } from '@/domain';
import { ExportModal } from '@/ui/components/modals/ExportModal';
import { ResetModal } from '@/ui/components/modals/ResetModal';
import {
  Wallet,
  Layers,
  Receipt,
  BarChart3,
  Shield,
  RefreshCw,
  Database,
  ChevronDown,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { reMatchStatus, triggerReMatch, importConfiguration, autoReprogress, setAutoReprogress } =
    useFinance();

  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Klick außerhalb schließt das Dropdown-Menü
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDataMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const summary = await importConfiguration(text);
        alert(
          `Import erfolgreich!\n` +
            `• Konten: ${summary.accountsCount}\n` +
            `• Kategorien: ${summary.categoriesCount}\n` +
            `• Transaktionen: ${summary.transactionsCount}`
        );
      } catch {
        alert('Fehler beim Importieren der JSON-Datei. Bitte prüfe das Format.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">Finance Analyzer</span>
              <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
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

            <NavLink to="/analytics" className={navLinkClass}>
              <BarChart3 className="h-4 w-4" />
              <span>Analyse</span>
            </NavLink>
          </nav>

          {/* Header Actions: Re-Match & Global Data Management */}
          <div className="flex items-center gap-2">
            {/* Re-Match Button & Auto-Reprogress Toggle */}
            <div
              className={`inline-flex h-8 items-center rounded-lg border text-xs shadow-sm transition-all ${
                reMatchStatus === 'needs_reprogress'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : reMatchStatus === 'is_reprogressing'
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200/80 bg-white text-slate-600'
              }`}
            >
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
                className={`inline-flex h-full items-center gap-1.5 rounded-l-[7px] px-2.5 font-medium transition-colors hover:bg-black/5 disabled:opacity-40 ${
                  reMatchStatus === 'needs_reprogress'
                    ? 'bg-amber-50 font-semibold text-amber-900 hover:bg-amber-100/60'
                    : reMatchStatus === 'is_reprogressing'
                      ? 'cursor-wait bg-blue-50 text-blue-800'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    reMatchStatus === 'is_reprogressing'
                      ? 'animate-spin text-blue-600'
                      : reMatchStatus === 'needs_reprogress'
                        ? 'text-amber-600'
                        : 'text-slate-400'
                  }`}
                />
                <span>
                  {reMatchStatus === 'is_reprogressing' ? 'Progressing...' : 'Reprogress'}
                </span>
                {reMatchStatus === 'needs_reprogress' ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                  </span>
                ) : reMatchStatus === 'has_progressed' ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                    title="Synchronisiert"
                  ></span>
                ) : null}
              </button>

              <div
                className={`h-4 w-px shrink-0 ${
                  reMatchStatus === 'needs_reprogress'
                    ? 'bg-amber-300'
                    : reMatchStatus === 'is_reprogressing'
                      ? 'bg-blue-200'
                      : 'bg-slate-200'
                }`}
              />

              <label
                className="inline-flex h-full cursor-pointer select-none items-center gap-1.5 rounded-r-[7px] px-2 text-[11px] font-medium transition-colors hover:bg-black/5"
                title="Auto-Reprogress: Änderungen an Regeln und Kategorien automatisch sofort anwenden"
              >
                <input
                  type="checkbox"
                  checked={autoReprogress}
                  onChange={(e) => setAutoReprogress(e.target.checked)}
                  data-testid="auto-reprogress-checkbox"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span
                  className={
                    reMatchStatus === 'needs_reprogress'
                      ? 'font-semibold text-amber-900'
                      : 'text-slate-600'
                  }
                >
                  Auto
                </span>
              </label>
            </div>

            {/* Globales Datenverwaltungs-Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsDataMenuOpen((prev) => !prev)}
                data-testid="header-data-menu-btn"
                title="Datenverwaltung (Export, Import, Reset)"
                className="shadow-xs inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Database className="h-3.5 w-3.5 text-slate-500" />
                <span>Daten</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {isDataMenuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5"
                  data-testid="header-data-menu-panel"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Datenverwaltung
                  </div>

                  {/* Export */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDataMenuOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>Daten exportieren...</span>
                  </button>

                  {/* Import */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDataMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Daten importieren...</span>
                  </button>

                  <div className="my-1 border-t border-slate-100"></div>

                  {/* Reset */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDataMenuOpen(false);
                      setIsResetModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-rose-500" />
                    <span>Workspace zurücksetzen...</span>
                  </button>
                </div>
              )}

              {/* Unsichtbares File-Input für den JSON-Import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
                data-testid="header-import-file-input"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Modale Dialoge */}
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
      <ResetModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} />
    </>
  );
};
