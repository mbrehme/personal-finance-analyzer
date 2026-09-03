/**
 * @file dateUtils.ts
 * @description Typsichere Datums- und Perioden-Helfer für das Format ISODateString (YYYY-MM-DD)
 * und Perioden-Aggregationen (Monat, Quartal, Halbjahr, Jahr).
 * @module utils/dateUtils
 */

import { ISODateString, PeriodGranularity } from '@/types/finance';
import { roundToTwoDecimals } from './moneyUtils';

/**
 * Validiert, ob ein gegebener String ein valides ISO-Datum (YYYY-MM-DD) darstellt.
 */
export function isValidDateString(dateStr: string): dateStr is ISODateString {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Wandelt ein Date-Objekt, einen Zeitstempel oder einen Datumsstring sicher in einen `ISODateString` (YYYY-MM-DD) um.
 * Unterstützt u.a. 4-stellige und 2-stellige Jahresformate (z. B. '20.07.26', '20.07.2026', '20/07/26', '2026-07-20T12:00:00').
 */
export function toISODateString(dateInput: Date | string | number): ISODateString {
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      throw new Error(`Ungültiges Datum: ${dateInput}`);
    }
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` as ISODateString;
  }

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      throw new Error(`Ungültiges Datum: ${dateInput}`);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` as ISODateString;
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();

    if (isValidDateString(trimmed)) {
      return trimmed;
    }

    // ISO Datum mit Zeitanteil (z. B. "2026-07-20T12:00:00Z" oder "2026-07-20 10:00:00")
    const isoWithTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoWithTimeMatch) {
      const isoCandidate = `${isoWithTimeMatch[1]}-${isoWithTimeMatch[2]}-${isoWithTimeMatch[3]}`;
      if (isValidDateString(isoCandidate)) {
        return isoCandidate;
      }
    }

    // Format DD.MM.YYYY oder DD.MM.YY (z. B. "20.07.26", "20.07.2026", "1.7.26")
    const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (dotMatch) {
      const [, day, month, rawYear] = dotMatch;
      const fullYear =
        rawYear.length === 2 ? (Number(rawYear) < 70 ? `20${rawYear}` : `19${rawYear}`) : rawYear;
      const iso = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (isValidDateString(iso)) {
        return iso;
      }
    }

    // Format DD/MM/YYYY oder DD/MM/YY (z. B. "20/07/26", "20/07/2026")
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slashMatch) {
      const [, day, month, rawYear] = slashMatch;
      const fullYear =
        rawYear.length === 2 ? (Number(rawYear) < 70 ? `20${rawYear}` : `19${rawYear}`) : rawYear;
      const iso = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (isValidDateString(iso)) {
        return iso;
      }
    }

    // Format DD-MM-YYYY oder DD-MM-YY (z. B. "20-07-2026", "20-07-26")
    const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
    if (dashMatch) {
      const [, day, month, rawYear] = dashMatch;
      const fullYear =
        rawYear.length === 2 ? (Number(rawYear) < 70 ? `20${rawYear}` : `19${rawYear}`) : rawYear;
      const iso = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (isValidDateString(iso)) {
        return iso;
      }
    }

    // Fallback: Date.parse
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${day}`;
      if (isValidDateString(iso)) {
        return iso;
      }
    }
  }

  throw new Error(`Ungültiges Datum: ${dateInput}`);
}

/**
 * Formatiert einen `ISODateString` für die deutsche Benutzeroberfläche (DD.MM.YYYY).
 */
export function formatDate(dateStr: ISODateString): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Ermittelt den Aggregations-Schlüssel für ein Datum basierend auf der gewählten Granularität.
 */
export function getPeriodKey(dateStr: ISODateString, granularity: PeriodGranularity): string {
  const [year, monthStr] = dateStr.split('-');
  const month = parseInt(monthStr, 10);

  switch (granularity) {
    case 'monthly':
      return `${year}-${monthStr}`;
    case 'quarterly': {
      const q = Math.ceil(month / 3);
      return `${year}-Q${q}`;
    }
    case 'halfYearly': {
      const h = month <= 6 ? 1 : 2;
      return `${year}-H${h}`;
    }
    case 'yearly':
      return year;
  }
}

/**
 * Ermittelt den Periodenschlüssel für den aktuellen Zeitpunkt (bzw. ein übergebenes Referenzdatum)
 * unter Berücksichtigung der gewählten Granularität.
 *
 * @param {PeriodGranularity} granularity - Die gewünschte Zeit-Granularität ('monthly', 'quarterly', 'halfYearly', 'yearly')
 * @param {Date | string | number} [referenceDate=new Date()] - Optionales Referenzdatum (standardmäßig heute)
 * @returns {string} Der ermittelte Periodenschlüssel (z. B. '2026-09', '2026-Q3', '2026-H2', '2026')
 * @example
 * ```ts
 * const currentMonthKey = getCurrentPeriodKey('monthly'); // '2026-09'
 * const currentQuarterKey = getCurrentPeriodKey('quarterly'); // '2026-Q3'
 * ```
 */
export function getCurrentPeriodKey(
  granularity: PeriodGranularity,
  referenceDate: Date | string | number = new Date()
): string {
  const iso = toISODateString(referenceDate);
  return getPeriodKey(iso, granularity);
}

/**
 * Formatiert einen Perioden-Schlüssel für die Tabellenköpfe lesbar.
 */
export function formatPeriodLabel(periodKey: string, granularity: PeriodGranularity): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mär',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dez',
  ];

  if (granularity === 'monthly') {
    const [year, monthStr] = periodKey.split('-');
    const mIndex = parseInt(monthStr, 10) - 1;
    return `${monthNames[mIndex] || monthStr} ${year}`;
  }

  if (granularity === 'quarterly') {
    const [year, q] = periodKey.split('-');
    return `${q} ${year}`;
  }

  if (granularity === 'halfYearly') {
    const [year, h] = periodKey.split('-');
    return `${h} ${year}`;
  }

  return periodKey;
}

/**
 * Extrahiert das 4-stellige Kalenderjahr aus einem beliebigen Periodenschlüssel.
 *
 * @param {string} periodKey - Periodenschlüssel (z. B. '2024-05', '2024-Q2', '2024-H1', '2024')
 * @returns {string} Das extrahierte Kalenderjahr (z. B. '2024')
 * @example
 * ```ts
 * getYearFromPeriodKey('2024-05'); // '2024'
 * getYearFromPeriodKey('2025-Q1'); // '2025'
 * ```
 */
export function getYearFromPeriodKey(periodKey: string): string {
  return periodKey.split('-')[0];
}

/**
 * Formatiert die Unter-Periode für den zweistufigen Tabellenkopf ohne Jahreszahl,
 * da das Jahr bereits im übergeordneten Jahres-Gruppenkopf gerendert wird.
 *
 * @param {string} periodKey - Periodenschlüssel (z. B. '2024-05', '2024-Q2', '2024-H1', '2024')
 * @param {PeriodGranularity} granularity - Zeit-Granularität
 * @returns {string} Kurzer Unter-Perioden-Name (z. B. 'Mai', 'Q2', 'H1', '2024')
 * @example
 * ```ts
 * formatSubPeriodLabel('2024-05', 'monthly'); // 'Mai'
 * formatSubPeriodLabel('2024-Q2', 'quarterly'); // 'Q2'
 * ```
 */
export function formatSubPeriodLabel(periodKey: string, granularity: PeriodGranularity): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mär',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dez',
  ];

  if (granularity === 'monthly') {
    const parts = periodKey.split('-');
    const mIndex = parseInt(parts[1], 10) - 1;
    return monthNames[mIndex] || parts[1] || periodKey;
  }

  if (granularity === 'quarterly') {
    const parts = periodKey.split('-');
    return parts[1] || periodKey;
  }

  if (granularity === 'halfYearly') {
    const parts = periodKey.split('-');
    return parts[1] || periodKey;
  }

  return periodKey;
}

/**
 * Normalisiert ein Soll-Budget auf die gewählte Darstellungs-Granularität.
 */
export function normalizeBudgetToGranularity(
  budgetAmount: number,
  fromGranularity: PeriodGranularity,
  toGranularity: PeriodGranularity
): number {
  let monthlyEquivalent = budgetAmount;
  switch (fromGranularity) {
    case 'monthly':
      monthlyEquivalent = budgetAmount;
      break;
    case 'quarterly':
      monthlyEquivalent = budgetAmount / 3;
      break;
    case 'halfYearly':
      monthlyEquivalent = budgetAmount / 6;
      break;
    case 'yearly':
      monthlyEquivalent = budgetAmount / 12;
      break;
  }

  switch (toGranularity) {
    case 'monthly':
      return roundToTwoDecimals(monthlyEquivalent);
    case 'quarterly':
      return roundToTwoDecimals(monthlyEquivalent * 3);
    case 'halfYearly':
      return roundToTwoDecimals(monthlyEquivalent * 6);
    case 'yearly':
      return roundToTwoDecimals(monthlyEquivalent * 12);
  }
}

/**
 * Füllt Lücken in einer Liste von Periodenschlüsseln lückenlos auf und erweitert
 * diese optional bis zum aktuellen Zeitraum (oder einem angegebenen End-Zeitraum).
 *
 * @param {string[]} periodKeys - Vorhandene Periodenschlüssel (z. B. ['2026-01', '2026-07'])
 * @param {PeriodGranularity} granularity - Die Zeit-Granularität ('monthly', 'quarterly', 'halfYearly', 'yearly')
 * @param {string} [upToPeriodKey] - Optionaler End-Periodenschlüssel, bis zu dem aufgefüllt werden soll (z. B. '2026-09')
 * @returns {string[]} Chronologisch sortierte, lückenlose Liste von Periodenschlüsseln
 *
 * @example
 * ```ts
 * fillPeriodKeyRange(['2026-01'], 'monthly', '2026-03');
 * // => ['2026-01', '2026-02', '2026-03']
 * ```
 */
export function fillPeriodKeyRange(
  periodKeys: string[],
  granularity: PeriodGranularity,
  upToPeriodKey?: string
): string[] {
  if (periodKeys.length === 0) {
    return upToPeriodKey ? [upToPeriodKey] : [];
  }

  const keySet = new Set<string>(periodKeys);

  if (upToPeriodKey) {
    keySet.add(upToPeriodKey);
    const targetYear = getYearFromPeriodKey(upToPeriodKey);

    const keysInTargetYear = periodKeys.filter((k) => getYearFromPeriodKey(k) === targetYear);

    if (keysInTargetYear.length > 0) {
      if (granularity === 'monthly') {
        const targetMonth = parseInt(upToPeriodKey.split('-')[1], 10);
        const maxExistingMonth = Math.max(
          ...keysInTargetYear.map((k) => parseInt(k.split('-')[1], 10))
        );
        if (maxExistingMonth < targetMonth) {
          for (let m = maxExistingMonth + 1; m <= targetMonth; m++) {
            keySet.add(`${targetYear}-${String(m).padStart(2, '0')}`);
          }
        }
      } else if (granularity === 'quarterly') {
        const targetQ = parseInt(upToPeriodKey.split('-')[1].replace('Q', ''), 10);
        const maxExistingQ = Math.max(
          ...keysInTargetYear.map((k) => parseInt(k.split('-')[1].replace('Q', ''), 10))
        );
        if (maxExistingQ < targetQ) {
          for (let q = maxExistingQ + 1; q <= targetQ; q++) {
            keySet.add(`${targetYear}-Q${q}`);
          }
        }
      } else if (granularity === 'halfYearly') {
        const targetH = parseInt(upToPeriodKey.split('-')[1].replace('H', ''), 10);
        const maxExistingH = Math.max(
          ...keysInTargetYear.map((k) => parseInt(k.split('-')[1].replace('H', ''), 10))
        );
        if (maxExistingH < targetH) {
          for (let h = maxExistingH + 1; h <= targetH; h++) {
            keySet.add(`${targetYear}-H${h}`);
          }
        }
      }
    }
  }

  return Array.from(keySet).sort();
}

/**
 * Ermittelt alle Periodenschlüssel innerhalb eines geschlossenen Datumsbereichs (Start- und Enddatum).
 *
 * @param {string} startDate - Startdatum im ISO-Format (YYYY-MM-DD oder YYYY-MM)
 * @param {string} endDate - Enddatum im ISO-Format (YYYY-MM-DD oder YYYY-MM)
 * @param {PeriodGranularity} granularity - Granularität ('monthly', 'quarterly', 'halfYearly', 'yearly')
 * @returns {string[]} Chronologisch sortierte Liste aller Periodenschlüssel im Bereich
 *
 * @example
 * ```ts
 * getPeriodKeysBetween('2026-07-01', '2026-09-30', 'monthly');
 * // => ['2026-07', '2026-08', '2026-09']
 * ```
 */
export function getPeriodKeysBetween(
  startDate: string,
  endDate: string,
  granularity: PeriodGranularity
): string[] {
  if (!startDate || !endDate) {
    return [];
  }

  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);
  if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) {
    return [];
  }

  const startMonth = parseInt(startDate.substring(5, 7) || '1', 10);
  const endMonth = parseInt(endDate.substring(5, 7) || '12', 10);

  const keys = new Set<string>();

  if (granularity === 'yearly') {
    for (let y = startYear; y <= endYear; y++) {
      keys.add(`${y}`);
    }
  } else if (granularity === 'halfYearly') {
    for (let y = startYear; y <= endYear; y++) {
      const minH = y === startYear ? (startMonth <= 6 ? 1 : 2) : 1;
      const maxH = y === endYear ? (endMonth <= 6 ? 1 : 2) : 2;
      for (let h = minH; h <= maxH; h++) {
        keys.add(`${y}-H${h}`);
      }
    }
  } else if (granularity === 'quarterly') {
    for (let y = startYear; y <= endYear; y++) {
      const minQ = y === startYear ? Math.floor((startMonth - 1) / 3) + 1 : 1;
      const maxQ = y === endYear ? Math.floor((endMonth - 1) / 3) + 1 : 4;
      for (let q = minQ; q <= maxQ; q++) {
        keys.add(`${y}-Q${q}`);
      }
    }
  } else {
    // monthly
    for (let y = startYear; y <= endYear; y++) {
      const minM = y === startYear ? startMonth : 1;
      const maxM = y === endYear ? endMonth : 12;
      for (let m = minM; m <= maxM; m++) {
        keys.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
  }

  return Array.from(keys).sort();
}

/**
 * Verfügbare Schnellauswahl-Presets für Datums- und Periodenbereiche (Monats-, Quartals- & Jahresebene).
 */
export type DateRangePreset =
  | 'this_year'
  | 'this_half_year'
  | 'this_quarter'
  | 'this_month'
  | 'last_year'
  | 'last_half_year'
  | 'last_quarter'
  | 'last_month'
  | 'all_time'
  | 'custom';

/**
 * Ein Datumsbereich mit Start- und Enddatum im Format YYYY-MM-DD (ISODateString)
 * oder Leerstring für unbegrenzte Zeiträume.
 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Definition eines konfigurierbaren Presets für die Benutzeroberfläche.
 */
export interface DateRangePresetConfig {
  id: DateRangePreset;
  label: string;
  group: 'current' | 'past' | 'all';
}

/**
 * Liste aller verfügbaren Presets zur Anzeige im DateRangePicker.
 */
export const DATE_RANGE_PRESETS: DateRangePresetConfig[] = [
  { id: 'this_year', label: 'Dieses Jahr', group: 'current' },
  { id: 'this_half_year', label: 'Dieses Halbjahr', group: 'current' },
  { id: 'this_quarter', label: 'Dieses Quartal', group: 'current' },
  { id: 'this_month', label: 'Dieser Monat', group: 'current' },
  { id: 'last_year', label: 'Letztes Jahr', group: 'past' },
  { id: 'last_half_year', label: 'Letztes Halbjahr', group: 'past' },
  { id: 'last_quarter', label: 'Letztes Quartal', group: 'past' },
  { id: 'last_month', label: 'Letzter Monat', group: 'past' },
  { id: 'all_time', label: 'Gesamter Zeitraum', group: 'all' },
];

/**
 * Ermittelt die Anzahl der Tage eines Monats unter Berücksichtigung von Schaltjahren.
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formatiert Jahr, Monat und Tag zu einem ISO-Datumsstring (YYYY-MM-DD).
 */
function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Berechnet Start- und Enddatum für ein vorgegebenes DateRangePreset bezogen auf ein Referenzdatum.
 *
 * @param {DateRangePreset} preset - Das gewählte Preset
 * @param {Date | string | number} [referenceDate=new Date()] - Referenzzeitpunkt (Standard: heute)
 * @returns {DateRange} Objekt mit startDate und endDate (jeweils Format YYYY-MM-DD)
 *
 * @example
 * ```ts
 * getDateRangeForPreset('this_year', new Date(2026, 8, 3));
 * // => { startDate: '2026-01-01', endDate: '2026-12-31' }
 * ```
 */
export function getDateRangeForPreset(
  preset: DateRangePreset,
  referenceDate: Date | string | number = new Date()
): DateRange {
  if (preset === 'all_time') {
    return { startDate: '', endDate: '' };
  }

  const ref =
    referenceDate instanceof Date
      ? referenceDate
      : typeof referenceDate === 'string' || typeof referenceDate === 'number'
        ? new Date(referenceDate)
        : new Date();

  const year = ref.getFullYear();
  const month = ref.getMonth() + 1; // 1-12

  switch (preset) {
    case 'this_year':
      return {
        startDate: formatIso(year, 1, 1),
        endDate: formatIso(year, 12, 31),
      };

    case 'last_year':
      return {
        startDate: formatIso(year - 1, 1, 1),
        endDate: formatIso(year - 1, 12, 31),
      };

    case 'this_half_year': {
      const isH1 = month <= 6;
      return {
        startDate: isH1 ? formatIso(year, 1, 1) : formatIso(year, 7, 1),
        endDate: isH1 ? formatIso(year, 6, 30) : formatIso(year, 12, 31),
      };
    }

    case 'last_half_year': {
      const isH1 = month <= 6;
      return {
        startDate: isH1 ? formatIso(year - 1, 7, 1) : formatIso(year, 1, 1),
        endDate: isH1 ? formatIso(year - 1, 12, 31) : formatIso(year, 6, 30),
      };
    }

    case 'this_quarter': {
      const q = Math.floor((month - 1) / 3) + 1;
      const startM = (q - 1) * 3 + 1;
      const endM = q * 3;
      return {
        startDate: formatIso(year, startM, 1),
        endDate: formatIso(year, endM, getLastDayOfMonth(year, endM)),
      };
    }

    case 'last_quarter': {
      const q = Math.floor((month - 1) / 3) + 1;
      const prevQ = q === 1 ? 4 : q - 1;
      const prevQYear = q === 1 ? year - 1 : year;
      const startM = (prevQ - 1) * 3 + 1;
      const endM = prevQ * 3;
      return {
        startDate: formatIso(prevQYear, startM, 1),
        endDate: formatIso(prevQYear, endM, getLastDayOfMonth(prevQYear, endM)),
      };
    }

    case 'this_month':
      return {
        startDate: formatIso(year, month, 1),
        endDate: formatIso(year, month, getLastDayOfMonth(year, month)),
      };

    case 'last_month': {
      const prevM = month === 1 ? 12 : month - 1;
      const prevMYear = month === 1 ? year - 1 : year;
      return {
        startDate: formatIso(prevMYear, prevM, 1),
        endDate: formatIso(prevMYear, prevM, getLastDayOfMonth(prevMYear, prevM)),
      };
    }

    default:
      return { startDate: '', endDate: '' };
  }
}

/**
 * Erzeugt einen Datumsbereich vom 1. Tag des Startmonats bis zum letzten Tag des Endmonats.
 *
 * @param {string} startMonthKey - Startmonat im Format YYYY-MM
 * @param {string} endMonthKey - Endmonat im Format YYYY-MM
 * @returns {DateRange} Bereich mit startDate und endDate
 *
 * @example
 * ```ts
 * getMonthDateRange('2025-02', '2025-04');
 * // => { startDate: '2025-02-01', endDate: '2025-04-30' }
 * ```
 */
export function getMonthDateRange(startMonthKey: string, endMonthKey: string): DateRange {
  if (!startMonthKey && !endMonthKey) {
    return { startDate: '', endDate: '' };
  }

  const [sY, sM] = (startMonthKey || endMonthKey).split('-').map(Number);
  const [eY, eM] = (endMonthKey || startMonthKey).split('-').map(Number);

  const startDate = formatIso(sY, sM, 1);
  const endDate = formatIso(eY, eM, getLastDayOfMonth(eY, eM));

  return { startDate, endDate };
}

/**
 * Erkennt, ob ein gegebener Von-Bis-Datumsbereich exakt einem Standard-Preset entspricht.
 *
 * @param {string} startDate - Startdatum YYYY-MM-DD
 * @param {string} endDate - Enddatum YYYY-MM-DD
 * @param {Date | string | number} [referenceDate=new Date()] - Referenzzeitpunkt
 * @returns {DateRangePreset} Das erkannte Preset oder 'custom'
 */
export function detectPresetForRange(
  startDate: string,
  endDate: string,
  referenceDate: Date | string | number = new Date()
): DateRangePreset {
  if (!startDate && !endDate) {
    return 'all_time';
  }

  const presets: DateRangePreset[] = [
    'this_year',
    'this_half_year',
    'this_quarter',
    'this_month',
    'last_year',
    'last_half_year',
    'last_quarter',
    'last_month',
  ];

  for (const p of presets) {
    const r = getDateRangeForPreset(p, referenceDate);
    if (r.startDate === startDate && r.endDate === endDate) {
      return p;
    }
  }

  return 'custom';
}

/**
 * Formatiert einen Datumsbereich kompakt und lesbar für den Trigger-Button.
 *
 * @param {string} startDate - Startdatum YYYY-MM-DD
 * @param {string} endDate - Enddatum YYYY-MM-DD
 * @param {Date | string | number} [referenceDate=new Date()] - Referenzzeitpunkt
 * @returns {string} Lesbare Beschriftung (z. B. "Dieses Jahr (2026)", "Mär 2025 – Jul 2026")
 */
export function formatDateRangeDisplay(
  startDate: string,
  endDate: string,
  referenceDate: Date | string | number = new Date()
): string {
  if (!startDate && !endDate) {
    return 'Gesamter Zeitraum';
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mär',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dez',
  ];

  const preset = detectPresetForRange(startDate, endDate, referenceDate);

  const ref =
    referenceDate instanceof Date
      ? referenceDate
      : typeof referenceDate === 'string' || typeof referenceDate === 'number'
        ? new Date(referenceDate)
        : new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1;

  switch (preset) {
    case 'this_year':
      return `Dieses Jahr (${year})`;
    case 'last_year':
      return `Letztes Jahr (${year - 1})`;
    case 'this_half_year': {
      const h = month <= 6 ? 1 : 2;
      return `Dieses Halbjahr (H${h} ${year})`;
    }
    case 'last_half_year': {
      const isH1 = month <= 6;
      return isH1 ? `Letztes Halbjahr (H2 ${year - 1})` : `Letztes Halbjahr (H1 ${year})`;
    }
    case 'this_quarter': {
      const q = Math.floor((month - 1) / 3) + 1;
      return `Dieses Quartal (Q${q} ${year})`;
    }
    case 'last_quarter': {
      const q = Math.floor((month - 1) / 3) + 1;
      const prevQ = q === 1 ? 4 : q - 1;
      const prevY = q === 1 ? year - 1 : year;
      return `Letztes Quartal (Q${prevQ} ${prevY})`;
    }
    case 'this_month': {
      return `Dieser Monat (${monthNames[month - 1]} ${year})`;
    }
    case 'last_month': {
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      return `Letzter Monat (${monthNames[prevM - 1]} ${prevY})`;
    }
    default:
      break;
  }

  if (startDate && endDate) {
    const [sY, sM] = startDate.split('-');
    const [eY, eM] = endDate.split('-');
    const startLabel = `${monthNames[Number(sM) - 1]} ${sY}`;
    const endLabel = `${monthNames[Number(eM) - 1]} ${eY}`;

    if (startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }

  if (startDate) {
    const [sY, sM] = startDate.split('-');
    return `Ab ${monthNames[Number(sM) - 1]} ${sY}`;
  }

  const [eY, eM] = endDate.split('-');
  return `Bis ${monthNames[Number(eM) - 1]} ${eY}`;
}
