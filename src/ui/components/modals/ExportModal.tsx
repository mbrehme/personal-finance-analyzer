/**
 * @file ExportModal.tsx
 * @description Modaler Dialog für den granularen Export von Finanzdaten und Konfigurationen.
 * Ermöglicht die gezielte Auswahl von Konten, Kategorien, manuellen Overrides,
 * allen Transaktionen und dem Papierkorb. Standardmäßig ist alles vorausgewählt.
 * @module components/modals/ExportModal
 */

import React, { useState } from 'react';
import { useFinance } from '@/domain';
import { ExportOptions, DEFAULT_EXPORT_OPTIONS, isTransactionOverridden } from '@/types/finance';
import { Download, X, Landmark, Layers, Receipt, Edit3, Trash2 } from 'lucide-react';

export interface ExportModalProps {
  /** Gibt an, ob der Dialog geöffnet ist */
  isOpen: boolean;
  /** Callback beim Schließen des Dialogs */
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { accounts, categories, transactions, deletedTransactions, exportConfiguration } =
    useFinance();

  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const manualCount = transactions.filter(
    (t) => t.origin === 'override' || isTransactionOverridden(t)
  ).length;

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    setOptions({
      includeAccounts: true,
      includeCategories: true,
      includeManualTransactions: true,
      includeTransactions: true,
      includeDeletedTransactions: true,
    });
  };

  const handleSelectConfigOnly = () => {
    setOptions({
      includeAccounts: true,
      includeCategories: true,
      includeManualTransactions: true,
      includeTransactions: false,
      includeDeletedTransactions: false,
    });
  };

  const hasAnySelected = Object.values(options).some(Boolean);

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const jsonStr = await exportConfiguration(options);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `finance-export-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error('Export fehlgeschlagen:', err);
      alert('Fehler beim Generieren des Exports.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-base font-bold text-slate-800">
                Daten exportieren
              </h2>
              <p className="text-xs text-slate-500">
                Wähle die Datenbereiche aus, die in die JSON-Datei aufgenommen werden sollen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Schnellwahl */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 px-6 py-2.5 text-xs">
          <span className="font-medium text-slate-600">Schnellauswahl:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Alles auswählen
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={handleSelectConfigOnly}
              className="font-medium text-slate-600 hover:text-slate-800 hover:underline"
            >
              Nur Konfiguration
            </button>
          </div>
        </div>

        {/* Optionsliste */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-6">
          {/* 1. Konten */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.includeAccounts}
              onChange={() => toggleOption('includeAccounts')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Landmark className="h-3.5 w-3.5 text-blue-600" />
                  Konten & Saldenverläufe
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Kontonamen, Farben, Icons und alle historischen Stichtagssalden.
              </p>
            </div>
          </label>

          {/* 2. Kategorien */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.includeCategories}
              onChange={() => toggleOption('includeCategories')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Layers className="h-3.5 w-3.5 text-emerald-600" />
                  Kategorien & Budgets
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Hierarchie, Soll-Budgets, Icons, Farben und automatische Regex-Regeln.
              </p>
            </div>
          </label>

          {/* 3. Manuelle Overrides & Buchungen */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.includeManualTransactions}
              onChange={() => toggleOption('includeManualTransactions')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Edit3 className="h-3.5 w-3.5 text-amber-600" />
                  Manuelle Overrides & manuelle Buchungen
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {manualCount} {manualCount === 1 ? 'Eintrag' : 'Einträge'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Manuell angelegte Buchungen, Splits und manuelle Kategorie-Überschreibungen.
              </p>
            </div>
          </label>

          {/* 4. Alle Transaktionen */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.includeTransactions}
              onChange={() => toggleOption('includeTransactions')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                  Alle Buchungen / Transaktionen
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {transactions.length} {transactions.length === 1 ? 'Buchung' : 'Buchungen'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Vollständiger Datensatz aller importierten und manuellen Buchungen.
              </p>
            </div>
          </label>

          {/* 5. Gelöschte Buchungen (Papierkorb) */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.includeDeletedTransactions}
              onChange={() => toggleOption('includeDeletedTransactions')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  Gelöschte Buchungen (Papierkorb)
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {deletedTransactions.length}{' '}
                  {deletedTransactions.length === 1 ? 'Buchung' : 'Buchungen'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Im Papierkorb befindliche Buchungen (bleiben auch nach Re-Import gelöscht).
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-xs text-slate-500">
            {hasAnySelected ? 'Format: JSON (strukturiert)' : 'Keine Bereiche ausgewählt'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="shadow-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!hasAnySelected || isExporting}
              className="shadow-xs flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Exportiere...' : 'Exportieren (.json)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
