/**
 * @file TransactionDetailModal.tsx
 * @description Modaler Dialog zur Anzeige aller Details einer Transaktion inklusive
 * zusammengesetztem Suchstring (Compound Key für Regex & Volltextsuche), Bank-Rohdaten und Revisionsverlauf.
 * @module components/modals/TransactionDetailModal
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Transaction,
  Account,
  Category,
  ISODateString,
  normalizeIban,
  buildCompoundSearchField,
  getTransactionAccountInfo,
  getTransactionOrigin,
  isTransactionOverridden,
  resetTransactionToOriginal,
} from '@/types/finance';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/ui/components/IconRenderer';
import {
  X,
  Copy,
  Check,
  Search,
  Landmark,
  FolderTree,
  Tag,
  Calendar,
  Scissors,
  FileText,
  Clock,
  Fingerprint,
  RotateCcw,
  Lock,
  Save,
  AlertCircle,
} from 'lucide-react';

export interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSave?: (updatedTx: Transaction) => Promise<void>;
  onEdit?: (tx: Transaction) => void;
  onSplit?: (tx: Transaction) => void;
  onReset?: (txId: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories,
  onSave,
  onEdit: _deprecatedOnEdit,
  onSplit,
  onReset,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ================== INLINE-EDIT FORM STATES ==================
  const [subject, setSubject] = useState<string>('');
  const [partner, setPartner] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Nur reale Bankkonten stehen als Buchungskonto zur Verfügung
  const realAccounts = useMemo(
    () => accounts.filter((acc) => acc.accountType !== 'virtual'),
    [accounts]
  );

  // Strukturierte Kategoriepfade für das Dropdown
  const categoryOptions = useMemo(() => {
    const getPathName = (c: Category): string => {
      const parts = [c.name];
      let currentParentId = c.parentId;
      while (currentParentId) {
        const parent = categories.find((p) => p.id === currentParentId);
        if (parent) {
          if (parent.parentId !== null) {
            parts.unshift(parent.name);
          }
          currentParentId = parent.parentId;
        } else {
          break;
        }
      }
      return parts.join(' > ');
    };

    return categories
      .map((c) => ({
        id: c.id,
        name: getPathName(c),
        raw: c,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [categories]);

  useEffect(() => {
    if (!isOpen || !transaction) return;
    setError(null);
    setSaving(false);
    setSubject(transaction.subject || '');
    setPartner(transaction.receiver || transaction.issuer || '');
    setCategoryId(transaction.categoryId ?? null);
    setDate(transaction.date || '');

    const matchingAcc = transaction.accountIban
      ? realAccounts.find(
          (a) => a.iban && normalizeIban(a.iban) === normalizeIban(transaction.accountIban)
        )
      : undefined;
    setAccountId(matchingAcc?.id || realAccounts[0]?.id || '');
  }, [isOpen, transaction, realAccounts]);

  const isOutbound = (transaction?.value ?? 0) < 0;
  const isSplitChild = Boolean(transaction?.splitFromId);
  const isOverridden = transaction ? isTransactionOverridden(transaction) : false;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const selectedRealAccount = useMemo(
    () => realAccounts.find((a) => a.id === accountId),
    [realAccounts, accountId]
  );

  // Dynamischer Suchstring basierend auf den aktuellen Eingaben
  const compoundSearchString = useMemo(() => {
    if (!transaction) return '';
    const previewDate = (date || transaction.date) as ISODateString;
    const previewTx: Transaction = {
      ...transaction,
      subject: subject.trim(),
      receiver: isOutbound ? partner.trim() : transaction.receiver ? partner.trim() : '',
      issuer: !isOutbound ? partner.trim() : transaction.issuer ? partner.trim() : '',
      date: previewDate,
    };
    return buildCompoundSearchField(previewTx);
  }, [transaction, subject, partner, isOutbound, date]);

  const accountInfo = useMemo(() => {
    if (!transaction) {
      return { primaryAccount: null, counterAccount: null, virtualAccounts: [] };
    }
    return getTransactionAccountInfo(
      {
        ...transaction,
        accountIban: selectedRealAccount?.iban || transaction.accountIban,
      },
      accounts
    );
  }, [transaction, selectedRealAccount, accounts]);

  const primaryVirtuals = useMemo(
    () =>
      accountInfo.primaryAccount
        ? accountInfo.virtualAccounts.filter(
            (v) => v.parentAccountId === accountInfo.primaryAccount?.id
          )
        : [],
    [accountInfo]
  );

  const counterVirtuals = useMemo(
    () =>
      accountInfo.counterAccount
        ? accountInfo.virtualAccounts.filter(
            (v) => v.parentAccountId === accountInfo.counterAccount?.id
          )
        : [],
    [accountInfo]
  );

  if (!isOpen || !transaction) return null;

  const tx = transaction;

  const copyToClipboard = async (text: string, keyName: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(keyName);
        setTimeout(() => setCopiedKey(null), 2000);
      }
    } catch {
      // Fallback ignore clipboard errors
    }
  };

  const handleResetToOriginal = () => {
    if (!tx) return;
    const restored = resetTransactionToOriginal(tx);
    setSubject(restored.subject || '');
    setPartner(restored.receiver || restored.issuer || '');
    setDate(restored.date || '');
    setCategoryId(null);

    const matchingAcc = restored.accountIban
      ? realAccounts.find(
          (a) => a.iban && normalizeIban(a.iban) === normalizeIban(restored.accountIban)
        )
      : undefined;
    setAccountId(matchingAcc?.id || realAccounts[0]?.id || '');

    if (onReset) {
      onReset(tx.id);
    }
  };

  const handleSave = async () => {
    if (!tx) return;
    setError(null);

    try {
      setSaving(true);
      const targetAccountIban = selectedRealAccount?.iban || tx.accountIban;

      const initialPartner = (tx.receiver || tx.issuer || '').trim();
      const trimmedPartner = partner.trim();
      const isPartnerFieldChanged = trimmedPartner !== initialPartner;

      let finalReceiver = tx.receiver;
      let finalIssuer = tx.issuer;

      if (isPartnerFieldChanged) {
        if (tx.receiver) {
          finalReceiver = trimmedPartner;
        } else if (tx.issuer) {
          finalIssuer = trimmedPartner;
        } else {
          finalReceiver = isOutbound ? trimmedPartner : '';
          finalIssuer = !isOutbound ? trimmedPartner : '';
        }
      }

      const initialCategoryId = tx.categoryId ?? null;
      const isCategoryFieldChanged = categoryId !== initialCategoryId;
      const finalDate = (date || tx.date) as ISODateString;

      const updatedTx: Transaction = {
        ...tx,
        accountIban: targetAccountIban,
        date: finalDate,
        subject: subject.trim(),
        receiver: finalReceiver,
        issuer: finalIssuer,
        categoryId,
        assignmentSource: isCategoryFieldChanged
          ? categoryId
            ? 'manual'
            : 'unassigned'
          : tx.assignmentSource,
      };

      if (onSave) {
        await onSave(updatedTx);
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
      aria-labelledby="detail-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 id="detail-modal-title" className="text-base font-bold text-slate-800">
                Buchungsdetails
              </h3>
              <p className="font-mono text-xs text-slate-500">ID: {tx.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollbarer Inhaltsbereich */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs text-slate-700">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Betrag & Status Highlight (Betrag nicht direkt editierbar) */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span>Betrag</span>
                <span
                  className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                  title="Der Betrag kann nicht direkt überschrieben werden, sondern nur aufgeteilt (Split)."
                >
                  <Lock className="h-3 w-3 text-slate-500" />
                  Fest (nur über Split änderbar)
                </span>
              </div>
              <div
                className={`font-mono text-2xl font-extrabold ${
                  isOutbound ? 'text-slate-900' : 'text-emerald-600'
                }`}
              >
                {formatMoney(tx.value, { signDisplay: 'always' })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(() => {
                const origin = getTransactionOrigin(tx);
                if (origin === 'split') {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">
                      <Scissors className="h-3 w-3" /> Split-Teilbetrag
                    </span>
                  );
                }
                if (origin === 'override') {
                  return (
                    <span
                      className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800"
                      title="Manuell angepasste Buchung (Override)"
                    >
                      Override
                    </span>
                  );
                }
                return (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    Bank-Import
                  </span>
                );
              })()}
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  isOutbound ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isOutbound ? 'Ausgabe' : 'Einnahme'}
              </span>
            </div>
          </div>

          {/* Suchstring / Matching-Key */}
          <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-blue-900">
                <Search className="h-4 w-4 text-blue-600" />
                Suchstring (Compound Key für Suche & Regex)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(compoundSearchString, 'searchString')}
                className="shadow-xs inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                title="Suchstring kopieren"
              >
                {copiedKey === 'searchString' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Kopieren
                  </>
                )}
              </button>
            </div>
            <div className="select-text break-all rounded-lg border border-blue-200 bg-white p-2.5 font-mono text-xs text-blue-950">
              {compoundSearchString}
            </div>
            <p className="text-[11px] leading-relaxed text-blue-700/80">
              Gegen diesen zusammengesetzten String laufen sowohl die Volltextsuche als auch die
              automatischen Regex-Muster der Kategorien.
            </p>
          </div>

          {/* Basisdaten: Text, Partner, Datum */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="edit-tx-subject" className="font-semibold text-slate-500">
                Verwendungszweck
              </label>
              <input
                id="edit-tx-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-medium text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Verwendungszweck eingeben..."
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-tx-partner" className="font-semibold text-slate-500">
                {isOutbound ? 'Empfänger / Begünstigter' : 'Auftraggeber / Absender'}
              </label>
              <input
                id="edit-tx-partner"
                type="text"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-medium text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={isOutbound ? 'Empfänger...' : 'Auftraggeber...'}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label
                htmlFor="edit-tx-valuta"
                className="flex items-center gap-1 font-semibold text-slate-500"
              >
                <Calendar className="h-3.5 w-3.5" /> Wertstellungsdatum (Valuta)
              </label>
              <input
                id="edit-tx-valuta"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-medium text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Konten & IBAN */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Landmark className="h-4 w-4 text-slate-600" />
              Kontozuordnung & IBAN
            </span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="edit-tx-account" className="font-semibold text-slate-500">
                  Buchungskonto
                </label>
                <select
                  id="edit-tx-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {realAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} {acc.iban ? `(${acc.iban})` : ''}
                    </option>
                  ))}
                </select>

                {selectedRealAccount && (
                  <div className="space-y-1.5 pt-0.5">
                    <p className="select-all break-all rounded-lg border border-slate-200 bg-slate-50/50 p-2 font-mono text-[11px] text-slate-700">
                      IBAN: {selectedRealAccount.iban || tx.accountIban || 'Keine IBAN angegeben'}
                    </p>

                    {primaryVirtuals.length > 0 && (
                      <div className="space-y-1 pl-1 pt-0.5">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <FolderTree className="h-3 w-3 text-purple-600" />
                          Virtuelle Unterkonten
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {primaryVirtuals.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700"
                            >
                              <IconRenderer
                                name={v.icon}
                                style={{ color: v.color }}
                                className="h-3.5 w-3.5"
                              />
                              {v.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-slate-500">Gegenkonto</span>
                <p className="select-all break-all rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-mono text-xs font-medium text-slate-800">
                  {tx.iban || 'Keine Gegenkonto-IBAN'}
                </p>
                {accountInfo.counterAccount ? (
                  <div className="space-y-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                      <IconRenderer
                        name={accountInfo.counterAccount.icon}
                        style={{ color: accountInfo.counterAccount.color }}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span>{accountInfo.counterAccount.name}</span>
                    </span>

                    {counterVirtuals.length > 0 && (
                      <div className="space-y-1 pl-1 pt-0.5">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <FolderTree className="h-3 w-3 text-purple-600" />
                          Virtuelles Unterkonto
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {counterVirtuals.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700"
                            >
                              <IconRenderer
                                name={v.icon}
                                style={{ color: v.color }}
                                className="h-3.5 w-3.5"
                              />
                              {v.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Externes Konto (nicht verwaltet)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kategorie & Zuweisung */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <label
              htmlFor="edit-tx-category"
              className="flex items-center gap-1.5 font-bold text-slate-800"
            >
              <Tag className="h-4 w-4 text-slate-600" />
              Kategorie
            </label>
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  id="edit-tx-category"
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(Keine Kategorie zugewiesen)</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>

                {selectedCategory && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                    <IconRenderer
                      name={selectedCategory.icon}
                      style={{ color: selectedCategory.color }}
                      className="h-3.5 w-3.5"
                    />
                    {selectedCategory.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px]">
                <span className="text-slate-500">Status / Herkunft:</span>
                {categoryId !== (tx.categoryId ?? null) ? (
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                    Wird als manuell zugewiesen gespeichert
                  </span>
                ) : (
                  <>
                    {tx.assignmentSource === 'auto_regex' && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                        Automatisch via Regex
                      </span>
                    )}
                    {tx.assignmentSource === 'manual' && (
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
                        Manuell zugewiesen
                      </span>
                    )}
                    {(!tx.assignmentSource || tx.assignmentSource === 'unassigned') && (
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                        Nicht zugewiesen
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Import- & Rohdaten-Metadaten */}
          {(tx.importFilename || tx.rawFingerprint || isOverridden) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Clock className="h-4 w-4 text-slate-500" />
                Import- & Revisions-Metadaten
              </span>

              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                {tx.importFilename && (
                  <div>
                    <span className="text-slate-500">Quelldatei: </span>
                    <span className="font-mono text-slate-800">{tx.importFilename}</span>
                  </div>
                )}
                {tx.dayIndex !== undefined && (
                  <div>
                    <span className="text-slate-500">Tages-Index: </span>
                    <span className="font-mono font-semibold text-slate-800">
                      #{tx.dayIndex + 1}
                    </span>
                  </div>
                )}
                {tx.importedAt && (
                  <div>
                    <span className="text-slate-500">Importiert am: </span>
                    <span className="font-mono text-slate-800">
                      {new Date(tx.importedAt).toLocaleString('de-DE')}
                    </span>
                  </div>
                )}
                {tx.rawFingerprint && (
                  <div className="flex items-center gap-1">
                    <Fingerprint className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Fingerprint: </span>
                    <span className="select-all font-mono text-slate-800">{tx.rawFingerprint}</span>
                  </div>
                )}
              </div>

              {/* Originale Rohdaten bei Abweichung */}
              {isOverridden && (
                <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-[11px]">
                  <span className="font-semibold text-slate-600">Ursprüngliche Bank-Rohdaten:</span>
                  <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-slate-600">
                    {tx.originalSubject !== undefined && (
                      <p>
                        <span className="text-slate-400">Zweck:</span> {tx.originalSubject}
                      </p>
                    )}
                    {tx.originalReceiver !== undefined && (
                      <p>
                        <span className="text-slate-400">Partner:</span> {tx.originalReceiver}
                      </p>
                    )}
                    {tx.originalValue !== undefined && (
                      <p>
                        <span className="text-slate-400">Betrag:</span> {tx.originalValue} €
                      </p>
                    )}
                    {tx.originalDate !== undefined && (
                      <p>
                        <span className="text-slate-400">Datum (Wertstellung):</span>{' '}
                        {tx.originalDate}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Aktionen */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/75 px-6 py-3">
          <div className="flex items-center gap-2">
            {isOverridden && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                title="Manuelle Änderungen verwerfen und auf Bank-Rohdaten zurücksetzen"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Auf Bankdaten zurücksetzen
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onSplit && isOutbound && (
              <button
                type="button"
                onClick={() => {
                  onSplit(tx);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Scissors className="h-3.5 w-3.5 text-slate-500" />
                {isSplitChild ? 'Aufteilung anpassen (Split)' : 'Aufteilen (Split)'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Abbrechen
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
