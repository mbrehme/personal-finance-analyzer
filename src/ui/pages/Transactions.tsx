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
  getTransactionEffectiveValueForAccount,
  isInternalTransfer,
  getEffectiveTransactionPartner,
} from '@/types/finance';
import { IconRenderer } from '@/ui/components/IconRenderer';
import { DateRangePicker } from '@/ui/components/DateRangePicker';
import { CsvImportModal } from '@/ui/components/modals/CsvImportModal';
import { TransactionModal } from '@/ui/components/modals/TransactionModal';
import { TransactionDetailModal } from '@/ui/components/modals/TransactionDetailModal';
import { CategoryFilterDropdown } from '@/ui/components/analytics/CategoryFilterDropdown';
import { formatDate } from '@/utils/dateUtils';
import { formatMoney, roundToTwoDecimals } from '@/utils/moneyUtils';
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
  FolderTree,
  CheckSquare,
  X,
} from 'lucide-react';

const PAGE_SIZE = 50;

/**
 * Prüft, ob eine Transaktion mit einem Suchbegriff übereinstimmt.
 * Durchsucht den Compound-Key, formatierte und rohe Beträge sowie den Kategorienamen.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {string} term - Der Suchbegriff
 * @param {Map<string, string>} [categoryNameMap] - Optionales Mapping von Kategorie-ID zu Kategoriename
 * @returns {boolean} true, falls der Suchbegriff gefunden wurde
 */
export function matchesSearch(
  tx: Transaction,
  term: string,
  categoryNameMap?: Map<string, string>
): boolean {
  if (!term) return true;
  const normTerm = term.trim().toLowerCase();
  if (!normTerm) return true;

  // 1. Compound Search Key ([Typ] Partner: Zweck (IBAN))
  const compound = buildCompoundSearchField(tx).toLowerCase();
  if (compound.includes(normTerm)) return true;

  // 2. Betragssuche (formatiert und roh)
  const amt = tx.amount !== undefined ? tx.amount : Math.abs(tx.value);
  const formattedValue = formatMoney(tx.value).toLowerCase();
  const formattedAmount = formatMoney(amt).toLowerCase();
  const rawValue = String(tx.value).toLowerCase();
  const rawAmount = String(amt).toLowerCase();
  const fixedAmount = amt.toFixed(2);
  const germanFixedAmount = fixedAmount.replace('.', ',');

  if (
    formattedValue.includes(normTerm) ||
    formattedAmount.includes(normTerm) ||
    rawValue.includes(normTerm) ||
    rawAmount.includes(normTerm) ||
    fixedAmount.includes(normTerm) ||
    germanFixedAmount.includes(normTerm)
  ) {
    return true;
  }

  // 3. Kategorie-Name
  if (tx.categoryId && categoryNameMap) {
    const catName = categoryNameMap.get(tx.categoryId);
    if (catName && catName.toLowerCase().includes(normTerm)) {
      return true;
    }
  }

  return false;
}

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
    assignTransactionCategoryBatch,
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

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Gefilterte Transaktionen basierend auf angewandten Filtern
  const filteredTransactions = useMemo(() => {
    const { searchTerm, accountId, categoryIds, type, origin, startDate, endDate } = appliedFilters;

    // Papierkorb-Ansicht: gelöschte Transaktionen anzeigen
    if (origin === 'deleted') {
      const matches = deletedTransactions.filter((tx) =>
        matchesSearch(tx, searchTerm.trim(), categoryNameMap)
      );
      return sortTransactionsDesc(matches);
    }

    const matches = transactions.filter((tx) => {
      const txCatId = tx.categoryId ?? null;

      // 1. Account Filter (prüft Buchungskonto, Gegenkonto bei Umbuchung und virtuelle Unterkonten)
      if (
        accountId !== 'all' &&
        !isTransactionMatchingAccount(tx, accountId, accounts, transactions)
      ) {
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

      // 6. Freitext- & Betragssuche
      if (searchTerm.trim() && !matchesSearch(tx, searchTerm.trim(), categoryNameMap)) {
        return false;
      }

      return true;
    });

    return sortTransactionsDesc(matches);
  }, [transactions, deletedTransactions, appliedFilters, accounts, categoryNameMap]);

  // Aktives Filterkonto ermitteln (für korrekte Vorzeichenberechnung bei Umbuchungen)
  const selectedAccount = useMemo(() => {
    return appliedFilters.accountId !== 'all'
      ? accounts.find((a) => a.id === appliedFilters.accountId)
      : undefined;
  }, [accounts, appliedFilters.accountId]);

  // Summe aller gefilterten Buchungen (unter Berücksichtigung des gewählten Kontos)
  const { filteredTotalSum, filteredInboundSum, filteredOutboundSum } = useMemo(() => {
    let total = 0;
    let inbound = 0;
    let outbound = 0;

    for (const tx of filteredTransactions) {
      const eff = selectedAccount
        ? (getTransactionEffectiveValueForAccount(tx, selectedAccount, accounts, transactions) ??
          tx.value)
        : tx.value;

      total += eff;
      if (eff > 0) {
        inbound += eff;
      } else if (eff < 0) {
        outbound += eff;
      }
    }

    return {
      filteredTotalSum: roundToTwoDecimals(total),
      filteredInboundSum: roundToTwoDecimals(inbound),
      filteredOutboundSum: roundToTwoDecimals(outbound),
    };
  }, [filteredTransactions, selectedAccount, accounts, transactions]);

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

  // Bulk-Auswahl State (Mehrfachauswahl für Massenbearbeitung)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Summe aller aktuell per Checkbox ausgewählten Buchungen
  const selectedTotalSum = useMemo(() => {
    if (selectedTxIds.size === 0) return 0;
    let total = 0;
    for (const tx of filteredTransactions) {
      if (selectedTxIds.has(tx.id)) {
        const eff = selectedAccount
          ? (getTransactionEffectiveValueForAccount(tx, selectedAccount, accounts, transactions) ??
            tx.value)
          : tx.value;
        total += eff;
      }
    }
    return roundToTwoDecimals(total);
  }, [selectedTxIds, filteredTransactions, selectedAccount, accounts, transactions]);

  // Prüfen, ob alle aktuell angezeigten Buchungen ausgewählt sind
  const isAllDisplayedSelected = useMemo(() => {
    return (
      displayedTransactions.length > 0 &&
      displayedTransactions.every((tx) => selectedTxIds.has(tx.id))
    );
  }, [displayedTransactions, selectedTxIds]);

  const isSomeDisplayedSelected = useMemo(() => {
    return !isAllDisplayedSelected && displayedTransactions.some((tx) => selectedTxIds.has(tx.id));
  }, [isAllDisplayedSelected, displayedTransactions, selectedTxIds]);

  // Alle sichtbaren Buchungen auswählen / abwählen
  const handleToggleSelectAll = () => {
    if (isAllDisplayedSelected) {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        displayedTransactions.forEach((tx) => next.delete(tx.id));
        return next;
      });
    } else {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        displayedTransactions.forEach((tx) => next.add(tx.id));
        return next;
      });
    }
  };

  // Einzelne Buchung auswählen / abwählen
  const handleToggleSelectTx = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Gesamte Auswahl aufheben
  const handleDeselectAll = () => {
    setSelectedTxIds(new Set());
  };

  // Bulk-Kategorie zuweisen
  const handleBulkAssignCategory = async (catId: string | null) => {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;
    await assignTransactionCategoryBatch(ids, catId);
    setSelectedTxIds(new Set());
  };

  // Kategorie-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleCategoryChange = (ids: string[] | null) => {
    setInputCategoryIds(ids);
    setAppliedFilters((prev) => ({ ...prev, categoryIds: ids }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Konto-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleAccountChange = (id: string) => {
    setInputAccountId(id);
    setAppliedFilters((prev) => ({ ...prev, accountId: id }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Typ-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleTypeChange = (val: TransactionType | 'all') => {
    setInputType(val);
    setAppliedFilters((prev) => ({ ...prev, type: val }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Volltextsuche anwenden (bei Enter oder Klick)
  const handleSearchSubmit = () => {
    setAppliedFilters((prev) => ({ ...prev, searchTerm: inputSearchTerm }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Suche leeren
  const handleClearSearch = () => {
    setInputSearchTerm('');
    setAppliedFilters((prev) => ({ ...prev, searchTerm: '' }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Quelle-Auswahl ändern (wendet direkt an für flüssige Bedienung)
  const handleOriginChange = (
    val: 'all' | 'imported' | 'split' | 'override' | 'manual' | 'deleted'
  ) => {
    setInputOrigin(val);
    setAppliedFilters((prev) => ({ ...prev, origin: val }));
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  // Datumsbereich ändern (wendet direkt an für flüssige Bedienung)
  const handleDateRangeChange = ({
    startDate,
    endDate,
  }: {
    startDate: string;
    endDate: string;
  }) => {
    setInputStartDate(startDate);
    setInputEndDate(endDate);
    setAppliedFilters((prev) => ({ ...prev, startDate, endDate }));
    setSelectedTxIds(new Set());
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
    setSelectedTxIds(new Set());
    setVisibleCount(PAGE_SIZE);
  };

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

      {/* Filterleiste mit Direktanwendung */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchSubmit();
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
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* 1. Compound Freitext-Suche (Enter zum Suchen) */}
          <div className="relative flex min-w-0 items-center">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={inputSearchTerm}
              onChange={(e) => setInputSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              placeholder="Volltextsuche (Enter)..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-8 text-xs shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {inputSearchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Suche leeren"
                aria-label="Suche leeren"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
                handleOriginChange(val);
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
              onChange={handleDateRangeChange}
              className="w-full"
            />
          </div>
        </div>
      </form>

      {/* Transaktionstabelle */}
      <div className="space-y-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-10" />
              <col className="w-28" />
              <col className="w-44 lg:w-52" />
              <col />
              <col className="w-32" />
              <col className="w-40 lg:w-44" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllDisplayedSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isSomeDisplayedSelected;
                      }
                    }}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Alle sichtbaren Buchungen auswählen"
                    title={
                      isAllDisplayedSelected
                        ? 'Auswahl aufheben'
                        : 'Alle sichtbaren Buchungen auswählen'
                    }
                  />
                </th>
                <th
                  className="w-28 whitespace-nowrap px-4 py-3"
                  title="Wertstellungsdatum (Valuta)"
                >
                  Datum
                </th>
                <th className="w-44 whitespace-nowrap px-3 py-3 lg:w-52">Konto</th>
                <th className="min-w-0 px-4 py-3">Empfänger / Sender & Text</th>
                <th className="w-32 whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex flex-col items-end">
                    <span>Betrag</span>
                    <span
                      className={`font-mono text-[11px] font-bold tracking-tight ${
                        filteredTotalSum < 0
                          ? 'text-slate-900'
                          : filteredTotalSum > 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                      }`}
                      title={`Summe aller ${filteredTransactions.length} gefilterten Buchungen`}
                      data-testid="transactions-column-sum"
                    >
                      Σ {formatMoney(filteredTotalSum, { signDisplay: 'always' })}
                    </span>
                  </div>
                </th>
                <th className="w-40 whitespace-nowrap px-3 py-3 lg:w-44">Kategorie & Zuweisung</th>
                <th className="w-28 whitespace-nowrap px-3 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map((tx) => {
                  const accountInfo = getTransactionAccountInfo(tx, accounts);
                  const effValue = selectedAccount
                    ? (getTransactionEffectiveValueForAccount(
                        tx,
                        selectedAccount,
                        accounts,
                        transactions
                      ) ?? tx.value)
                    : tx.value;
                  const isOutbound = effValue < 0;
                  const isSplitParent = splitParentIds.has(tx.id);
                  const isSplitChild = Boolean(tx.splitFromId);
                  const isSplitPart = isSplitParent || isSplitChild;
                  const isTransfer =
                    Boolean(accountInfo.counterAccount) || isInternalTransfer(tx, accounts);
                  const isDirectedInternal = Boolean(
                    accountInfo.primaryAccount &&
                    accountInfo.counterAccount &&
                    isInternalTransfer(tx, accounts)
                  );
                  const fromAccount = isDirectedInternal
                    ? accountInfo.primaryAccount
                    : isTransfer
                      ? isOutbound
                        ? accountInfo.primaryAccount
                        : accountInfo.counterAccount
                      : accountInfo.primaryAccount;
                  const toAccount = isDirectedInternal
                    ? accountInfo.counterAccount
                    : isTransfer
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
                        selectedTxIds.has(tx.id)
                          ? 'bg-blue-50/70 hover:bg-blue-50/90'
                          : isSplitPart
                            ? 'border-l-4 border-l-amber-400 bg-amber-50/25 hover:bg-amber-50/50'
                            : 'hover:bg-slate-50/80'
                      }`}
                      title="Klicken für alle Buchungsdetails inkl. Suchstring"
                    >
                      {/* Checkbox */}
                      <td
                        className="w-10 px-3 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTxIds.has(tx.id)}
                          onChange={() => handleToggleSelectTx(tx.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Buchung auswählen`}
                          data-testid={`tx-select-checkbox-${tx.id}`}
                        />
                      </td>

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
                      <td className="w-44 whitespace-nowrap px-3 py-3 align-middle lg:w-52">
                        <div className="flex flex-col gap-1">
                          {fromAccount ? (
                            <span
                              className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${
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
                              <span className="truncate" title={fromAccount.name}>
                                {fromAccount.name}
                              </span>
                              {fromVirtualAccounts.map((v) => (
                                <React.Fragment key={v.id}>
                                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                                  <span
                                    className="inline-flex min-w-0 items-center gap-1 font-semibold text-purple-700"
                                    title={`Virtuelles Unterkonto von ${fromAccount.name}: ${v.name}`}
                                  >
                                    <FolderTree className="h-3 w-3 shrink-0 text-purple-600" />
                                    <span className="truncate">{v.name}</span>
                                  </span>
                                </React.Fragment>
                              ))}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}

                          {isTransfer && toAccount && (
                            <div className="flex items-center gap-1 pl-1">
                              <span className="text-xs font-semibold text-blue-500">↳</span>
                              <span
                                className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${
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
                                <span className="truncate" title={toAccount.name}>
                                  {toAccount.name}
                                </span>
                                {toVirtualAccounts.map((v) => (
                                  <React.Fragment key={v.id}>
                                    <ChevronRight className="h-3 w-3 shrink-0 text-blue-400" />
                                    <span
                                      className="inline-flex min-w-0 items-center gap-1 font-semibold text-purple-700"
                                      title={`Virtuelles Unterkonto von ${toAccount.name}: ${v.name}`}
                                    >
                                      <FolderTree className="h-3 w-3 shrink-0 text-purple-600" />
                                      <span className="truncate">{v.name}</span>
                                    </span>
                                  </React.Fragment>
                                ))}
                              </span>
                            </div>
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
                      <td className="min-w-0 px-4 py-3 align-middle">
                        <div className="flex min-w-0 max-w-full items-center gap-1.5">
                          {(() => {
                            const effPartner = getEffectiveTransactionPartner(tx, selectedAccount);
                            return (
                              <span
                                className="min-w-0 flex-1 truncate font-semibold text-slate-800"
                                title={effPartner.name}
                              >
                                {effPartner.name}
                              </span>
                            );
                          })()}
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
                          <span
                            className="min-w-0 flex-1 truncate text-[11px] text-slate-500"
                            title={tx.subject}
                          >
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
                      <td className="w-32 whitespace-nowrap px-4 py-3 text-right align-middle font-mono font-bold">
                        <div
                          className={
                            isTransfer && !selectedAccount
                              ? 'text-blue-700'
                              : isOutbound
                                ? 'text-slate-900'
                                : 'text-emerald-600'
                          }
                        >
                          {isTransfer && !selectedAccount ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                Umbuchung
                              </span>
                              <span>{formatMoney(tx.amount ?? Math.abs(tx.value))}</span>
                            </span>
                          ) : (
                            formatMoney(effValue, { signDisplay: 'always' })
                          )}
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
                        className="w-40 px-3 py-3 align-middle lg:w-44"
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
                            className="w-full"
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
                        className="w-28 whitespace-nowrap px-3 py-3 text-right align-middle"
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
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    {appliedFilters.origin === 'deleted'
                      ? 'Keine gelöschten Buchungen im Papierkorb.'
                      : 'Keine passenden Buchungen gefunden. Lade eine CSV-Datei hoch!'}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredTransactions.length > 0 && (
              <tfoot
                className="border-t-2 border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-700"
                data-testid="transactions-table-footer"
              >
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-slate-600">
                    Summe ({filteredTransactions.length}{' '}
                    {filteredTransactions.length === 1 ? 'Buchung' : 'Buchungen'})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">
                    <div
                      className={`text-sm ${
                        filteredTotalSum < 0
                          ? 'text-slate-900'
                          : filteredTotalSum > 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                      }`}
                      data-testid="transactions-footer-total-sum"
                    >
                      {formatMoney(filteredTotalSum, { signDisplay: 'always' })}
                    </div>
                    {filteredInboundSum > 0 && filteredOutboundSum < 0 && (
                      <div
                        className="mt-0.5 text-[10px] font-normal text-slate-500"
                        data-testid="transactions-footer-breakdown"
                      >
                        <span className="text-emerald-600">+{formatMoney(filteredInboundSum)}</span>
                        {' / '}
                        <span className="text-slate-700">{formatMoney(filteredOutboundSum)}</span>
                      </div>
                    )}
                  </td>
                  <td colSpan={2} className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
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

      {/* FLOATING BULK ACTION BAR */}
      {selectedTxIds.size > 0 && (
        <aside
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md"
          data-testid="bulk-action-bar"
          aria-label="Mehrfachauswahl Aktionen"
        >
          <div className="flex items-center gap-2 border-r border-slate-700 pr-3 text-xs font-semibold text-slate-200">
            <CheckSquare className="h-4 w-4 text-blue-400" />
            <span>
              {selectedTxIds.size} {selectedTxIds.size === 1 ? 'Buchung' : 'Buchungen'} ausgewählt
              {selectedTotalSum !== 0 && (
                <span className="ml-1.5 font-mono text-blue-300" data-testid="bulk-selected-sum">
                  (Σ {formatMoney(selectedTotalSum, { signDisplay: 'always' })})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Kategorie zuweisen:</span>
            <CategoryFilterDropdown
              categories={categories}
              mode="single"
              compact
              placement="top"
              hasUncategorized={true}
              uncategorizedLabel="(Keine Kategorie)"
              placeholder="Kategorie wählen..."
              selectedCategoryId={null}
              onSelectCategory={handleBulkAssignCategory}
              className="w-48 text-slate-900"
              dataTestId="bulk-category-picker"
            />
          </div>

          <button
            type="button"
            onClick={handleDeselectAll}
            className="ml-1 flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="Auswahl aufheben"
            aria-label="Auswahl aufheben"
          >
            <X className="h-3.5 w-3.5" />
            <span>Abbrechen</span>
          </button>
        </aside>
      )}

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
