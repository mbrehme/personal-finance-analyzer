/**
 * @file TransactionDetailModal.tsx
 * @description Modaler Dialog zur Anzeige aller Details einer Transaktion inklusive
 * zusammengesetztem Suchstring (Compound Key für Regex & Volltextsuche), Bank-Rohdaten und Revisionsverlauf.
 * @module components/modals/TransactionDetailModal
 */

import React, { useState } from 'react';
import {
  Transaction,
  Account,
  Category,
  buildCompoundSearchField,
  getTransactionAccountInfo,
  isTransactionOverridden,
} from '@/types/finance';
import { formatDate } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/components/IconRenderer';
import {
  X,
  Copy,
  Check,
  Search,
  Landmark,
  FolderTree,
  Tag,
  Calendar,
  Pencil,
  Scissors,
  FileText,
  Clock,
  Fingerprint,
  RotateCcw,
} from 'lucide-react';

export interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
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
  onEdit,
  onSplit,
  onReset,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const tx = transaction;
  const isOutbound = tx.value < 0;
  const accountInfo = getTransactionAccountInfo(tx, accounts);
  const primaryVirtuals = accountInfo.primaryAccount
    ? accountInfo.virtualAccounts.filter(
        (v) => v.parentAccountId === accountInfo.primaryAccount?.id
      )
    : [];
  const counterVirtuals = accountInfo.counterAccount
    ? accountInfo.virtualAccounts.filter(
        (v) => v.parentAccountId === accountInfo.counterAccount?.id
      )
    : [];
  const compoundSearchString = buildCompoundSearchField(tx);
  const category = categories.find((c) => c.id === (tx.categoryId ?? tx.bucketId));
  const isOverridden = isTransactionOverridden(tx);
  const isSplitChild = Boolean(tx.splitFromId);

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
          {/* Betrag & Status Highlight */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500">Betrag</span>
              <div
                className={`font-mono text-2xl font-extrabold ${
                  isOutbound ? 'text-slate-900' : 'text-emerald-600'
                }`}
              >
                {formatMoney(tx.value, { signDisplay: 'always' })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {tx.origin === 'manual' && (
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-800">
                  Manuell erfasst
                </span>
              )}
              {isSplitChild && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">
                  <Scissors className="h-3 w-3" /> Split-Teilbetrag
                </span>
              )}
              {isOverridden && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">
                  Manuell angepasst
                </span>
              )}
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
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
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
            <div className="select-all break-all rounded-lg border border-blue-200 bg-white p-2.5 font-mono text-xs text-blue-950">
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
              <span className="font-semibold text-slate-500">Verwendungszweck</span>
              <p className="select-all break-words rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800">
                {tx.subject || '-'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-slate-500">
                {isOutbound ? 'Empfänger / Begünstigter' : 'Auftraggeber / Absender'}
              </span>
              <p className="select-all rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800">
                {tx.receiver || tx.issuer || '-'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1 font-semibold text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> Valuta- / Wertstellungsdatum
              </span>
              <p className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800">
                {formatDate(tx.valueDate)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1 font-semibold text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> Buchungsdatum
              </span>
              <p className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800">
                {formatDate(tx.bookingDate || tx.valueDate)}
              </p>
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
                <span className="font-semibold text-slate-500">Gebuchtes Konto</span>
                <p className="select-all break-all rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-mono text-xs font-medium text-slate-800">
                  {tx.accountIban || accountInfo.primaryAccount?.iban || 'Keine IBAN angegeben'}
                </p>
                {accountInfo.primaryAccount ? (
                  <div className="space-y-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                      <IconRenderer
                        name={accountInfo.primaryAccount.icon}
                        style={{ color: accountInfo.primaryAccount.color }}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span>{accountInfo.primaryAccount.name}</span>
                    </span>

                    {primaryVirtuals.length > 0 && (
                      <div className="space-y-1 pl-1 pt-0.5">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <FolderTree className="h-3 w-3 text-purple-600" />
                          Virtuelles Unterkonto
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
                ) : (
                  <span className="text-[11px] text-slate-400">Kein verwaltetes Konto</span>
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

          {/* Kategorie & Herkunft */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Tag className="h-4 w-4 text-slate-600" />
              Kategorie & Zuweisungs-Herkunft
            </span>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {category ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
                    <IconRenderer
                      name={category.icon}
                      style={{ color: category.color }}
                      className="h-3.5 w-3.5"
                    />
                    {category.name}
                  </span>
                ) : (
                  <span className="italic text-slate-400">Keine Kategorie zugewiesen</span>
                )}
              </div>

              <div>
                {tx.assignmentSource === 'auto_regex' && (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    Automatisch via Regex
                  </span>
                )}
                {tx.assignmentSource === 'manual' && (
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    Manuell zugewiesen
                  </span>
                )}
                {tx.assignmentSource === 'unassigned' && (
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    Nicht zugewiesen
                  </span>
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
                {tx.importIndex !== undefined && (
                  <div>
                    <span className="text-slate-500">CSV-Zeile: </span>
                    <span className="font-mono text-slate-800">#{tx.importIndex + 1}</span>
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
                    {tx.originalValueDate !== undefined && (
                      <p>
                        <span className="text-slate-400">Datum:</span> {tx.originalValueDate}
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
            {isOverridden && onReset && (
              <button
                type="button"
                onClick={() => {
                  onReset(tx.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Auf Bankdaten zurücksetzen
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onSplit && isOutbound && !isSplitChild && (
              <button
                type="button"
                onClick={() => {
                  onSplit(tx);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Scissors className="h-3.5 w-3.5 text-slate-500" />
                Aufteilen (Split)
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(tx);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
