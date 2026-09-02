/**
 * @file CsvImportModal.tsx
 * @description Modaler Wizard zum Importieren von Bank-CSV-Dateien mit automatischer
 * Erkennung, flexiblem Spalten-Mapping und Live-Voransicht der Daten.
 * @module components/modals/CsvImportModal
 */

import React, { useState } from 'react';
import { Account, Transaction } from '@/types/finance';
import {
  parseRawCsv,
  convertRowsToTransactions,
  CsvColumnMapping,
  CsvParseResult,
} from '@/services/csv/csvParser';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onImport: (transactions: Transaction[]) => Promise<number>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onImport,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ''
  );
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  React.useEffect(() => {
    if ((!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

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

        const safeMapping: CsvColumnMapping = {
          ...parsed.suggestedMapping,
          valueDateColumn:
            parsed.suggestedMapping.valueDateColumn || parsed.headers[0] || '',
          subjectColumn:
            parsed.suggestedMapping.subjectColumn ||
            (parsed.headers.length > 1 ? parsed.headers[1] : parsed.headers[0] || ''),
          valueColumn:
            parsed.suggestedMapping.valueColumn ||
            (parsed.headers.length > 2 ? parsed.headers[2] : parsed.headers[0] || ''),
        };
        setMapping(safeMapping);

        if (!selectedAccountId && accounts.length > 0) {
          setSelectedAccountId(accounts[0].id);
        }
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

  const effectiveAccountId = selectedAccountId || accounts[0]?.id || '';

  const handleExecuteImport = async () => {
    if (!parseResult || !mapping || !effectiveAccountId) return;

    try {
      setImporting(true);
      setError(null);
      const transactions = convertRowsToTransactions(
        parseResult.rows,
        mapping,
        effectiveAccountId
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
    setError(null);
    setImportedCount(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-blue-600" />
            Bank-Umsätze importieren (CSV)
          </h3>
          <button
            onClick={resetModal}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importedCount !== null ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                {importedCount} Buchung(en) erfolgreich importiert!
              </h4>
              <p className="text-xs text-slate-500">
                Die Transaktionen wurden automatisch gegen bestehende Buckets und Overrides geprüft.
              </p>
              <button
                onClick={resetModal}
                className="mt-4 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Fertigstellen
              </button>
            </div>
          ) : (
            <>
              {/* 1. Konto-Auswahl */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Ziel-Konto für die Buchungen
                </label>
                <select
                  value={selectedAccountId || accounts[0]?.id || ''}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Datei-Upload */}
              {!parseResult ? (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    CSV-Datei auswählen oder hierher ziehen
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Unterstützt Standard-Exporte aller deutschen und internationalen Banken
                  </p>
                  <label className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-700 shadow-sm transition-colors">
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
                  <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                    <div className="flex items-center gap-2 text-blue-900 font-semibold">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>{fileName}</span>
                      <span className="text-blue-500">
                        ({parseResult.rows.length} Zeilen erkannt, Trennzeichen: &apos;{parseResult.delimiter}&apos;)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParseResult(null)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Andere Datei
                    </button>
                  </div>

                  {/* Spalten-Mapping */}
                  {mapping && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Spalten-Zuordnung prüfen
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-medium text-slate-600 mb-1">
                            Wertstellungsdatum (Valuta) *
                          </label>
                          <select
                            value={mapping.valueDateColumn}
                            onChange={(e) => handleMappingChange('valueDateColumn', e.target.value)}
                            className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-medium text-slate-600 mb-1">
                            Betrag *
                          </label>
                          <select
                            value={mapping.valueColumn}
                            onChange={(e) => handleMappingChange('valueColumn', e.target.value)}
                            className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-medium text-slate-600 mb-1">
                            Verwendungszweck / Text *
                          </label>
                          <select
                            value={mapping.subjectColumn}
                            onChange={(e) => handleMappingChange('subjectColumn', e.target.value)}
                            className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          >
                            {parseResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-medium text-slate-600 mb-1">
                            Empfänger (optional)
                          </label>
                          <select
                            value={mapping.receiverColumn || ''}
                            onChange={(e) => handleMappingChange('receiverColumn', e.target.value)}
                            className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Vorschau der zugeordneten Daten (erste 3 Zeilen)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Zeigt nur aktiv zugeordnete CSV-Spalten
                      </span>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Datum *</span>
                              </div>
                              <div className="text-[10px] font-normal text-blue-600 font-mono truncate max-w-[140px]">
                                {mapping?.valueDateColumn ? `↳ ${mapping.valueDateColumn}` : '(nicht gewählt)'}
                              </div>
                            </th>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Betrag *</span>
                              </div>
                              <div className="text-[10px] font-normal text-blue-600 font-mono truncate max-w-[140px]">
                                {mapping?.valueColumn ? `↳ ${mapping.valueColumn}` : '(nicht gewählt)'}
                              </div>
                            </th>
                            <th className="px-3.5 py-2.5 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <span>Verwendungszweck / Text *</span>
                              </div>
                              <div className="text-[10px] font-normal text-blue-600 font-mono truncate max-w-[220px]">
                                {mapping?.subjectColumn ? `↳ ${mapping.subjectColumn}` : '(nicht gewählt)'}
                              </div>
                            </th>
                            {mapping?.receiverColumn && (
                              <th className="px-3.5 py-2.5 text-left font-semibold">
                                <div>Empfänger</div>
                                <div className="text-[10px] font-normal text-blue-600 font-mono truncate max-w-[140px]">
                                  ↳ {mapping.receiverColumn}
                                </div>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parseResult.rows.slice(0, 3).map((row, idx) => {
                            const rawDate = mapping?.valueDateColumn ? row[mapping.valueDateColumn] : '';
                            const rawValue = mapping?.valueColumn ? row[mapping.valueColumn] : '';
                            const rawSubject = mapping?.subjectColumn ? row[mapping.subjectColumn] : '';
                            const rawReceiver = mapping?.receiverColumn ? row[mapping.receiverColumn] : '';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="px-3.5 py-2 text-slate-800 whitespace-nowrap font-mono text-xs">
                                  {rawDate || <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3.5 py-2 whitespace-nowrap font-semibold text-slate-900">
                                  {rawValue || <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3.5 py-2 text-slate-700 max-w-[260px] truncate" title={rawSubject}>
                                  {rawSubject || <span className="text-slate-300">-</span>}
                                </td>
                                {mapping?.receiverColumn && (
                                  <td className="px-3.5 py-2 text-slate-700 max-w-[160px] truncate" title={rawReceiver}>
                                    {rawReceiver || <span className="text-slate-300">-</span>}
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={
                    !parseResult ||
                    !mapping ||
                    !mapping.valueDateColumn ||
                    !mapping.valueColumn ||
                    !mapping.subjectColumn ||
                    !effectiveAccountId ||
                    importing
                  }
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-colors"
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
