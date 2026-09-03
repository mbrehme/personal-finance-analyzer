/**
 * @file AnalyticsContext.tsx
 * @description React Context zur Bereitstellung der globalen Filterzustände
 * (Konto, Granularität, DateRange) für alle Analyse-Subpages (Cashflow, Salden).
 * @module pages/analytics/AnalyticsContext
 */

import { createContext, useContext } from 'react';
import { ISODateString, PeriodGranularity } from '@/types/finance';

export interface AnalyticsFilterState {
  /** Aktuell ausgewähltes Konto (null = Alle Konten) */
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string | null) => void;
  /** Aktuelle Zeit-Granularität */
  granularity: PeriodGranularity;
  setGranularity: (granularity: PeriodGranularity) => void;
  /** Startdatum des gewählten Filters */
  startDate: ISODateString | null;
  /** Enddatum des gewählten Filters */
  endDate: ISODateString | null;
  /** Setzt den Datumsbereich */
  setDateRange: (startDate: ISODateString | null, endDate: ISODateString | null) => void;
}

const defaultAnalyticsFilter: AnalyticsFilterState = {
  selectedAccountId: null,
  setSelectedAccountId: () => {},
  granularity: 'monthly',
  setGranularity: () => {},
  startDate: null,
  endDate: null,
  setDateRange: () => {},
};

export const AnalyticsContext = createContext<AnalyticsFilterState>(defaultAnalyticsFilter);

/**
 * Hook zum Zugriff auf die globalen Analyse-Filter.
 * Fällt auf Default-Werte zurück, falls außerhalb von AnalyticsLayout gerendert.
 *
 * @returns {AnalyticsFilterState} Die aktuellen Filterwerte und Setter-Funktionen
 */
export function useAnalyticsFilter(): AnalyticsFilterState {
  return useContext(AnalyticsContext);
}
