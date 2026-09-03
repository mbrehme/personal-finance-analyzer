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
  isManualTransaction,
  isTransactionOverridden,
  getTransactionType,
  Transaction,
} from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CsvImportModal } from '@/components/modals/CsvImportModal';
import { TransactionModal } from '@/components/modals/TransactionModal';
import { CategoryFilterDropdown } from '@/components/analytics/CategoryFilterDropdown';
import { formatDate } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import {
  Receipt,
  Search,
  Filter,
  UploadCloud,
  Trash2,
  RotateCcw,
  ChevronDown,
  Layers,
  Loader2,
  Plus,
  Pencil,
  Scissors,
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
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
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
        <span className="absolute font-mono text-[10px] font-bold text-slate-800">
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
    categories,
    loading,
    addTransaction,
    updateTransaction,
    splitTransaction,
    importTransactions,
    assignTransactionCategory,
    deleteTransaction,
    clearTransactions,
    reMatching,
    resetTransaction,
    deletedTransactions = [],
    restoreTransaction,
  } = useFinance();

  // Entwurfs-Filter State (Eingaben)
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  const [inputAccountId, setInputAccountId] = useState<string>('all');
  const [inputCategoryIds, setInputCategoryIds] = useState<string[] | null>(null);
  const [inputType, setInputType] = useState<TransactionType | 'all'>('all');
  const [inputOrigin, setInputOrigin] = useState<'all' | 'imported' | 'manual' | 'deleted'>('all');
  const [inputStartDate, setInputStartDate] = useState<string>('');
  const [inputEndDate, setInputEndDate] = useState<string>('');

  // Aktiv angewandte Filter
  const [appliedFilters, setAppliedFilters] = useState<{
    searchTerm: string;
    accountId: string;
    categoryIds: string[] | null;
    type: TransactionType | 'all';
    origin: 'all' | 'imported' | 'manual' | 'deleted';
    startDate: string;
    endDate: string;
  }>({
    searchTerm: '',
    accountId: 'all',
    categoryIds: null,
    type: 'all',
    origin: 'all',
    startDate: '',
    endDate: '',
  });

  // Modal State für Manuelle Buchung / Edit / Split
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalMode, setTxModalMode] = useState<'create' | 'edit' | 'split'>('create');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const handleOpenCreateModal = () => {
    setSelectedTx(null);
    setTxModalMode('create');
    setIsTxModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setTxModalMode('edit');
    setIsTxModalOpen(true);
  };

  const handleOpenSplitModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setTxModalMode('split');
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (txData: Omit<Transaction, 'id'> | Transaction) => {
    if ('id' in txData && txData.id) {
      await updateTransaction(txData as Transaction);
    } else {
      await addTransaction(txData);
    }
  };

  const handleSplitTransaction = async (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ) => {
    await splitTransaction(originalId, splitAmount, splitData);
  };

  // Lazy Loading / Pagination State
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Schnelle Lookups per Map
  const accountsMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Strukturierte Kategorie-Optionen für schnelle und übersichtliche Auswahl
  const categoryOptions = useMemo(() => {
    const childrenMap = new Map<string | null, typeof categories>();
    categories.forEach((c) => {
      const list = childrenMap.get(c.parentId) || [];
      list.push(c);
      childrenMap.set(c.parentId, list);
    });

    const getPathName = (c: (typeof categories)[0]): string => {
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
        isLeaf: (childrenMap.get(c.id) || []).length === 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [categories]);

  // IDs aller Transaktionen, die als Original aufgeteilt (gesplittet) wurden
  const splitParentIds = useMemo(
    () => new Set(transactions.map((t) => t.splitFromId).filter(Boolean) as string[]),
    [transactions]
  );

  // Anzahl Buchungen je Quellen-Option (für Anzeige in Klammern im Dropdown)
  const originCounts = useMemo(() => {
    let imported = 0;
    let manual = 0;
    for (const tx of transactions) {
      if (tx.origin !== 'manual' || Boolean(tx.splitFromId)) imported++;
      if (isManualTransaction(tx)) manual++;
    }
    return {
      imported,
      manual,
      deleted: deletedTransactions.length,
    };
  }, [transactions, deletedTransactions]);

  // Gefilterte Transaktionen basierend auf angewandten Filtern
  const filteredTransactions = useMemo(() => {
    const { searchTerm, accountId, categoryIds, type, origin, startDate, endDate } = appliedFilters;

    // Papierkorb-Ansicht: gelöschte Transaktionen anzeigen
    if (origin === 'deleted') {
      const matches = deletedTransactions.filter((tx) => {
        if (searchTerm.trim()) {
          const compound = buildCompoundSearchField(tx).toLowerCase();
          if (!compound.includes(searchTerm.trim().toLowerCase())) return false;
        }
        return true;
      });
      return sortTransactionsDesc(matches);
    }

    const matches = transactions.filter((tx) => {
      const txCatId = tx.categoryId ?? tx.bucketId ?? null;

      // 1. Account Filter
      if (accountId !== 'all' && tx.accountId !== accountId) {
        return false;
      }

      // 2. Kategorie Filter (Multi-Select mit Hierarchie- und Unkategorisiert-Support)
      if (categoryIds !== null) {
        if (categoryIds.length === 0) {
          return false;
        }

        const allowedSet = new Set(categoryIds);
        if (!txCatId) {
          if (!allowedSet.has('__uncategorized__')) {
            return false;
          }
        } else {
          if (!allowedSet.has(txCatId)) {
            return false;
          }
        }
      }

      // 3. Typ Filter (virtuell basierend auf Betragsvorzeichen)
      if (type !== 'all' && getTransactionType(tx) !== type) {
        return false;
      }

      // 4. Quelle Filter (Alle Quellen | Bank-Import | Manuell)
      if (origin === 'imported' && tx.origin === 'manual' && !tx.splitFromId) {
        return false;
      }
      if (origin === 'manual' && !isManualTransaction(tx)) {
        return false;
      }

      // 5. Datum Filter
      if (startDate && tx.valueDate < (startDate as ISODateString)) {
        return false;
      }
      if (endDate && tx.valueDate > (endDate as ISODateString)) {
        return false;
      }

      // 6. Compound-Suche
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
  }, [transactions, deletedTransactions, appliedFilters]);

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

  // Kategorie-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleCategoryChange = (ids: string[] | null) => {
    setInputCategoryIds(ids);
    setAppliedFilters((prev) => ({ ...prev, categoryIds: ids }));
    setVisibleCount(PAGE_SIZE);
  };

  // Manuelles Anwenden der Filter
  const handleApplyFilters = () => {
    setAppliedFilters({
      searchTerm: inputSearchTerm,
      accountId: inputAccountId,
      categoryIds: inputCategoryIds,
      type: inputType,
      origin: inputOrigin,
      startDate: inputStartDate,
      endDate: inputEndDate,
    });
    setVisibleCount(PAGE_SIZE);
  };

  // Zurücksetzen aller Filter
  const handleResetFilters = () => {
    setInputSearchTerm('');
    setInputAccountId('all');
    setInputCategoryIds(null);
    setInputType('all');
    setInputOrigin('all');
    setInputStartDate('');
    setInputEndDate('');
    setAppliedFilters({
      searchTerm: '',
      accountId: 'all',
      categoryIds: null,
      type: 'all',
      origin: 'all',
      startDate: '',
      endDate: '',
    });
    setVisibleCount(PAGE_SIZE);
  };

  const isCategoryChanged =
    inputCategoryIds === null
      ? appliedFilters.categoryIds !== null
      : appliedFilters.categoryIds === null
        ? true
        : inputCategoryIds.length !== appliedFilters.categoryIds.length ||
          inputCategoryIds.some((id) => !appliedFilters.categoryIds!.includes(id));

  const hasPendingChanges =
    inputSearchTerm !== appliedFilters.searchTerm ||
    inputAccountId !== appliedFilters.accountId ||
    isCategoryChanged ||
    inputType !== appliedFilters.type ||
    inputOrigin !== appliedFilters.origin ||
    inputStartDate !== appliedFilters.startDate ||
    inputEndDate !== appliedFilters.endDate;

  const hasActiveFilters =
    appliedFilters.searchTerm !== '' ||
    appliedFilters.accountId !== 'all' ||
    appliedFilters.categoryIds !== null ||
    appliedFilters.type !== 'all' ||
    appliedFilters.origin !== 'all' ||
    appliedFilters.startDate !== '' ||
    appliedFilters.endDate !== '';

  // Initiales Laden aus der IndexedDB
  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="relative flex items-center justify-center">
          <CircularGauge percentage={80} size={72} strokeWidth={6} showText={false} />
          <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Lade Buchungen & Transaktionen...</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Buchungsdaten und Kategorie-Zuordnungen werden aus der lokalen IndexedDB-Datenbank
            synchronisiert.
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Receipt className="h-7 w-7 text-blue-600" />
              Buchungen & Transaktionen
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {transactions.length} Buchungen gesamt • {filteredTransactions.length} nach Filter (
              {displayedTransactions.length} sichtbar)
            </p>
          </div>

          {filteredTransactions.length > 0 && (
            <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-inner sm:flex">
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
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Neue Buchung
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <UploadCloud className="h-4 w-4" />
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
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Alle Transaktionen leeren"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Re-matching Indikator Banner */}
      {reMatching && (
        <div className="flex animate-pulse items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900 shadow-sm">
          <div className="flex items-center gap-2.5 font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Regex-Muster werden auf alle Buchungen angewendet...</span>
          </div>
          <span className="font-mono font-bold text-blue-600">Bitte warten</span>
        </div>
      )}

      {/* Filterleiste mit manuellem Anwenden */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleApplyFilters();
        }}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              Filter & Suche
            </span>

            {filteredTransactions.length > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-normal normal-case text-slate-700">
                <CircularGauge
                  percentage={loadedPercentage}
                  size={16}
                  strokeWidth={2.5}
                  showText={false}
                />
                <span>
                  <strong className="font-semibold text-slate-900">
                    {displayedTransactions.length}
                  </strong>{' '}
                  / {filteredTransactions.length} sichtbar ({Math.round(loadedPercentage)}%)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium normal-case text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Zurücksetzen
              </button>
            )}

            <button
              type="submit"
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold normal-case shadow-sm transition-all ${
                hasPendingChanges
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400/40 hover:bg-blue-700'
                  : 'bg-slate-800 text-white hover:bg-slate-900'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Filter anwenden
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* 1. Compound Freitext-Suche */}
          <div className="relative flex min-w-0 items-center">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={inputSearchTerm}
              onChange={(e) => setInputSearchTerm(e.target.value)}
              placeholder="Volltextsuche..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 2. Konto Filter */}
          <div className="relative min-w-0">
            <select
              value={inputAccountId}
              onChange={(e) => setInputAccountId(e.target.value)}
              className="h-9 w-full appearance-none truncate rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Konten</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* 3. Kategorie Filter */}
          <div className="relative min-w-0">
            <CategoryFilterDropdown
              categories={categories}
              hasUncategorized={true}
              selectedCategoryIds={inputCategoryIds}
              onChange={handleCategoryChange}
              className="w-full"
            />
          </div>

          {/* 4. Typ Filter */}
          <div className="relative min-w-0">
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value as TransactionType | 'all')}
              className="h-9 w-full appearance-none rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Typ: Alle</option>
              <option value="inbound">Einnahmen (+)</option>
              <option value="outbound">Ausgaben (-)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* 5. Quelle Filter */}
          <div className="relative min-w-0">
            <select
              value={inputOrigin}
              onChange={(e) => {
                const val = e.target.value as 'all' | 'imported' | 'manual' | 'deleted';
                setInputOrigin(val);
                setAppliedFilters((prev) => ({ ...prev, origin: val }));
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 w-full appearance-none rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Buchungsquelle filtern"
              aria-label="Buchungsquelle filtern"
            >
              <option value="all">Alle Quellen</option>
              <option value="imported">Imported</option>
              <option value="manual">Manuell ({originCounts.manual})</option>
              <option value="deleted">Gelöscht ({originCounts.deleted})</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* 6. Datums-Bereich */}
          <div className="min-w-0">
            <DateRangePicker
              startDate={inputStartDate}
              endDate={inputEndDate}
              onChange={({ startDate, endDate }) => {
                setInputStartDate(startDate);
                setInputEndDate(endDate);
              }}
              className="w-full"
            />
          </div>
        </div>
      </form>

      {/* Transaktionstabelle */}
      <div className="space-y-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Konto</th>
                <th className="px-4 py-3">Empfänger / Sender & Text</th>
                <th className="px-4 py-3 text-right">Betrag</th>
                <th className="px-4 py-3">Kategorie & Zuweisung</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map((tx) => {
                  const account = accountsMap.get(tx.accountId);
                  const isOutbound = tx.value < 0;
                  const isSplitParent = splitParentIds.has(tx.id);
                  const isSplitChild = Boolean(tx.splitFromId);
                  const isSplitPart = isSplitParent || isSplitChild;

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isSplitPart
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/25 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Datum */}
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span>{formatDate(tx.valueDate)}</span>
                          {tx.originalValueDate !== undefined &&
                            tx.valueDate !== tx.originalValueDate && (
                              <span
                                className="py-0.2 inline-flex items-center rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-800"
                                title={`Ursprüngliches Bankdatum: ${formatDate(tx.originalValueDate)}`}
                              >
                                Geändert
                              </span>
                            )}
                        </div>
                        {isSplitParent && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900"
                              title="Diese Buchung wurde aufgeteilt (Original)"
                            >
                              <Scissors className="h-2.5 w-2.5 text-amber-700" /> Split (Original)
                            </span>
                          </div>
                        )}
                        {isSplitChild && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900"
                              title="Abgespaltener Teil dieser Buchung"
                            >
                              <Scissors className="h-2.5 w-2.5 text-amber-700" /> Split (Teil)
                            </span>
                          </div>
                        )}
                        {tx.origin === 'manual' && !isSplitChild && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800"
                              title="Manuell erfasste Buchung"
                            >
                              Manuell
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Konto */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {account ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-800">
                              <IconRenderer
                                name={account.icon}
                                style={{ color: account.color }}
                                className="h-3.5 w-3.5"
                              />
                              {account.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          {tx.originalAccountId !== undefined &&
                            tx.accountId !== tx.originalAccountId && (
                              <span
                                className="py-0.2 inline-flex items-center rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-800"
                                title="Konto manuell angepasst"
                              >
                                Geändert
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Partner & Subject */}
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-slate-800">
                            {tx.receiver || tx.issuer || 'Kein Empfänger'}
                          </span>
                          {((tx.originalReceiver !== undefined &&
                            (tx.receiver || tx.issuer) !== tx.originalReceiver) ||
                            (tx.originalIssuer !== undefined &&
                              (tx.receiver || tx.issuer) !== tx.originalIssuer)) && (
                            <span
                              className="py-0.2 inline-flex shrink-0 items-center rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-800"
                              title={`Ursprünglich: ${tx.originalReceiver || tx.originalIssuer || 'Kein Empfänger'}`}
                            >
                              Geändert
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[11px] text-slate-500">{tx.subject}</span>
                          {tx.originalSubject !== undefined &&
                            tx.subject !== tx.originalSubject && (
                              <span
                                className="py-0.2 inline-flex shrink-0 items-center rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-800"
                                title={`Ursprünglich: ${tx.originalSubject}`}
                              >
                                Geändert
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Betrag */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">
                        <div className={isOutbound ? 'text-slate-900' : 'text-emerald-600'}>
                          {formatMoney(tx.value, { signDisplay: 'always' })}
                        </div>
                        {tx.originalValue !== undefined && tx.value !== tx.originalValue && (
                          <div className="mt-0.5">
                            <span
                              className="py-0.2 inline-flex items-center rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-800"
                              title={`Ursprünglicher Betrag: ${formatMoney(tx.originalValue, { signDisplay: 'always' })}`}
                            >
                              Geändert
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Kategorie Selector */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={tx.categoryId || tx.bucketId || ''}
                            onChange={(e) =>
                              assignTransactionCategory(tx.id, e.target.value || null)
                            }
                            className="max-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">(Keine Kategorie)</option>
                            {categoryOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          {/* Geändert Badge bei manueller Zuweisung */}
                          {tx.assignmentSource === 'manual' && (
                            <span
                              className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800"
                              title="Kategorie manuell zugewiesen / angepasst"
                            >
                              Geändert
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aktionen */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Restore-Knopf: nur im Papierkorb-Modus */}
                          {appliedFilters.origin === 'deleted' ? (
                            <button
                              type="button"
                              onClick={() => restoreTransaction(tx.id)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              title="Buchung wiederherstellen"
                              aria-label="Buchung wiederherstellen"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Wiederherstellen
                            </button>
                          ) : (
                            <>
                              {/* Reset-Knopf: wenn Transaktion von Originaldaten abweicht */}
                              {isTransactionOverridden(tx) && tx.originalValue !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => resetTransaction(tx.id)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                                  title="Auf Originaldaten zurücksetzen"
                                  aria-label="Transaktion zurücksetzen"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenSplitModal(tx)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                                title="Buchung aufteilen (Split)"
                                aria-label="Buchung aufteilen"
                              >
                                <Scissors className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(tx)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                title="Bearbeiten"
                                aria-label="Buchung bearbeiten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTransaction(tx.id)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Löschen"
                                aria-label="Buchung löschen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                    {appliedFilters.origin === 'deleted'
                      ? 'Keine gelöschten Buchungen im Papierkorb.'
                      : 'Keine passenden Buchungen gefunden. Lade eine CSV-Datei hoch!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Lazy Loading Sentinel & Footer */}
        {filteredTransactions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-slate-400" />
              <span>
                Zeige <strong className="text-slate-700">{displayedTransactions.length}</strong> von{' '}
                <strong className="text-slate-700">{filteredTransactions.length}</strong> Buchungen
                {hasMore ? ' (weitere laden beim Scrollen automatisch)' : ' (alle geladen)'}
              </span>

              {/* Progress Gauge Bar */}
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.round(loadedPercentage)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-slate-600">
                  {Math.round(loadedPercentage)}%
                </span>
              </div>
            </div>

            {hasMore && (
              <div className="flex items-center gap-2">
                {isLoadingMore && (
                  <div className="mr-2 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Lade...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  Mehr laden (+{Math.min(PAGE_SIZE, filteredTransactions.length - visibleCount)})
                </button>
                <button
                  type="button"
                  onClick={showAll}
                  disabled={isLoadingMore}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline disabled:opacity-50"
                >
                  Alle {filteredTransactions.length} anzeigen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Intersection Sentinel element with loading indicator */}
        <div
          ref={sentinelRef}
          className="pointer-events-none flex w-full items-center justify-center py-2"
        >
          {isLoadingMore && hasMore && (
            <div className="flex animate-pulse items-center gap-2 text-xs font-medium text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
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

      {/* MANUELLE BUCHUNG / EDIT / SPLIT MODAL */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        mode={txModalMode}
        initialTransaction={selectedTx}
        accounts={accounts}
        categories={categories}
        onSave={handleSaveTransaction}
        onSplit={handleSplitTransaction}
      />
    </div>
  );
};
