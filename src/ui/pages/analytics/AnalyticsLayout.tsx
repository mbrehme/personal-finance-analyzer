/**
 * @file AnalyticsLayout.tsx
 * @description Gemeinsamer Layout-Container für den Analyse-Bereich mit globaler Filter-Toolbar
 * (Konto, Granularität, DateRangePicker) und Tab-Navigation zwischen Cashflow und Salden.
 * @module pages/analytics/AnalyticsLayout
 */

import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFinance } from '@/domain';
import { ISODateString, PeriodGranularity } from '@/types/finance';
import { PeriodSelector } from '@/ui/components/PeriodSelector';
import { DateRangePicker } from '@/ui/components/DateRangePicker';
import { CategoryFilterDropdown } from '@/ui/components/analytics/CategoryFilterDropdown';
import { AnalyticsContext, AnalyticsFilterState } from './AnalyticsContext';
import { BarChart3, TrendingUp, Wallet, Landmark } from 'lucide-react';

export const ANALYTICS_ACCOUNT_KEY = 'analytics_account';
export const ANALYTICS_GRANULARITY_KEY = 'analytics_granularity';
export const ANALYTICS_START_DATE_KEY = 'analytics_filter_start_date';
export const ANALYTICS_END_DATE_KEY = 'analytics_filter_end_date';
export const ANALYTICS_CATEGORIES_KEY = 'analytics_selected_categories';

// Abwärtskompatible Fallback-Keys
const LEGACY_ACCOUNT_KEY = 'cashflow_account';
const LEGACY_GRANULARITY_KEY = 'cashflow_granularity';
const LEGACY_START_DATE_KEY = 'cashflow_filter_start_date';
const LEGACY_END_DATE_KEY = 'cashflow_filter_end_date';
const LEGACY_CATEGORIES_KEY = 'cashflow_selected_categories';

export const AnalyticsLayout: React.FC = () => {
  const { accounts, categories } = useFinance();
  const location = useLocation();
  const isBalances = location.pathname.includes('/balances');

  // 1. Konto-Auswahl (persisted)
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => {
    return (
      localStorage.getItem(ANALYTICS_ACCOUNT_KEY) ||
      localStorage.getItem(LEGACY_ACCOUNT_KEY) ||
      null
    );
  });

  const setSelectedAccountId = (id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) {
      localStorage.setItem(ANALYTICS_ACCOUNT_KEY, id);
      localStorage.setItem(LEGACY_ACCOUNT_KEY, id);
    } else {
      localStorage.removeItem(ANALYTICS_ACCOUNT_KEY);
      localStorage.removeItem(LEGACY_ACCOUNT_KEY);
    }
  };

  // 2. Granularität (persisted)
  const [granularity, setGranularityState] = useState<PeriodGranularity>(() => {
    const saved =
      localStorage.getItem(ANALYTICS_GRANULARITY_KEY) ||
      localStorage.getItem(LEGACY_GRANULARITY_KEY);
    if (
      saved === 'monthly' ||
      saved === 'quarterly' ||
      saved === 'halfYearly' ||
      saved === 'yearly'
    ) {
      return saved as PeriodGranularity;
    }
    return 'monthly';
  });

  const setGranularity = (g: PeriodGranularity) => {
    setGranularityState(g);
    localStorage.setItem(ANALYTICS_GRANULARITY_KEY, g);
    localStorage.setItem(LEGACY_GRANULARITY_KEY, g);
  };

  // 3. DateRange-Filter (persisted)
  const [startDate, setStartDateState] = useState<ISODateString | null>(() => {
    return (
      (localStorage.getItem(ANALYTICS_START_DATE_KEY) as ISODateString) ||
      (localStorage.getItem(LEGACY_START_DATE_KEY) as ISODateString) ||
      null
    );
  });

  const [endDate, setEndDateState] = useState<ISODateString | null>(() => {
    return (
      (localStorage.getItem(ANALYTICS_END_DATE_KEY) as ISODateString) ||
      (localStorage.getItem(LEGACY_END_DATE_KEY) as ISODateString) ||
      null
    );
  });

  const setDateRange = (start: ISODateString | null, end: ISODateString | null) => {
    setStartDateState(start);
    setEndDateState(end);
    if (start) {
      localStorage.setItem(ANALYTICS_START_DATE_KEY, start);
      localStorage.setItem(LEGACY_START_DATE_KEY, start);
    } else {
      localStorage.removeItem(ANALYTICS_START_DATE_KEY);
      localStorage.removeItem(LEGACY_START_DATE_KEY);
    }
    if (end) {
      localStorage.setItem(ANALYTICS_END_DATE_KEY, end);
      localStorage.setItem(LEGACY_END_DATE_KEY, end);
    } else {
      localStorage.removeItem(ANALYTICS_END_DATE_KEY);
      localStorage.removeItem(LEGACY_END_DATE_KEY);
    }
  };

  // 4. Kategorie-Filter (persisted)
  const [selectedCategoryIds, setSelectedCategoryIdsState] = useState<string[] | null>(() => {
    const saved =
      localStorage.getItem(ANALYTICS_CATEGORIES_KEY) || localStorage.getItem(LEGACY_CATEGORIES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return null;
  });

  const setSelectedCategoryIds = (ids: string[] | null) => {
    setSelectedCategoryIdsState(ids);
    if (ids) {
      const json = JSON.stringify(ids);
      localStorage.setItem(ANALYTICS_CATEGORIES_KEY, json);
      localStorage.setItem(LEGACY_CATEGORIES_KEY, json);
    } else {
      localStorage.removeItem(ANALYTICS_CATEGORIES_KEY);
      localStorage.removeItem(LEGACY_CATEGORIES_KEY);
    }
  };

  const contextValue: AnalyticsFilterState = useMemo(
    () => ({
      selectedAccountId,
      setSelectedAccountId,
      granularity,
      setGranularity,
      startDate,
      endDate,
      setDateRange,
      selectedCategoryIds,
      setSelectedCategoryIds,
    }),
    [selectedAccountId, granularity, startDate, endDate, selectedCategoryIds]
  );

  return (
    <AnalyticsContext.Provider value={contextValue}>
      <div className="space-y-6">
        {/* Globaler Header & Filter-Toolbar */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <BarChart3 className="h-7 w-7 text-blue-600" />
                Analyse
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Detaillierte Finanzanalysen deines Cashflows und deiner Salden über frei wählbare
                Zeiträume.
              </p>
            </div>

            {/* Gemeinsame Filter-Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Konto-Filter */}
              <div className="relative min-w-[160px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Landmark className="h-4 w-4" />
                </div>
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => setSelectedAccountId(e.target.value ? e.target.value : null)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-8 text-sm font-semibold shadow-sm transition-colors hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="analytics-account-select"
                >
                  <option value="">Alle Konten ({accounts.length})</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Granularitäts-Umschalter */}
              <PeriodSelector value={granularity} onChange={setGranularity} />

              {/* Kategorie-Filter (direkt neben dem Period-Picker in der Zeile) */}
              {!isBalances && (
                <CategoryFilterDropdown
                  categories={categories}
                  selectedCategoryIds={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                />
              )}

              {/* Date Range Picker */}
              <DateRangePicker
                startDate={startDate || ''}
                endDate={endDate || ''}
                onChange={(range) =>
                  setDateRange(
                    (range.startDate as ISODateString) || null,
                    (range.endDate as ISODateString) || null
                  )
                }
                align="right"
              />
            </div>
          </div>
        </div>

        {/* Subpage-Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <NavLink
            to="/analytics/cashflow"
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
              !isBalances
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Cashflow
          </NavLink>

          <NavLink
            to="/analytics/balances"
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
              isBalances
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="h-4 w-4" />
            Salden
          </NavLink>
        </div>

        {/* Aktive Subpage */}
        <Outlet />
      </div>
    </AnalyticsContext.Provider>
  );
};
