/**
 * @file ResetModal.tsx
 * @description Modaler Dialog für das Zurücksetzen des Workspace.
 * Ermöglicht die Wahl zwischen "Auf Beispieldaten zurücksetzen" und "Vollständig leeren (Löschen)",
 * kombiniert mit granularer Auswahl der betroffenen Datenbereiche.
 * @module components/modals/ResetModal
 */

import React, { useState } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { ResetOptions, ResetTarget, DEFAULT_RESET_OPTIONS } from '@/types/finance';
import {
  RotateCcw,
  X,
  AlertTriangle,
  Landmark,
  Layers,
  Receipt,
  Trash2,
  Sparkles,
  Info,
} from 'lucide-react';

export interface ResetModalProps {
  /** Gibt an, ob der Dialog geöffnet ist */
  isOpen: boolean;
  /** Callback beim Schließen des Dialogs */
  onClose: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose }) => {
  const { accounts, categories, transactions, deletedTransactions, resetWorkspace } = useFinance();

  const [target, setTarget] = useState<ResetTarget>('seed');
  const [options, setOptions] = useState<Omit<ResetOptions, 'target'>>({
    resetAccounts: DEFAULT_RESET_OPTIONS.resetAccounts ?? true,
    resetCategories: DEFAULT_RESET_OPTIONS.resetCategories ?? true,
    resetTransactions: DEFAULT_RESET_OPTIONS.resetTransactions ?? true,
    resetDeletedTransactions: DEFAULT_RESET_OPTIONS.resetDeletedTransactions ?? true,
  });
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const toggleOption = (key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    setOptions({
      resetAccounts: true,
      resetCategories: true,
      resetTransactions: true,
      resetDeletedTransactions: true,
    });
  };

  const handleSelectCategoriesOnly = () => {
    setOptions({
      resetAccounts: false,
      resetCategories: true,
      resetTransactions: false,
      resetDeletedTransactions: false,
    });
  };

  const handleSelectTransactionsOnly = () => {
    setOptions({
      resetAccounts: false,
      resetCategories: false,
      resetTransactions: true,
      resetDeletedTransactions: true,
    });
  };

  const hasAnySelected = Object.values(options).some(Boolean);
  const isSeed = target === 'seed';

  const handleExecuteReset = async () => {
    try {
      setIsResetting(true);
      await resetWorkspace({
        target,
        ...options,
        includeSampleTransactions: isSeed && options.resetTransactions,
      });
      onClose();
    } catch (err) {
      console.error('Reset fehlgeschlagen:', err);
      alert('Fehler beim Zurücksetzen der Daten.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isSeed ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {isSeed ? <Sparkles className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="reset-modal-title" className="text-base font-bold text-slate-800">
                Workspace zurücksetzen
              </h2>
              <p className="text-xs text-slate-500">
                Wähle den Zielmodus und die gewünschten Datenbereiche aus.
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

        {/* Modus-Auswahl (Beispieldaten vs. Löschen) */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Zielzustand auswählen:
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Option 1: Beispieldaten */}
            <button
              type="button"
              onClick={() => setTarget('seed')}
              data-testid="reset-target-seed"
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                isSeed
                  ? 'shadow-xs border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Auf Beispieldaten</span>
              </div>
              <span className="mt-1 text-[11px] leading-tight text-slate-500">
                Stellt empfohlene Standard-Kategorien, Konto & Demo-Buchungen her.
              </span>
            </button>

            {/* Option 2: Löschen */}
            <button
              type="button"
              onClick={() => setTarget('empty')}
              data-testid="reset-target-empty"
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                !isSeed
                  ? 'shadow-xs border-rose-500 bg-rose-50/70 ring-1 ring-rose-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Vollständig leeren</span>
              </div>
              <span className="mt-1 text-[11px] leading-tight text-slate-500">
                Löscht ausgewählte Daten restlos für ein leeres Profil.
              </span>
            </button>
          </div>
        </div>

        {/* Schnellwahl */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 px-6 py-2 text-xs">
          <span className="font-medium text-slate-600">Bereiche auswählen:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Alles
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={handleSelectCategoriesOnly}
              className="font-medium text-slate-600 hover:text-slate-800 hover:underline"
            >
              Nur Kategorien
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={handleSelectTransactionsOnly}
              className="font-medium text-slate-600 hover:text-slate-800 hover:underline"
            >
              Nur Buchungen
            </button>
          </div>
        </div>

        {/* Hinweis- / Warnbox */}
        <div className="mx-6 mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed">
          {isSeed ? (
            <div className="flex items-start gap-2 text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <span className="font-bold">Beispieldaten:</span> Ausgewählte Bereiche werden mit
                den vorkonfigurierten Standarddaten initialisiert. Bisherige eigene Einträge in
                diesen Bereichen werden überschrieben.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <span className="font-bold">Achtung:</span> Ausgewählte Bereiche werden
                unwiderruflich und restlos gelöscht. Erstelle bei Bedarf vorher einen JSON-Export.
              </div>
            </div>
          )}
        </div>

        {/* Optionsliste */}
        <div className="max-h-[45vh] space-y-2 overflow-y-auto px-6 py-3">
          {/* 1. Kategorien */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.resetCategories}
              onChange={() => toggleOption('resetCategories')}
              className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Layers className="h-3.5 w-3.5 text-emerald-600" />
                  {isSeed ? 'Kategorien auf Standard zurücksetzen' : 'Kategorien restlos löschen'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isSeed
                  ? 'Stellt alle Standard-Kategorien, Hierarchien, Budgets und Regex-Regeln wieder her.'
                  : 'Entfernt alle Kategorien vollständig aus dem Workspace.'}
              </p>
            </div>
          </label>

          {/* 2. Konten */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.resetAccounts}
              onChange={() => toggleOption('resetAccounts')}
              className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Landmark className="h-3.5 w-3.5 text-blue-600" />
                  {isSeed ? 'Konten auf Standardkonto zurücksetzen' : 'Alle Konten löschen'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isSeed
                  ? 'Stellt das vorkonfigurierte Haupt-Girokonto mit Eröffnungssaldo wieder her.'
                  : 'Löscht alle Konten und hinterlegten Saldenverläufe.'}
              </p>
            </div>
          </label>

          {/* 3. Buchungen / Transaktionen */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.resetTransactions}
              onChange={() => toggleOption('resetTransactions')}
              className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                  {isSeed ? 'Beispiel-Buchungen laden' : 'Buchungen / Transaktionen löschen'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {transactions.length} {transactions.length === 1 ? 'Buchung' : 'Buchungen'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isSeed
                  ? 'Lädt 19 realistische Demo-Transaktionen zur sofortigen Analyse & Diagrammdarstellung.'
                  : 'Löscht alle importierten und manuell erfassten Buchungen unwiderruflich.'}
              </p>
            </div>
          </label>

          {/* 4. Papierkorb */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              checked={options.resetDeletedTransactions}
              onChange={() => toggleOption('resetDeletedTransactions')}
              className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  Papierkorb leeren
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                  {deletedTransactions.length}{' '}
                  {deletedTransactions.length === 1 ? 'Buchung' : 'Buchungen'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Entfernt alle gelöschten Buchungen dauerhaft aus der Datenbank.
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-xs text-slate-500">
            {hasAnySelected ? 'Bereiche ausgewählt' : 'Keine Bereiche ausgewählt'}
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
              onClick={handleExecuteReset}
              disabled={!hasAnySelected || isResetting}
              className={`shadow-xs flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                isSeed ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSeed ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {isResetting
                ? 'Wird zurückgesetzt...'
                : isSeed
                  ? 'Auf Beispieldaten zurücksetzen'
                  : 'Ausgewählte Bereiche löschen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
