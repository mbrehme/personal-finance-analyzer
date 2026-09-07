/**
 * @file Transactions.tsx
 * @description Transaktions- und Buchungsansicht mit robuster Compound-Freitextsuche,
 * Multikriterien-Filtern, CSV-Import und manueller Bucket-Zuweisung.
 * @module pages/Transactions
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFinance } from '@/domain';
import {
  TransactionType,
  ISODateString,
  buildCompoundSearchField,
  sortTransactionsDesc,
  getTransactionOrigin,
  isTransactionOverridden,
  getTransactionType,
  Transaction,
  getTransactionAccountInfo,
  isTransactionMatchingAccount,
} from '@/types/finance';
import { IconRenderer } from '@/ui/components/IconRenderer';
import { DateRangePicker } from '@/ui/components/DateRangePicker';
import { CsvImportModal } from '@/ui/components/modals/CsvImportModal';
import { TransactionModal } from '@/ui/components/modals/TransactionModal';
import { TransactionDetailModal } from '@/ui/components/modals/TransactionDetailModal';
import { CategoryFilterDropdown } from '@/ui/components/analytics/CategoryFilterDropdown';
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
  ChevronRight,
  Layers,
  Loader2,
  Pencil,
  Scissors,
  ArrowRight,
  FolderTree,
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
  const [inputOrigin, setInputOrigin] = useState<
    'all' | 'imported' | 'split' | 'override' | 'manual' | 'deleted'
  >('all');
  const [inputStartDate, setInputStartDate] = useState<string>('');
  const [inputEndDate, setInputEndDate] = useState<string>('');

  // Aktiv angewandte Filter
  const [appliedFilters, setAppliedFilters] = useState<{
    searchTerm: string;
    accountId: string;
    categoryIds: string[] | null;
    type: TransactionType | 'all';
    origin: 'all' | 'imported' | 'split' | 'override' | 'manual' | 'deleted';
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

  // Modal State für Transaktions-Detailansicht
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const handleOpenDetailModal = (tx: Transaction) => {
    setDetailTx(tx);
    setIsDetailModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    handleOpenDetailModal(tx);
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

  // IDs aller Transaktionen, die als Original aufgeteilt (gesplittet) wurden
  const splitParentIds = useMemo(
    () => new Set(transactions.map((t) => t.splitFromId).filter(Boolean) as string[]),
    [transactions]
  );

  // Anzahl Buchungen je Quellen-Option (für Anzeige in Klammern im Dropdown)
  const originCounts = useMemo(() => {
    let imported = 0;
    let split = 0;
    let override = 0;
    for (const tx of transactions) {
      const orig = getTransactionOrigin(tx);
      if (orig === 'imported') imported++;
      else if (orig === 'split') split++;
      else if (orig === 'override') override++;
    }
    return {
      imported,
      split,
      override,
      manual: override,
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
      const txCatId = tx.categoryId ?? null;

      // 1. Account Filter (prüft Buchungskonto, Gegenkonto bei Umbuchung und virtuelle Unterkonten)
      if (accountId !== 'all' && !isTransactionMatchingAccount(tx, accountId, accounts)) {
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

      // 4. Quelle Filter (Alle Quellen | Bank-Import | Splits | Overrides / Manuell)
      if (origin !== 'all') {
        const txOrigin = getTransactionOrigin(tx);
        if (origin === 'imported' && txOrigin !== 'imported') {
          return false;
        }
        if (origin === 'split' && txOrigin !== 'split') {
          return false;
        }
        if ((origin === 'override' || origin === 'manual') && txOrigin !== 'override') {
          return false;
        }
      }

      // 5. Datum Filter (Wertstellungsdatum)
      const txDate = tx.date;
      if (startDate && txDate < (startDate as ISODateString)) {
        return false;
      }
      if (endDate && txDate > (endDate as ISODateString)) {
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
  }, [transactions, deletedTransactions, appliedFilters, accounts]);

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

  // Konto-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleAccountChange = (id: string) => {
    setInputAccountId(id);
    setAppliedFilters((prev) => ({ ...prev, accountId: id }));
    setVisibleCount(PAGE_SIZE);
  };

  // Typ-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleTypeChange = (val: TransactionType | 'all') => {
    setInputType(val);
    setAppliedFilters((prev) => ({ ...prev, type: val }));
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
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <UploadCloud className="h-4 w-4" />
            CSV Import
          </button>
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
              onChange={(e) => handleAccountChange(e.target.value)}
              className="h-9 w-full appearance-none truncate rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Konto filtern"
            >
              <option value="all">Alle Konten</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountType === 'virtual'
                    ? `↳ ${a.name} (Virtuell)`
                    : a.iban
                      ? `${a.name} (${a.iban})`
                      : a.name}
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
              onChange={(e) => handleTypeChange(e.target.value as TransactionType | 'all')}
              className="h-9 w-full appearance-none rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Buchungstyp filtern"
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
                const val = e.target.value as
                  'all' | 'imported' | 'split' | 'override' | 'manual' | 'deleted';
                setInputOrigin(val);
                setAppliedFilters((prev) => ({ ...prev, origin: val }));
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 w-full appearance-none rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Buchungsquelle filtern"
              aria-label="Buchungsquelle filtern"
            >
              <option value="all">Alle Quellen</option>
              <option value="imported">Importiert ({originCounts.imported})</option>
              <option value="split">Splits ({originCounts.split})</option>
              <option value="override">Overrides ({originCounts.override})</option>
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
                <th className="whitespace-nowrap px-4 py-3" title="Wertstellungsdatum (Valuta)">
                  Datum
                </th>
                <th className="whitespace-nowrap px-4 py-3">Konto</th>
                <th className="px-4 py-3">Empfänger / Sender & Text</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Betrag</th>
                <th className="whitespace-nowrap px-4 py-3">Kategorie & Zuweisung</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map((tx) => {
                  const accountInfo = getTransactionAccountInfo(tx, accounts);
                  const isOutbound = tx.value < 0;
                  const isSplitParent = splitParentIds.has(tx.id);
                  const isSplitChild = Boolean(tx.splitFromId);
                  const isSplitPart = isSplitParent || isSplitChild;
                  const isTransfer = Boolean(accountInfo.counterAccount);
                  const fromAccount = isTransfer
                    ? isOutbound
                      ? accountInfo.primaryAccount
                      : accountInfo.counterAccount
                    : accountInfo.primaryAccount;
                  const toAccount = isTransfer
                    ? isOutbound
                      ? accountInfo.counterAccount
                      : accountInfo.primaryAccount
                    : undefined;

                  const fromVirtualAccounts = fromAccount
                    ? accountInfo.virtualAccounts.filter(
                        (v) => v.parentAccountId === fromAccount.id
                      )
                    : [];
                  const toVirtualAccounts = toAccount
                    ? accountInfo.virtualAccounts.filter((v) => v.parentAccountId === toAccount.id)
                    : [];
                  const hasModifiedAccount =
                    tx.originalAccountIban !== undefined &&
                    tx.accountIban !== tx.originalAccountIban;

                  const currentDate = tx.date;
                  const origDate = tx.originalDate;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => handleOpenDetailModal(tx)}
                      className={`cursor-pointer transition-colors ${
                        isSplitPart
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/25 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                      title="Klicken für alle Buchungsdetails inkl. Suchstring"
                    >
                      {/* Datum */}
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span>{formatDate(currentDate)}</span>
                          {origDate !== undefined && currentDate !== origDate && (
                            <span
                              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800"
                              title={`Ursprüngliches Bankdatum (Valuta): ${formatDate(origDate)}`}
                              aria-label="Datum geändert"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              <span className="sr-only">Geändert</span>
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
                        {getTransactionOrigin(tx) === 'override' && !isSplitChild && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800"
                              title="Manuell angepasste Buchung (Override)"
                            >
                              Override
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Konto */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {fromAccount ? (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                                !isTransfer || isOutbound
                                  ? 'bg-slate-100 text-slate-800'
                                  : 'border border-blue-200 bg-blue-50 text-blue-900'
                              }`}
                            >
                              <IconRenderer
                                name={fromAccount.icon}
                                style={{ color: fromAccount.color }}
                                className="h-3.5 w-3.5 shrink-0"
                              />
                              <span>{fromAccount.name}</span>
                              {fromVirtualAccounts.map((v) => (
                                <React.Fragment key={v.id}>
                                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                                  <span
                                    className="inline-flex items-center gap-1 font-semibold text-purple-700"
                                    title={`Virtuelles Unterkonto von ${fromAccount.name}: ${v.name}`}
                                  >
                                    <FolderTree className="h-3 w-3 shrink-0 text-purple-600" />
                                    <span>{v.name}</span>
                                  </span>
                                </React.Fragment>
                              ))}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}

                          {isTransfer && toAccount && (
                            <>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                                  isOutbound
                                    ? 'border border-blue-200 bg-blue-50 text-blue-900'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <IconRenderer
                                  name={toAccount.icon}
                                  style={{ color: toAccount.color }}
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span>{toAccount.name}</span>
                                {toVirtualAccounts.map((v) => (
                                  <React.Fragment key={v.id}>
                                    <ChevronRight className="h-3 w-3 shrink-0 text-blue-400" />
                                    <span
                                      className="inline-flex items-center gap-1 font-semibold text-purple-700"
                                      title={`Virtuelles Unterkonto von ${toAccount.name}: ${v.name}`}
                                    >
                                      <FolderTree className="h-3 w-3 shrink-0 text-purple-600" />
                                      <span>{v.name}</span>
                                    </span>
                                  </React.Fragment>
                                ))}
                              </span>
                            </>
                          )}

                          {hasModifiedAccount && (
                            <span
                              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800"
                              title="Konto manuell angepasst"
                              aria-label="Konto geändert"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              <span className="sr-only">Geändert</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Partner & Subject */}
                      <td className="min-w-0 max-w-[200px] px-4 py-3 lg:max-w-xs">
                        <div className="flex min-w-0 max-w-full items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                            {tx.receiver || tx.issuer || 'Kein Empfänger'}
                          </span>
                          {(() => {
                            const origPartner = (
                              tx.originalReceiver ||
                              tx.originalIssuer ||
                              ''
                            ).trim();
                            const currentPartner = (tx.receiver || tx.issuer || '').trim();
                            const hasOrig =
                              tx.originalReceiver !== undefined || tx.originalIssuer !== undefined;
                            return (
                              hasOrig &&
                              origPartner !== '' &&
                              currentPartner !== origPartner && (
                                <span
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800"
                                  title={`Ursprünglich: ${origPartner}`}
                                  aria-label="Partner geändert"
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                  <span className="sr-only">Geändert</span>
                                </span>
                              )
                            );
                          })()}
                        </div>
                        <div className="mt-0.5 flex min-w-0 max-w-full items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                            {tx.subject}
                          </span>
                          {tx.originalSubject !== undefined &&
                            tx.subject !== tx.originalSubject && (
                              <span
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800"
                                title={`Ursprünglich: ${tx.originalSubject}`}
                                aria-label="Verwendungszweck geändert"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                                <span className="sr-only">Geändert</span>
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
                          <div className="mt-0.5 flex justify-end">
                            <span
                              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800"
                              title={`Ursprünglicher Betrag: ${formatMoney(tx.originalValue, { signDisplay: 'always' })}`}
                              aria-label="Betrag geändert"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              <span className="sr-only">Geändert</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Kategorie Selector */}
                      <td
                        className="whitespace-nowrap px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          <CategoryFilterDropdown
                            categories={categories}
                            mode="single"
                            compact
                            hasUncategorized={true}
                            uncategorizedLabel="(Keine Kategorie)"
                            selectedCategoryId={tx.categoryId ?? null}
                            onSelectCategory={(catId) => assignTransactionCategory(tx.id, catId)}
                            className="w-36 max-w-[150px]"
                            dataTestId={`tx-category-picker-${tx.id}`}
                          />

                          {/* Geändert Symbol bei manueller Zuweisung */}
                          {tx.origin !== 'override' && tx.assignmentSource === 'manual' && (
                            <span
                              className="shadow-xs inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-800"
                              title="Kategorie manuell zugewiesen / angepasst"
                              aria-label="Kategorie geändert"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              <span className="sr-only">Geändert</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aktionen */}
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                                title="Details & Bearbeiten"
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

      {/* BUCHUNGS-DETAIL- & BEARBEITEN-MODAL */}
      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        transaction={detailTx}
        accounts={accounts}
        categories={categories}
        onSave={handleSaveTransaction}
        onSplit={(tx) => handleOpenSplitModal(tx)}
        onReset={(id) => resetTransaction(id)}
      />
    </div>
  );
};
