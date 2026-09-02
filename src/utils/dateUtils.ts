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
        rawYear.length === 2
          ? Number(rawYear) < 70
            ? `20${rawYear}`
            : `19${rawYear}`
          : rawYear;
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
        rawYear.length === 2
          ? Number(rawYear) < 70
            ? `20${rawYear}`
            : `19${rawYear}`
          : rawYear;
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
        rawYear.length === 2
          ? Number(rawYear) < 70
            ? `20${rawYear}`
            : `19${rawYear}`
          : rawYear;
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
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
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
      return monthlyEquivalent;
    case 'quarterly':
      return monthlyEquivalent * 3;
    case 'halfYearly':
      return monthlyEquivalent * 6;
    case 'yearly':
      return monthlyEquivalent * 12;
  }
}
