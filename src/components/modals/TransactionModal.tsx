/**
 * @file TransactionModal.tsx
 * @description Modaler Dialog zum Erstellen, Bearbeiten (Überschreiben) und Aufteilen (Split)
 * von Transaktionen inklusive Side-by-Side-Vergleich von Original-Bankdaten und Anpassungen.
 * @module components/modals/TransactionModal
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Account, Category, TransactionType, ISODateString } from '@/types/finance';
import { MoneyInput } from '../MoneyInput';
import { formatMoney } from '@/utils/moneyUtils';
import { X, AlertCircle, Scissors, Pencil, Plus, RotateCcw, Info } from 'lucide-react';

/**
 * Eigenschaften für den TransactionModal-Dialog.
 */
export interface TransactionModalProps {
  /** Steuert die Sichtbarkeit des Modals */
  isOpen: boolean;
  /** Callback beim Schließen des Modals */
  onClose: () => void;
  /** Modus: Neuanlage ('create'), Bearbeiten/Überschreiben ('edit') oder Aufteilen ('split') */
  mode: 'create' | 'edit' | 'split';
  /** Vorhandene Transaktion bei 'edit' oder 'split' */
  initialTransaction?: Transaction | null;
  /** Liste aller verfügbaren Konten */
  accounts: Account[];
  /** Liste aller verfügbaren Kategorien */
  categories: Category[];
  /** Callback zum Speichern einer erstellten oder bearbeiteten Buchung */
  onSave: (txData: Omit<Transaction, 'id'> | Transaction) => Promise<void>;
  /** Callback zum Durchführen eines Buchungs-Splits */
  onSplit?: (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ) => Promise<void>;
}

/**
 * Modaler Dialog zur Erfassung, Bearbeitung und Aufteilung von Buchungen.
 *
 * @param {TransactionModalProps} props - Komponenten-Props
 * @returns {React.ReactElement | null} Das gerenderte Modal oder null wenn geschlossen
 * @example
 * <TransactionModal
 *   isOpen={isModalOpen}
 *   mode="split"
 *   initialTransaction={selectedTx}
 *   accounts={accounts}
 *   categories={categories}
 *   onClose={() => setIsModalOpen(false)}
 *   onSave={handleSave}
 *   onSplit={handleSplit}
 * />
 */
export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialTransaction,
  accounts,
  categories,
  onSave,
  onSplit,
}) => {
  // ================== FORMULAR-ZUSTÄNDE ==================
  const [accountId, setAccountId] = useState<string>('');
  const [valueDate, setValueDate] = useState<string>('');
  const [type, setType] = useState<TransactionType>('outbound');
  const [amount, setAmount] = useState<number>(0);
  const [receiver, setReceiver] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Split-spezifische Zustände
  const [splitAmount, setSplitAmount] = useState<number>(0);
  const [splitSubject, setSplitSubject] = useState<string>('');
  const [splitReceiver, setSplitReceiver] = useState<string>('');
  const [splitCategoryId, setSplitCategoryId] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Original-Bankwerte der Buchung (falls importiert)
  const originalValueDate = initialTransaction?.originalValueDate ?? initialTransaction?.valueDate;
  const originalValue = initialTransaction?.originalValue ?? initialTransaction?.value ?? 0;
  const originalSubject = initialTransaction?.originalSubject ?? initialTransaction?.subject ?? '';
  const originalReceiver =
    initialTransaction?.originalReceiver ?? initialTransaction?.receiver ?? '';
  const originalIban = initialTransaction?.originalIban ?? initialTransaction?.iban ?? '';
  const isImportedWithBankData = Boolean(initialTransaction?.rawFingerprint);

  // Formular initialisieren, wenn das Modal geöffnet wird oder sich die Transaktion ändert
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);

    if (mode === 'create') {
      setAccountId(accounts[0]?.id || '');
      setValueDate(new Date().toISOString().substring(0, 10));
      setType('outbound');
      setAmount(0);
      setReceiver('');
      setSubject('');
      setCategoryId(null);
    } else if (initialTransaction) {
      setAccountId(initialTransaction.accountId);
      setValueDate(initialTransaction.valueDate);
      setType(initialTransaction.type || (initialTransaction.value >= 0 ? 'inbound' : 'outbound'));
      setAmount(Math.abs(initialTransaction.value));
      setReceiver(initialTransaction.receiver || initialTransaction.issuer || '');
      setSubject(initialTransaction.subject || '');
      setCategoryId(initialTransaction.categoryId ?? initialTransaction.bucketId ?? null);

      if (mode === 'split') {
        setSplitAmount(0);
        setSplitReceiver(initialTransaction.receiver || initialTransaction.issuer || '');
        setSplitSubject(`${initialTransaction.subject || ''} (Teilbetrag)`.trim());
        setSplitCategoryId(null);
      }
    }
  }, [isOpen, mode, initialTransaction, accounts]);

  // ================== SPLIT-BERECHNUNG & VALIDIERUNG ==================
  const origAbs = Math.abs(originalValue || initialTransaction?.value || 0);
  const remainingSplitAmount = useMemo(() => {
    return Math.round((origAbs - splitAmount) * 100) / 100;
  }, [origAbs, splitAmount]);

  const splitValidationError = useMemo(() => {
    if (mode !== 'split') return null;
    if (splitAmount <= 0) {
      return 'Der Teilbetrag muss größer als 0,00 € sein.';
    }
    if (splitAmount >= origAbs) {
      return 'Der Teilbetrag darf den Originalbetrag nicht erreichen oder überschreiten. Der verbleibende Restbetrag kann nicht unter 0,00 € fallen.';
    }
    return null;
  }, [mode, splitAmount, origAbs]);

  if (!isOpen) return null;

  // ================== SPEICHERN ==================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'split') {
      if (splitValidationError) {
        setError(splitValidationError);
        return;
      }
      if (!initialTransaction || !onSplit) return;

      try {
        setSaving(true);
        await onSplit(initialTransaction.id, splitAmount, {
          subject: splitSubject.trim(),
          receiver: splitReceiver.trim(),
          categoryId: splitCategoryId,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Aufteilen der Buchung.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Modus 'create' oder 'edit'
    if (!accountId) {
      setError('Bitte wähle ein Konto aus.');
      return;
    }
    if (!valueDate) {
      setError('Bitte gib ein Valutadatum an.');
      return;
    }
    if (amount <= 0) {
      setError('Der Betrag muss größer als 0,00 € sein.');
      return;
    }

    const signedValue = type === 'outbound' ? -Math.abs(amount) : Math.abs(amount);

    try {
      setSaving(true);
      if (mode === 'create') {
        await onSave({
          accountId,
          valueDate: valueDate as ISODateString,
          bookingDate: valueDate as ISODateString,
          issuer: type === 'inbound' ? receiver : '',
          receiver: type === 'outbound' ? receiver : '',
          subject: subject.trim(),
          type,
          iban: '',
          value: signedValue,
          categoryId,
          assignmentSource: categoryId ? 'manual' : 'unassigned',
        });
      } else if (initialTransaction) {
        await onSave({
          ...initialTransaction,
          accountId,
          valueDate: valueDate as ISODateString,
          type,
          value: signedValue,
          receiver: type === 'outbound' ? receiver : initialTransaction.receiver,
          issuer: type === 'inbound' ? receiver : initialTransaction.issuer,
          subject: subject.trim(),
          categoryId,
          assignmentSource: categoryId ? 'manual' : 'unassigned',
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern der Buchung.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
    >
      <div
        className={`w-full rounded-2xl border border-slate-200 bg-white shadow-2xl ${
          mode === 'split' || (mode === 'edit' && isImportedWithBankData) ? 'max-w-4xl' : 'max-w-xl'
        } my-8 flex flex-col overflow-hidden`}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-xl p-2 ${
                mode === 'split'
                  ? 'bg-amber-100 text-amber-600'
                  : mode === 'edit'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {mode === 'split' ? (
                <Scissors className="h-5 w-5" />
              ) : mode === 'edit' ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 id="modal-headline" className="text-lg font-bold text-slate-800">
                {mode === 'split'
                  ? 'Buchung aufteilen (Split)'
                  : mode === 'edit'
                    ? 'Buchung bearbeiten'
                    : 'Neue Buchung erfassen'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'split'
                  ? 'Teile diese Buchung in zwei separate Kategorien oder Zwecke auf.'
                  : mode === 'edit'
                    ? 'Passe Buchungsdetails an. Originaldaten der Bank bleiben erhalten.'
                    : 'Erstelle eine neue manuelle Buchung ohne Bankimport.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FEHLERMELDUNG */}
        {error && (
          <div className="mx-6 mt-4 flex items-start space-x-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto p-6">
          {/* ============================================================= */}
          {/* FALL 1: SPLIT MODUS (SIDE-BY-SIDE)                            */}
          {/* ============================================================= */}
          {mode === 'split' && initialTransaction && (
            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
              {/* LINKE SPALTE: ORIGINALBUCHUNG */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Originalbuchung
                    </span>
                    <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {initialTransaction.origin === 'manual' ? 'Manuell' : 'Bank-Import'}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="block text-[11px] font-medium text-slate-400">
                        Ursprünglicher Betrag:
                      </span>
                      <span className="font-mono text-base font-bold text-slate-900">
                        {formatMoney(initialTransaction.value)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-400">
                        Zahlungspartner:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {initialTransaction.receiver || initialTransaction.issuer || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-400">
                        Verwendungszweck:
                      </span>
                      <span className="break-words text-slate-600">
                        {initialTransaction.subject || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HIGHLIGHT-BOX: VERBLEIBENDER RESTBETRAG */}
                <div
                  className={`mt-6 rounded-xl border p-4 transition-all ${
                    remainingSplitAmount > 0
                      ? 'border-emerald-200 bg-emerald-50/90'
                      : 'border-rose-200 bg-rose-50/90'
                  }`}
                >
                  <span className="block text-[11px] font-semibold text-slate-600">
                    Verbleibender Betrag des Originals:
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span
                      className={`font-mono text-xl font-bold ${
                        remainingSplitAmount > 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {formatMoney((initialTransaction.value < 0 ? -1 : 1) * remainingSplitAmount)}
                    </span>
                  </div>
                  {remainingSplitAmount <= 0 ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Der Restbetrag kann nicht unter 0,00 € fallen!
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Dieser Betrag verbleibt auf der ursprünglichen Buchung.
                    </p>
                  )}
                </div>
              </div>

              {/* RECHTE SPALTE: NEUE SPLIT-TEILBUCHUNG */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50/30 p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Neue Teilbuchung (Split)
                    </span>
                    <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Wird neu angelegt
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* SPLIT BETRAG */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Abzuspaltender Betrag (€) *
                      </label>
                      <MoneyInput
                        value={splitAmount}
                        onChange={(val) => setSplitAmount(Math.max(0, val))}
                        className="w-full"
                        placeholder="0,00"
                        autoFocus
                      />
                      {splitValidationError && (
                        <span className="mt-1 block text-xs text-rose-600">
                          {splitValidationError}
                        </span>
                      )}
                    </div>

                    {/* SPLIT VERWENDUNGSZWECK */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Verwendungszweck für Split *
                      </label>
                      <input
                        type="text"
                        value={splitSubject}
                        onChange={(e) => setSplitSubject(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        placeholder="Zweck des abgespaltenen Teils..."
                        required
                      />
                    </div>

                    {/* SPLIT EMPFÄNGER */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Zahlungspartner / Empfänger
                      </label>
                      <input
                        type="text"
                        value={splitReceiver}
                        onChange={(e) => setSplitReceiver(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        placeholder="Empfänger..."
                      />
                    </div>

                    {/* SPLIT KATEGORIE */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Kategorie für Teilbuchung
                      </label>
                      <select
                        value={splitCategoryId || ''}
                        onChange={(e) => setSplitCategoryId(e.target.value || null)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Keine Kategorie (Nicht zugewiesen)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* FALL 2: EDIT MODUS MIT SIDE-BY-SIDE ORIGINALDATEN-VERGLEICH   */}
          {/* ============================================================= */}
          {mode === 'edit' && isImportedWithBankData && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* LINKE SPALTE: SCHREIBGESCHÜTZTE BANK-ORIGINALDATEN */}
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Bankdaten (Original)
                  </span>
                  <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Unveränderbar
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-xs text-slate-400">Valutadatum:</span>
                    <span className="font-mono text-xs text-slate-800">{originalValueDate}</span>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-400">Originalbetrag der Bank:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatMoney(originalValue)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-400">Empfänger / Auftraggeber:</span>
                    <span className="font-semibold text-slate-800">{originalReceiver || '-'}</span>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-400">Verwendungszweck (Roh):</span>
                    <span className="block break-words rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-700 shadow-sm">
                      {originalSubject || '-'}
                    </span>
                  </div>

                  {originalIban && (
                    <div>
                      <span className="block text-xs text-slate-400">Gegen-IBAN:</span>
                      <span className="font-mono text-xs text-slate-700">{originalIban}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-start space-x-2 rounded-xl border border-blue-200/60 bg-blue-50/70 p-3 text-xs text-blue-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>
                    Die Bankdaten bleiben auch bei weiteren CSV-Imports geschützt. Rechts kannst du
                    deine Werte anpassen.
                  </span>
                </div>
              </div>

              {/* RECHTE SPALTE: EDITIERBARE ANPASSUNGEN */}
              <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-5">
                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    Deine Anpassungen
                  </span>
                  <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    Editierbar
                  </span>
                </div>

                {/* DATUM */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">Valutadatum</label>
                    {valueDate !== originalValueDate && (
                      <button
                        type="button"
                        onClick={() => setValueDate(originalValueDate || '')}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Auf Bankwert zurücksetzen"
                      >
                        <RotateCcw className="h-3 w-3" /> Zurücksetzen
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={valueDate}
                    onChange={(e) => setValueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* BETRAG & TYP */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">Betrag & Typ</label>
                    {amount !== Math.abs(originalValue) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(Math.abs(originalValue));
                          setType(originalValue >= 0 ? 'inbound' : 'outbound');
                        }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Auf Bankwert zurücksetzen"
                      >
                        <RotateCcw className="h-3 w-3" /> Zurücksetzen
                      </button>
                    )}
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('outbound')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        type === 'outbound'
                          ? 'border-rose-300 bg-rose-50 font-semibold text-rose-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Ausgabe (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('inbound')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        type === 'inbound'
                          ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Einnahme (+)
                    </button>
                  </div>
                  <MoneyInput
                    value={amount}
                    onChange={(val) => setAmount(Math.max(0, val))}
                    className="w-full"
                    placeholder="0,00"
                  />
                </div>

                {/* EMPFÄNGER */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      Empfänger / Absender
                    </label>
                    {receiver !== originalReceiver && (
                      <button
                        type="button"
                        onClick={() => setReceiver(originalReceiver)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Auf Bankwert zurücksetzen"
                      >
                        <RotateCcw className="h-3 w-3" /> Zurücksetzen
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Empfängername..."
                  />
                </div>

                {/* VERWENDUNGSZWECK */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">Verwendungszweck</label>
                    {subject !== originalSubject && (
                      <button
                        type="button"
                        onClick={() => setSubject(originalSubject)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Auf Bankwert zurücksetzen"
                      >
                        <RotateCcw className="h-3 w-3" /> Zurücksetzen
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Buchungstext..."
                    required
                  />
                </div>

                {/* KATEGORIE */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Kategorie</label>
                  <select
                    value={categoryId || ''}
                    onChange={(e) => setCategoryId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Keine Kategorie (Nicht zugewiesen)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* FALL 3: CREATE MODUS ODER EDIT VON REIN MANUELLER BUCHUNG     */}
          {/* ============================================================= */}
          {(mode === 'create' || (mode === 'edit' && !isImportedWithBankData)) && (
            <div className="space-y-4">
              {/* KONTO AUSWAHL */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Konto *
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DATUM & TYP */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Valutadatum *
                  </label>
                  <input
                    type="date"
                    value={valueDate}
                    onChange={(e) => setValueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Buchungstyp
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('outbound')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        type === 'outbound'
                          ? 'border-rose-300 bg-rose-50 font-semibold text-rose-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Ausgabe (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('inbound')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        type === 'inbound'
                          ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Einnahme (+)
                    </button>
                  </div>
                </div>
              </div>

              {/* BETRAG */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Betrag (€) *
                </label>
                <MoneyInput
                  value={amount}
                  onChange={(val) => setAmount(Math.max(0, val))}
                  className="w-full"
                  placeholder="0,00"
                />
              </div>

              {/* EMPFÄNGER / ZAHLUNGSPARTNER */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {type === 'inbound' ? 'Auftraggeber / Absender' : 'Empfänger'}
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder={type === 'inbound' ? 'z. B. Arbeitgeber' : 'z. B. Supermarkt'}
                />
              </div>

              {/* VERWENDUNGSZWECK */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Verwendungszweck *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Beschreibung der Buchung..."
                  required
                />
              </div>

              {/* KATEGORIE */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kategorie
                </label>
                <select
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value || null)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keine Kategorie (Nicht zugewiesen)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* MODAL FOOTER */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || (mode === 'split' && Boolean(splitValidationError))}
              className={`flex items-center space-x-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${
                mode === 'split' && Boolean(splitValidationError)
                  ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {saving ? (
                <span>Wird gespeichert...</span>
              ) : mode === 'split' ? (
                <>
                  <Scissors className="h-4 w-4" />
                  <span>Jetzt aufteilen</span>
                </>
              ) : mode === 'edit' ? (
                <>
                  <Pencil className="h-4 w-4" />
                  <span>Änderungen speichern</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Buchung erfassen</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
