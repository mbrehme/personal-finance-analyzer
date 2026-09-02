/**
 * @file Transactions.tsx
 * @description Transaktions- und Buchungsansicht mit robuster Compound-Freitextsuche,
 * Multikriterien-Filtern, CSV-Import und manueller Bucket-Zuweisung.
 * @module pages/Transactions
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import {
  TransactionType,
  ISODateString,
  buildCompoundSearchField,
} from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { CsvImportModal } from '@/components/modals/CsvImportModal';
import { formatDate } from '@/utils/dateUtils';
import {
  Receipt,
  Search,
  Filter,
  UploadCloud,
  Sparkles,
  Trash2,
  Lock,
  Bot,
  RotateCcw,
} from 'lucide-react';

export const Transactions: React.FC = () => {
  const {
    transactions,
    accounts,
    buckets,
    importTransactions,
    assignTransactionBucket,
    deleteTransaction,
    clearTransactions,
    triggerReMatch,
  } = useFinance();

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedBucketId, setSelectedBucketId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [reMatching, setReMatching] = useState(false);

  // Gefilterte Transaktionen
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Account Filter
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }

      // 2. Bucket Filter
      if (selectedBucketId === 'uncategorized' && tx.bucketId !== null) {
        return false;
      }
      if (
        selectedBucketId !== 'all' &&
        selectedBucketId !== 'uncategorized' &&
        tx.bucketId !== selectedBucketId
      ) {
        return false;
      }

      // 3. Typ Filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // 4. Datum Filter
      if (startDate && tx.valueDate < (startDate as ISODateString)) {
        return false;
      }
      if (endDate && tx.valueDate > (endDate as ISODateString)) {
        return false;
      }

      // 5. Compound-Suche
      if (searchTerm.trim()) {
        const compound = buildCompoundSearchField(tx).toLowerCase();
        const term = searchTerm.trim().toLowerCase();
        if (!compound.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedAccountId, selectedBucketId, selectedType, startDate, endDate, searchTerm]);

  const handleReMatch = async () => {
    try {
      setReMatching(true);
      await triggerReMatch();
    } finally {
      setReMatching(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedAccountId('all');
    setSelectedBucketId('all');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Hauptaktionen */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-blue-600" />
            Buchungen & Transaktionen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {transactions.length} Buchungen gesamt • {filteredTransactions.length} sichtbar
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReMatch}
            disabled={reMatching || transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors border border-slate-200"
            title="Regex-Regeln neu auf alle automatischen Transaktionen anwenden"
          >
            <Sparkles className={`w-4 h-4 text-amber-500 ${reMatching ? 'animate-spin' : ''}`} />
            {reMatching ? 'Matche...' : 'Neu matchen'}
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            CSV Import
          </button>

          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Möchtest du wirklich alle Transaktionen löschen?')) {
                  clearTransactions();
                }
              }}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Alle Transaktionen leeren"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filterleiste */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Filter & Suche
          </span>
          {(searchTerm || selectedAccountId !== 'all' || selectedBucketId !== 'all' || selectedType !== 'all' || startDate || endDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-blue-600 hover:underline flex items-center gap-1 text-xs normal-case"
            >
              <RotateCcw className="w-3 h-3" />
              Filter zurücksetzen
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1. Compound Freitext-Suche */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Volltextsuche (Konto, Empfänger, Text, Betrag...)"
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 2. Konto Filter */}
          <div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Konten</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Bucket Filter */}
          <div>
            <select
              value={selectedBucketId}
              onChange={(e) => setSelectedBucketId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Zuweisungen</option>
              <option value="assigned">Zugewiesen</option>
              <option value="uncategorized">Ohne Bucket (Unzugewiesen)</option>
              <option value="manual">Manuell überschrieben</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Typ Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as TransactionType | 'all')}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Typen</option>
              <option value="inbound">Nur Einnahmen (+)</option>
              <option value="outbound">Nur Ausgaben (-)</option>
            </select>
          </div>

          {/* 5. Datums-Bereich */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 px-1.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              title="Von Datum"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 px-1.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              title="Bis Datum"
            />
          </div>
        </div>
      </div>

      {/* Transaktionstabelle */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Datum</th>
                <th className="py-3 px-4">Konto</th>
                <th className="py-3 px-4">Empfänger / Sender & Text</th>
                <th className="py-3 px-4 text-right">Betrag</th>
                <th className="py-3 px-4">Bucket & Zuweisung</th>
                <th className="py-3 px-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const account = accounts.find((a) => a.id === tx.accountId);
                  const isOutbound = tx.value < 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Datum */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {formatDate(tx.valueDate)}
                      </td>

                      {/* Konto */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {account ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
                            <IconRenderer
                              name={account.icon}
                              style={{ color: account.color }}
                              className="w-3.5 h-3.5"
                            />
                            {account.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Partner & Subject */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 truncate">
                          {tx.receiver || tx.issuer || 'Kein Empfänger'}
                        </div>
                        <div className="text-slate-500 truncate text-[11px] mt-0.5">
                          {tx.subject}
                        </div>
                      </td>

                      {/* Betrag */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold">
                        <span className={isOutbound ? 'text-slate-900' : 'text-emerald-600'}>
                          {tx.value.toLocaleString('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                            signDisplay: 'always',
                          })}
                        </span>
                      </td>

                      {/* Bucket Selector */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <select
                            value={tx.bucketId || ''}
                            onChange={(e) => assignTransactionBucket(tx.id, e.target.value || null)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 max-w-[160px]"
                          >
                            <option value="">(Kein Bucket)</option>
                            {buckets.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>

                          {/* Assignment Source Badge */}
                          {tx.assignmentSource === 'manual' && (
                            <span
                              className="inline-flex items-center gap-0.5 p-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold"
                              title="Manuell zugewiesen (gesperrt gegen Überschreiben)"
                            >
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                          {tx.assignmentSource === 'auto_regex' && (
                            <span
                              className="inline-flex items-center gap-0.5 p-1 rounded bg-blue-50 text-blue-700 text-[10px] font-medium"
                              title="Automatisch via Regex zugewiesen"
                            >
                              <Bot className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aktionen */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                    Keine passenden Buchungen gefunden. Lade eine CSV-Datei hoch!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        onImport={importTransactions}
      />
    </div>
  );
};
