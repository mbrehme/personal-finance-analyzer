/**
 * @file ResetModal.tsx
 * @description Modaler Dialog für das Zurücksetzen des Workspace.
 * Ermöglicht die Wahl zwischen "Auf Beispieldaten zurücksetzen" und "Vollständig leeren (Löschen)",
 * mit gruppierter Bereichswahl: "Konfiguration" (Kategorien & Konten) und "Buchungen" (Imported, Overrides, Splits),
 * während alle einzelnen Themen weiterhin differenziert auswählbar bleiben.
 * @module components/modals/ResetModal
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/domain';
import {
  ResetOptions,
  ResetTarget,
  DEFAULT_RESET_OPTIONS,
  isTransactionOverridden,
} from '@/types/finance';
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
  Split,
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
    resetOverrides: false,
    resetSplits: false,
    resetDeletedTransactions: DEFAULT_RESET_OPTIONS.resetDeletedTransactions ?? true,
  });
  const [isResetting, setIsResetting] = useState(false);

  // Zähle Buchungen mit aktiven Overrides (ohne reine Split-Zuordnung)
  const overridesCount = useMemo(() => {
    return transactions.filter(
      (t) =>
        !t.splitFromId &&
        (isTransactionOverridden(t) ||
          t.assignmentSource === 'manual' ||
          (t.originalValue !== undefined && t.value !== t.originalValue))
    ).length;
  }, [transactions]);

  // Zähle Split-Transaktionen (Split-Kinder)
  const splitsCount = useMemo(() => {
    return transactions.filter((t) => Boolean(t.splitFromId)).length;
  }, [transactions]);

  if (!isOpen) return null;

  const isSeed = target === 'seed';
  const hasAnySelected = Object.values(options).some(Boolean);

  const toggleOption = (key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectTarget = (newTarget: ResetTarget) => {
    setTarget(newTarget);
    if (newTarget === 'seed') {
      setOptions((prev) => ({
        ...prev,
        resetOverrides: false,
        resetSplits: false,
      }));
    } else {
      setOptions((prev) => ({
        ...prev,
        resetOverrides: true,
        resetSplits: true,
      }));
    }
  };

  // Bereichswähler: Alles auswählen
  const handleSelectAll = () => {
    setOptions({
      resetAccounts: true,
      resetCategories: true,
      resetTransactions: true,
      resetOverrides: !isSeed,
      resetSplits: !isSeed,
      resetDeletedTransactions: true,
    });
  };

  // Bereichswähler: Nur Konfiguration (Kategorien & Konten)
  const handleSelectConfigOnly = () => {
    setOptions({
      resetAccounts: true,
      resetCategories: true,
      resetTransactions: false,
      resetOverrides: false,
      resetSplits: false,
      resetDeletedTransactions: false,
    });
  };

  // Bereichswähler: Nur Buchungen (Importierte Buchungen, Overrides & Splits)
  const handleSelectTransactionsOnly = () => {
    setOptions({
      resetAccounts: false,
      resetCategories: false,
      resetTransactions: true,
      resetOverrides: true,
      resetSplits: true,
      resetDeletedTransactions: true,
    });
  };

  const isAllConfigSelected = Boolean(options.resetCategories && options.resetAccounts);
  const isAllTransactionsSelected = Boolean(
    options.resetTransactions &&
    options.resetOverrides &&
    options.resetSplits &&
    options.resetDeletedTransactions
  );

  const toggleAllConfig = () => {
    const next = !isAllConfigSelected;
    setOptions((prev) => ({
      ...prev,
      resetCategories: next,
      resetAccounts: next,
    }));
  };

  const toggleAllTransactions = () => {
    const next = !isAllTransactionsSelected;
    setOptions((prev) => ({
      ...prev,
      resetTransactions: next,
      resetOverrides: next,
      resetSplits: next,
      resetDeletedTransactions: next,
    }));
  };

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
                Wähle den Zielmodus und die gewünschten Bereiche aus.
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
              onClick={() => handleSelectTarget('seed')}
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
              onClick={() => handleSelectTarget('empty')}
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

        {/* Bereichswähler (Schnellwahl) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 px-6 py-2 text-xs">
          <span className="font-medium text-slate-600">Bereichsauswahl:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              data-testid="reset-select-all"
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Alles
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={handleSelectConfigOnly}
              data-testid="reset-select-config"
              className="font-medium text-slate-600 hover:text-slate-800 hover:underline"
            >
              Nur Konfiguration
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={handleSelectTransactionsOnly}
              data-testid="reset-select-transactions"
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
                unwiderruflich gelöscht. Erstelle bei Bedarf vorher einen JSON-Export.
              </div>
            </div>
          )}
        </div>

        {/* Detail-Optionen, gruppiert nach Konfiguration und Buchungen */}
        <div className="max-h-[45vh] space-y-4 overflow-y-auto px-6 py-3">
          {/* GRUPPE 1: KONFIGURATION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                Konfiguration
              </span>
              <button
                type="button"
                onClick={toggleAllConfig}
                data-testid="reset-group-toggle-config"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {isAllConfigSelected ? 'Keine' : 'Alle'}
              </button>
            </div>

            {/* Kategorien */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetCategories}
                onChange={() => toggleOption('resetCategories')}
                data-testid="reset-option-categories"
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
                    ? 'Stellt Standard-Kategorien (Wohnen, Mobilität, etc.) inklusive Zuordnungsregeln wieder her.'
                    : 'Löscht alle Kategorien und deren automatische Match-Regeln.'}
                </p>
              </div>
            </label>

            {/* Konten */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetAccounts}
                onChange={() => toggleOption('resetAccounts')}
                data-testid="reset-option-accounts"
                className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                  isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Landmark className="h-3.5 w-3.5 text-blue-600" />
                    {isSeed ? 'Konten auf Standard zurücksetzen' : 'Konten restlos löschen'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                    {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {isSeed
                    ? 'Erstellt ein Standard-Girokonto mit Initial-Saldo.'
                    : 'Löscht alle Konten und hinterlegten Saldenverläufe.'}
                </p>
              </div>
            </label>
          </div>

          {/* GRUPPE 2: BUCHUNGEN */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                Buchungen
              </span>
              <button
                type="button"
                onClick={toggleAllTransactions}
                data-testid="reset-group-toggle-transactions"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {isAllTransactionsSelected ? 'Keine' : 'Alle'}
              </button>
            </div>

            {/* Importierte Buchungen / Beispiel-Buchungen */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetTransactions}
                onChange={() => toggleOption('resetTransactions')}
                data-testid="reset-option-transactions"
                className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${
                  isSeed ? 'text-blue-600 focus:ring-blue-500' : 'text-rose-600 focus:ring-rose-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                    {isSeed ? 'Beispiel-Buchungen laden' : 'Importierte Transaktionen löschen'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                    {transactions.length} {transactions.length === 1 ? 'Buchung' : 'Buchungen'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {isSeed
                    ? 'Lädt 19 realistische Demo-Transaktionen zur sofortigen Analyse & Diagrammdarstellung.'
                    : 'Löscht alle importierten Buchungen vollständig aus dem Workspace.'}
                </p>
              </div>
            </label>

            {/* Overrides */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetOverrides}
                onChange={() => toggleOption('resetOverrides')}
                data-testid="reset-option-overrides"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                    Overrides
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                    {overridesCount} {overridesCount === 1 ? 'Override' : 'Overrides'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Setzt manuell geänderte Felder auf Bank-Originaldaten zurück und führt ein
                  Kategorien-Rematching durch.
                </p>
              </div>
            </label>

            {/* Splits */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetSplits}
                onChange={() => toggleOption('resetSplits')}
                data-testid="reset-option-splits"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Split className="h-3.5 w-3.5 text-indigo-600" />
                    Splits
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                    {splitsCount} {splitsCount === 1 ? 'Split-Buchung' : 'Split-Buchungen'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Löst Split-Buchungen auf, entfernt Teilbuchungen und stellt den vollen
                  Ursprungsbetrag der Buchung wieder her.
                </p>
              </div>
            </label>

            {/* Papierkorb */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={options.resetDeletedTransactions}
                onChange={() => toggleOption('resetDeletedTransactions')}
                data-testid="reset-option-deleted"
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
                  : 'Ausgewählte Bereiche zurücksetzen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
