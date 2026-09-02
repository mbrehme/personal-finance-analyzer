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
        setMapping(parsed.suggestedMapping);
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
      const transactions = convertRowsToTransactions(
        parseResult.rows,
        mapping,
        selectedAccountId
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
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
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    CSV-Datei auswählen oder hierher ziehen
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Unterstützt Standard-Exporte aller deutschen und internationalen Banken
                  </p>
                  <label className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
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
                  <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs">
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
                      className="text-blue-600 hover:underline"
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
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
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
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
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
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
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
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
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

                  {/* Vorschau der ersten 3 Zeilen */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Vorschau (erste 3 Einträge)
                    </h4>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto text-[11px]">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            {parseResult.headers.slice(0, 5).map((h) => (
                              <th key={h} className="px-2.5 py-1.5 text-left font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parseResult.rows.slice(0, 3).map((row, idx) => (
                            <tr key={idx}>
                              {parseResult.headers.slice(0, 5).map((h) => (
                                <td key={h} className="px-2.5 py-1.5 text-slate-700 truncate max-w-[150px]">
                                  {row[h]}
                                </td>
                              ))}
                            </tr>
                          ))}
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
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!parseResult || !mapping || !selectedAccountId || importing}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
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
