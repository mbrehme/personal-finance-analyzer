/**
 * @file CsvImportModal.tsx
 * @description Modaler Wizard zum Importieren von Bank-CSV-Dateien mit automatischer
 * Erkennung, flexiblem Spalten-Mapping und Live-Voransicht der Daten.
 * @module components/modals/CsvImportModal
 */

import React, { useState } from 'react';
import { Account, Transaction } from '@/types/finance';
import { parseRawCsv, convertRowsToTransactions, CsvColumnMapping, CsvParseResult } from '@/domain';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2, Landmark } from 'lucide-react';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: Account[];
  onImport: (transactions: Transaction[]) => Promise<number>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  onImport,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Virtuelle Konten dürfen beim CSV-Import nicht als Zielkonto gewählt werden
  const realAccounts = accounts.filter((acc) => acc.accountType !== 'virtual');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setImportedCount(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseRawCsv(text);
        setParseResult(parsed);

        const initialDateCol = parsed.suggestedMapping.dateColumn || parsed.headers[0] || '';
        const safeMapping: CsvColumnMapping = {
          ...parsed.suggestedMapping,
          dateColumn: initialDateCol,
          subjectColumn:
            parsed.suggestedMapping.subjectColumn ||
            (parsed.headers.length > 1 ? parsed.headers[1] : parsed.headers[0] || ''),
          valueColumn:
            parsed.suggestedMapping.valueColumn ||
            (parsed.headers.length > 2 ? parsed.headers[2] : parsed.headers[0] || ''),
          accountIbanColumn: parsed.suggestedMapping.accountIbanColumn,
          ibanColumn: parsed.suggestedMapping.ibanColumn,
        };
        setMapping(safeMapping);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Parsen der CSV-Datei.');
      }
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (field: keyof CsvColumnMapping, value: string) => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      [field]: value || undefined,
    });
  };

  const handleExecuteImport = async () => {
    if (!parseResult || !mapping || !selectedAccountId) return;

    try {
      setImporting(true);
      setError(null);
      const targetAccount = realAccounts.find((a) => a.id === selectedAccountId);
      const targetIban = targetAccount?.iban || targetAccount?.id || '';
      const transactions = convertRowsToTransactions(
        parseResult.rows,
        mapping,
        targetIban,
        fileName
      );

      const count = await onImport(transactions);
      setImportedCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Importieren der Transaktionen.');
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFileName('');
    setParseResult(null);
    setMapping(null);
    setSelectedAccountId('');
    setError(null);
    setImportedCount(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <UploadCloud className="h-6 w-6 text-blue-600" />
            Bank-Umsätze importieren (CSV)
          </h3>
          <button
            onClick={resetModal}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importedCount !== null ? (
            <div className="space-y-3 py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <h4 className="text-base font-bold text-slate-800">
                {importedCount} Buchung(en) erfolgreich importiert!
              </h4>
              <p className="text-xs text-slate-500">
                Die Transaktionen wurden automatisch gegen bestehende Kategorien und Overrides
                geprüft.
              </p>
              <button
                onClick={resetModal}
                className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Fertigstellen
              </button>
            </div>
          ) : (
            <>
              {/* Datei-Upload */}
              {!parseResult ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center transition-colors hover:border-blue-500">
                  <UploadCloud className="mx-auto mb-2 h-10 w-10 text-slate-400" />
                  <p className="mb-1 text-sm font-medium text-slate-700">
                    CSV-Datei auswählen oder hierher ziehen
                  </p>
                  <p className="mb-4 text-xs text-slate-400">
                    Unterstützt Standard-Exporte aller gängigen Banken. Das Buchungskonto wird im
                    nächsten Schritt ausgewählt.
                  </p>
                  <label className="inline-block cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
                    Datei wählen
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Datei-Info & Re-Upload */}
                  <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-blue-900">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>{fileName}</span>
                      <span className="text-blue-500">
                        ({parseResult.rows.length} Zeilen erkannt, Trennzeichen: &apos;
                        {parseResult.delimiter}&apos;)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParseResult(null)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Andere Datei
                    </button>
                  </div>

                  {/* Buchungskonto manuell auswählen (nur reale Bankkonten, keine virtuellen Konten) */}
                  <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
                    <label
                      htmlFor="csv-booking-account"
                      className="flex items-center gap-1.5 font-bold text-slate-800"
                    >
                      <Landmark className="h-4 w-4 text-blue-600" />
                      <span>Buchungskonto *</span>
                    </label>
                    <select
                      id="csv-booking-account"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="shadow-xs h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>
                        -- Bitte Buchungskonto auswählen --
                      </option>
                      {realAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} {acc.iban ? `(${acc.iban})` : ''}
                        </option>
                      ))}
                    </select>
                    {realAccounts.length === 0 && (
                      <p className="text-[11px] text-amber-700">
                        Es wurden keine realen Bankkonten gefunden. Bitte lege zuerst unter
                        Konfiguration ein Konto an.
                      </p>
                    )}
                  </div>

                  {/* Spalten-Mapping */}
                  {mapping && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Spalten-Zuordnung prüfen
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="mb-1 block font-medium text-slate-600">
                            Wertstellungsdatum (Valuta) *
                          </label>
                          <select
                            value={mapping.dateColumn}
                            onChange={(e) => {
                              handleMappingChange('dateColumn', e.target.value);
                            }}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block font-medium text-slate-600">Betrag *</label>
                          <select
                            value={mapping.valueColumn}
                            onChange={(e) => handleMappingChange('valueColumn', e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block font-medium text-slate-600">
                            Verwendungszweck / Text *
                          </label>
                          <select
                            value={mapping.subjectColumn}
                            onChange={(e) => handleMappingChange('subjectColumn', e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block font-medium text-slate-600">
                            Empfänger (optional)
                          </label>
                          <select
                            value={mapping.receiverColumn || ''}
                            onChange={(e) => handleMappingChange('receiverColumn', e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">(Nicht vorhanden)</option>
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block font-medium text-slate-600">
                            Auftragskonto / Eigenes Konto IBAN (optional)
                          </label>
                          <select
                            value={mapping.accountIbanColumn || ''}
                            onChange={(e) =>
                              handleMappingChange('accountIbanColumn', e.target.value)
                            }
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">(Nicht vorhanden)</option>
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block font-medium text-slate-600">
                            Partner-IBAN / Gegenkonto (optional)
                          </label>
                          <select
                            value={mapping.ibanColumn || ''}
                            onChange={(e) => handleMappingChange('ibanColumn', e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">(Nicht vorhanden)</option>
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vorschau der ersten 3 Zeilen mit ausschließlich zugeordneten Spalten */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Vorschau der zugeordneten Daten (erste 3 Zeilen)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Zeigt nur aktiv zugeordnete CSV-Spalten
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Datum *</span>
                              </div>
                              <div className="max-w-[140px] truncate font-mono text-[10px] font-normal text-blue-600">
                                {mapping?.dateColumn
                                  ? `↳ ${mapping.dateColumn}`
                                  : '(nicht gewählt)'}
                              </div>
                            </th>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Betrag *</span>
                              </div>
                              <div className="max-w-[140px] truncate font-mono text-[10px] font-normal text-blue-600">
                                {mapping?.valueColumn
                                  ? `↳ ${mapping.valueColumn}`
                                  : '(nicht gewählt)'}
                              </div>
                            </th>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Verwendungszweck / Text *</span>
                              </div>
                              <div className="max-w-[220px] truncate font-mono text-[10px] font-normal text-blue-600">
                                {mapping?.subjectColumn
                                  ? `↳ ${mapping.subjectColumn}`
                                  : '(nicht gewählt)'}
                              </div>
                            </th>
                            {mapping?.receiverColumn && (
                              <th className="px-3.5 py-2.5 text-left font-semibold">
                                <div>Empfänger</div>
                                <div className="max-w-[140px] truncate font-mono text-[10px] font-normal text-blue-600">
                                  ↳ {mapping.receiverColumn}
                                </div>
                              </th>
                            )}
                            {mapping?.accountIbanColumn && (
                              <th className="px-3.5 py-2.5 text-left font-semibold">
                                <div>Auftragskonto</div>
                                <div className="max-w-[140px] truncate font-mono text-[10px] font-normal text-blue-600">
                                  ↳ {mapping.accountIbanColumn}
                                </div>
                              </th>
                            )}
                            {mapping?.ibanColumn && (
                              <th className="px-3.5 py-2.5 text-left font-semibold">
                                <div>Partner-IBAN</div>
                                <div className="max-w-[140px] truncate font-mono text-[10px] font-normal text-blue-600">
                                  ↳ {mapping.ibanColumn}
                                </div>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parseResult.rows.slice(0, 3).map((row, idx) => {
                            const rawDate = mapping?.dateColumn ? row[mapping.dateColumn] : '';
                            const rawValue = mapping?.valueColumn ? row[mapping.valueColumn] : '';
                            const rawSubject = mapping?.subjectColumn
                              ? row[mapping.subjectColumn]
                              : '';
                            const rawReceiver = mapping?.receiverColumn
                              ? row[mapping.receiverColumn]
                              : '';
                            const rawAccountIban = mapping?.accountIbanColumn
                              ? row[mapping.accountIbanColumn]
                              : '';
                            const rawIban = mapping?.ibanColumn ? row[mapping.ibanColumn] : '';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70">
                                <td className="max-w-[130px] truncate px-3.5 py-2 font-mono text-[11px] text-slate-800">
                                  {rawDate || <span className="italic text-slate-400">Leer</span>}
                                </td>
                                <td className="max-w-[110px] truncate px-3.5 py-2 font-mono text-[11px] font-semibold text-slate-900">
                                  {rawValue || <span className="italic text-slate-400">Leer</span>}
                                </td>
                                <td className="max-w-[200px] truncate px-3.5 py-2 text-slate-700">
                                  {rawSubject || (
                                    <span className="italic text-slate-400">Leer</span>
                                  )}
                                </td>
                                {mapping?.receiverColumn && (
                                  <td className="max-w-[130px] truncate px-3.5 py-2 text-slate-700">
                                    {rawReceiver || (
                                      <span className="italic text-slate-400">Leer</span>
                                    )}
                                  </td>
                                )}
                                {mapping?.accountIbanColumn && (
                                  <td className="max-w-[130px] truncate px-3.5 py-2 font-mono text-[11px] text-slate-600">
                                    {rawAccountIban || (
                                      <span className="italic text-slate-400">Leer</span>
                                    )}
                                  </td>
                                )}
                                {mapping?.ibanColumn && (
                                  <td className="max-w-[130px] truncate px-3.5 py-2 font-mono text-[11px] text-slate-600">
                                    {rawIban || <span className="italic text-slate-400">Leer</span>}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={
                    !parseResult ||
                    !selectedAccountId ||
                    !mapping ||
                    !mapping.dateColumn ||
                    !mapping.valueColumn ||
                    !mapping.subjectColumn ||
                    importing
                  }
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing
                    ? 'Importiere...'
                    : parseResult
                      ? `${parseResult.rows.length} Buchungen importieren`
                      : 'Importieren'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
