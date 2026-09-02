/**
 * @file Transactions.tsx
 * @description Transaktions- und Buchungsansicht mit robuster Compound-Freitextsuche,
 * Multikriterien-Filtern, CSV-Import und manueller Bucket-Zuweisung.
 * @module pages/Transactions
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import {
  TransactionType,
  ISODateString,
  buildCompoundSearchField,
  sortTransactionsDesc,
} from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { CsvImportModal } from '@/components/modals/CsvImportModal';
import { formatDate } from '@/utils/dateUtils';
import {
  Receipt,
  Search,
  Filter,
  UploadCloud,
  Trash2,
  Lock,
  Bot,
  RotateCcw,
  ChevronDown,
  Layers,
  Loader2,
} from 'lucide-react';

const PAGE_SIZE = 50;

/**
 * Kreisförmige Gauge (Radial-Fortschrittsanzeige)
 */
export const CircularGauge: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  showText?: boolean;
}> = ({
  percentage,
  size = 40,
  strokeWidth = 4,
  colorClass = 'text-blue-600',
  showText = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className={`${colorClass} transition-all duration-300 ease-out`}
        />
      </svg>
      {showText && (
        <span className="absolute text-[10px] font-bold text-slate-800 font-mono">
          {Math.round(clampedPercent)}%
        </span>
      )}
    </div>
  );
};

export const Transactions: React.FC = () => {
  const {
    transactions,
    accounts,
    buckets,
    loading,
    importTransactions,
    assignTransactionBucket,
    deleteTransaction,
    clearTransactions,
    reMatching,
  } = useFinance();

  // Entwurfs-Filter State (Eingaben)
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  const [inputAccountId, setInputAccountId] = useState<string>('all');
  const [inputBucketId, setInputBucketId] = useState<string>('all');
  const [inputType, setInputType] = useState<TransactionType | 'all'>('all');
  const [inputStartDate, setInputStartDate] = useState<string>('');
  const [inputEndDate, setInputEndDate] = useState<string>('');

  // Aktiv angewandte Filter
  const [appliedFilters, setAppliedFilters] = useState<{
    searchTerm: string;
    accountId: string;
    bucketId: string;
    type: TransactionType | 'all';
    startDate: string;
    endDate: string;
  }>({
    searchTerm: '',
    accountId: 'all',
    bucketId: 'all',
    type: 'all',
    startDate: '',
    endDate: '',
  });

  // Lazy Loading / Pagination State
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Schnelle Lookups per Map
  const accountsMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Strukturierte Bucket-Optionen für schnelle und übersichtliche Auswahl
  const bucketOptions = useMemo(() => {
    const childrenMap = new Map<string | null, typeof buckets>();
    buckets.forEach((b) => {
      const list = childrenMap.get(b.parentId) || [];
      list.push(b);
      childrenMap.set(b.parentId, list);
    });

    const getPathName = (b: (typeof buckets)[0]): string => {
      const parts = [b.name];
      let currentParentId = b.parentId;
      while (currentParentId) {
        const parent = buckets.find((p) => p.id === currentParentId);
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

    return buckets
      .map((b) => ({
        id: b.id,
        name: getPathName(b),
        isLeaf: (childrenMap.get(b.id) || []).length === 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [buckets]);

  // Gefilterte Transaktionen basierend auf angewandten Filtern
  const filteredTransactions = useMemo(() => {
    const { searchTerm, accountId, bucketId, type, startDate, endDate } = appliedFilters;

    const matches = transactions.filter((tx) => {
      // 1. Account Filter
      if (accountId !== 'all' && tx.accountId !== accountId) {
        return false;
      }

      // 2. Bucket Filter
      if (bucketId === 'uncategorized' && tx.bucketId !== null) {
        return false;
      }
      if (bucketId === 'assigned' && tx.bucketId === null) {
        return false;
      }
      if (bucketId === 'manual' && tx.assignmentSource !== 'manual') {
        return false;
      }
      if (
        bucketId !== 'all' &&
        bucketId !== 'uncategorized' &&
        bucketId !== 'assigned' &&
        bucketId !== 'manual' &&
        tx.bucketId !== bucketId
      ) {
        return false;
      }

      // 3. Typ Filter
      if (type !== 'all' && tx.type !== type) {
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

    return sortTransactionsDesc(matches);
  }, [transactions, appliedFilters]);

  // Reset Lazy Loading wenn angewandte Filter geändert werden
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [appliedFilters]);

  const displayedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  const hasMore = visibleCount < filteredTransactions.length;

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTransactions.length));
      setIsLoadingMore(false);
    }, 120);
  }, [filteredTransactions.length]);

  const showAll = useCallback(() => {
    setVisibleCount(filteredTransactions.length);
  }, [filteredTransactions.length]);

  // IntersectionObserver für automatisches Infinite Scrolling
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Manuelles Anwenden der Filter
  const handleApplyFilters = () => {
    setAppliedFilters({
      searchTerm: inputSearchTerm,
      accountId: inputAccountId,
      bucketId: inputBucketId,
      type: inputType,
      startDate: inputStartDate,
      endDate: inputEndDate,
    });
    setVisibleCount(PAGE_SIZE);
  };

  // Zurücksetzen aller Filter
  const handleResetFilters = () => {
    setInputSearchTerm('');
    setInputAccountId('all');
    setInputBucketId('all');
    setInputType('all');
    setInputStartDate('');
    setInputEndDate('');
    setAppliedFilters({
      searchTerm: '',
      accountId: 'all',
      bucketId: 'all',
      type: 'all',
      startDate: '',
      endDate: '',
    });
    setVisibleCount(PAGE_SIZE);
  };

  const hasPendingChanges =
    inputSearchTerm !== appliedFilters.searchTerm ||
    inputAccountId !== appliedFilters.accountId ||
    inputBucketId !== appliedFilters.bucketId ||
    inputType !== appliedFilters.type ||
    inputStartDate !== appliedFilters.startDate ||
    inputEndDate !== appliedFilters.endDate;

  const hasActiveFilters =
    appliedFilters.searchTerm !== '' ||
    appliedFilters.accountId !== 'all' ||
    appliedFilters.bucketId !== 'all' ||
    appliedFilters.type !== 'all' ||
    appliedFilters.startDate !== '' ||
    appliedFilters.endDate !== '';

  // Initiales Laden aus der IndexedDB
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
        <div className="relative flex items-center justify-center">
          <CircularGauge percentage={80} size={72} strokeWidth={6} showText={false} />
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin absolute inset-0 m-auto" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Lade Buchungen & Transaktionen...</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Buchungsdaten und Bucket-Zuordnungen werden aus der lokalen IndexedDB-Datenbank synchronisiert.
          </p>
        </div>
      </div>
    );
  }

  const loadedPercentage =
    filteredTransactions.length > 0
      ? (displayedTransactions.length / filteredTransactions.length) * 100
      : 100;

  return (
    <div className="space-y-6">
      {/* Header & Hauptaktionen */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-7 h-7 text-blue-600" />
              Buchungen & Transaktionen
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {transactions.length} Buchungen gesamt • {filteredTransactions.length} nach Filter ({displayedTransactions.length} sichtbar)
            </p>
          </div>

          {filteredTransactions.length > 0 && (
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-inner">
              <CircularGauge percentage={loadedPercentage} size={36} strokeWidth={4} />
              <div className="text-left leading-tight">
                <div className="text-[11px] font-bold text-slate-700">Geladen</div>
                <div className="text-[10px] text-slate-400">
                  {displayedTransactions.length}/{filteredTransactions.length}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
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

      {/* Re-matching Indikator Banner */}
      {reMatching && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Regex-Muster werden auf alle Buchungen angewendet...</span>
          </div>
          <span className="font-mono text-blue-600 font-bold">Bitte warten</span>
        </div>
      )}

      {/* Filterleiste mit manuellem Anwenden */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleApplyFilters();
        }}
        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Filter & Suche
            </span>

            {filteredTransactions.length > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-normal normal-case">
                <CircularGauge percentage={loadedPercentage} size={16} strokeWidth={2.5} showText={false} />
                <span>
                  <strong className="font-semibold text-slate-900">{displayedTransactions.length}</strong> / {filteredTransactions.length} sichtbar ({Math.round(loadedPercentage)}%)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-xs font-medium normal-case px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Zurücksetzen
              </button>
            )}

            <button
              type="submit"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all normal-case ${
                hasPendingChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/40'
                  : 'bg-slate-800 text-white hover:bg-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Filter anwenden
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* 1. Compound Freitext-Suche */}
          <div className="lg:col-span-3 relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={inputSearchTerm}
              onChange={(e) => setInputSearchTerm(e.target.value)}
              placeholder="Volltextsuche..."
              className="w-full h-9 pl-9 pr-3 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* 2. Konto Filter */}
          <div className="lg:col-span-2">
            <select
              value={inputAccountId}
              onChange={(e) => setInputAccountId(e.target.value)}
              className="w-full h-9 px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
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
          <div className="lg:col-span-2">
            <select
              value={inputBucketId}
              onChange={(e) => setInputBucketId(e.target.value)}
              className="w-full h-9 px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="all">Alle Zuweisungen</option>
              <option value="assigned">Zugewiesen</option>
              <option value="uncategorized">Ohne Bucket (Unzugewiesen)</option>
              <option value="manual">Manuell überschrieben</option>
              {bucketOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Typ Filter */}
          <div className="lg:col-span-2">
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value as TransactionType | 'all')}
              className="w-full h-9 px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="all">Alle Typen</option>
              <option value="inbound">Nur Einnahmen (+)</option>
              <option value="outbound">Nur Ausgaben (-)</option>
            </select>
          </div>

          {/* 5. Datums-Bereich */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <input
                type="date"
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                title="Von Datum"
                placeholder="Von"
              />
            </div>
            <span className="text-slate-400 text-xs font-bold shrink-0">–</span>
            <div className="relative flex-1 flex items-center">
              <input
                type="date"
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                title="Bis Datum"
                placeholder="Bis"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Transaktionstabelle */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
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
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map((tx) => {
                  const account = accountsMap.get(tx.accountId);
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
                            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                          >
                            <option value="">(Kein Bucket)</option>
                            {bucketOptions.map((b) => (
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
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
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

        {/* Lazy Loading Sentinel & Footer */}
        {filteredTransactions.length > 0 && (
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>
                Zeige <strong className="text-slate-700">{displayedTransactions.length}</strong> von{' '}
                <strong className="text-slate-700">{filteredTransactions.length}</strong> Buchungen
                {hasMore ? ' (weitere laden beim Scrollen automatisch)' : ' (alle geladen)'}
              </span>

              {/* Progress Gauge Bar */}
              <div className="hidden md:flex items-center gap-2">
                <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(loadedPercentage)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-600">
                  {Math.round(loadedPercentage)}%
                </span>
              </div>
            </div>

            {hasMore && (
              <div className="flex items-center gap-2">
                {isLoadingMore && (
                  <div className="flex items-center gap-1.5 text-blue-600 text-xs font-medium mr-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Lade...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-300 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  Mehr laden (+{Math.min(PAGE_SIZE, filteredTransactions.length - visibleCount)})
                </button>
                <button
                  type="button"
                  onClick={showAll}
                  disabled={isLoadingMore}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 transition-colors"
                >
                  Alle {filteredTransactions.length} anzeigen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Intersection Sentinel element with loading indicator */}
        <div ref={sentinelRef} className="py-2 w-full flex items-center justify-center pointer-events-none">
          {isLoadingMore && hasMore && (
            <div className="flex items-center gap-2 text-xs text-blue-600 font-medium animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Lade weitere Buchungen nach...</span>
            </div>
          )}
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
