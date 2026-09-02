/**
 * @file dateUtils.ts
 * @description Typsichere Datums- und Perioden-Helfer für das Format ISODateString (YYYY-MM-DD)
 * und Perioden-Aggregationen (Monat, Quartal, Halbjahr, Jahr).
 * @module utils/dateUtils
 */

import { ISODateString, PeriodGranularity } from '@/types/finance';

/**
 * Validiert, ob ein gegebener String ein valides ISO-Datum (YYYY-MM-DD) darstellt.
 */
export function isValidDateString(dateStr: string): dateStr is ISODateString {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Wandelt ein Date-Objekt, einen Zeitstempel oder einen Datumsstring sicher in einen `ISODateString` um.
 */
export function toISODateString(dateInput: Date | string | number): ISODateString {
  if (typeof dateInput === 'string' && isValidDateString(dateInput)) {
    return dateInput;
  }

  // Parse deutsches Format DD.MM.YYYY
  if (typeof dateInput === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateInput)) {
    const [day, month, year] = dateInput.split('.');
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (isValidDateString(iso)) {
      return iso;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    throw new Error(`Ungültiges Datum: ${dateInput}`);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODateString;
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
 * Formatiert einen Perioden-Schlüssel für die Tabellenköpfe lesbar.
 */
export function formatPeriodLabel(periodKey: string, granularity: PeriodGranularity): string {
  const monthNames = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
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
      return monthlyEquivalent;
    case 'quarterly':
      return monthlyEquivalent * 3;
    case 'halfYearly':
      return monthlyEquivalent * 6;
    case 'yearly':
      return monthlyEquivalent * 12;
  }
}
