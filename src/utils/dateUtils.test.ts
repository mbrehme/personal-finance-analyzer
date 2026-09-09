/**
 * @file dateUtils.test.ts
 * @description Unit-Tests für dateUtils.
 * @module utils/dateUtils.test
 */

import { describe, it, expect } from 'vitest';
import {
  isValidDateString,
  toISODateString,
  formatDate,
  getPeriodKey,
  formatPeriodLabel,
  normalizeBudgetToGranularity,
  getCurrentPeriodKey,
  getYearFromPeriodKey,
  formatSubPeriodLabel,
  fillPeriodKeyRange,
  getPeriodKeysBetween,
  getDateRangeForPreset,
  getMonthDateRange,
  detectPresetForRange,
  formatDateRangeDisplay,
  getDayBefore,
  getPeriodDateRange,
} from './dateUtils';
import { ISODateString } from '@/types/finance';

describe('dateUtils', () => {
  describe('isValidDateString', () => {
    it('returns true for valid ISO dates', () => {
      expect(isValidDateString('2026-09-02')).toBe(true);
      expect(isValidDateString('2024-02-29')).toBe(true); // Schaltjahr
    });

    it('returns false for invalid ISO dates', () => {
      expect(isValidDateString('2026-02-30')).toBe(false);
      expect(isValidDateString('02.09.2026')).toBe(false);
      expect(isValidDateString('invalid')).toBe(false);
    });
  });

  describe('toISODateString', () => {
    it('handles Date objects', () => {
      const d = new Date(2026, 8, 2);
      expect(toISODateString(d)).toBe('2026-09-02');
    });

    it('parses German date format DD.MM.YYYY and 2-digit year DD.MM.YY', () => {
      expect(toISODateString('15.03.2026')).toBe('2026-03-15');
      expect(toISODateString('1.5.2026')).toBe('2026-05-01');
      expect(toISODateString('20.07.26')).toBe('2026-07-20');
      expect(toISODateString('01.01.24')).toBe('2024-01-01');
    });

    it('parses slash and dash date formats with 2-digit or 4-digit years', () => {
      expect(toISODateString('20/07/26')).toBe('2026-07-20');
      expect(toISODateString('20/07/2026')).toBe('2026-07-20');
      expect(toISODateString('20-07-26')).toBe('2026-07-20');
      expect(toISODateString('20-07-2026')).toBe('2026-07-20');
    });

    it('parses ISO date strings with timestamps', () => {
      expect(toISODateString('2026-07-20T14:30:00.000Z')).toBe('2026-07-20');
      expect(toISODateString('2026-07-20 09:15:00')).toBe('2026-07-20');
    });

    it('passes through valid ISO date string', () => {
      expect(toISODateString('2026-11-20')).toBe('2026-11-20');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date to German display format', () => {
      expect(formatDate('2026-09-02' as ISODateString)).toBe('02.09.2026');
    });
  });

  describe('getPeriodKey & formatPeriodLabel', () => {
    const testDate: ISODateString = '2026-09-15';

    it('generates correct monthly period key and label', () => {
      const key = getPeriodKey(testDate, 'monthly');
      expect(key).toBe('2026-09');
      expect(formatPeriodLabel(key, 'monthly')).toBe('Sep 2026');
    });

    it('generates correct quarterly period key and label', () => {
      const key = getPeriodKey(testDate, 'quarterly');
      expect(key).toBe('2026-Q3');
      expect(formatPeriodLabel(key, 'quarterly')).toBe('Q3 2026');
    });

    it('generates correct half-yearly period key and label', () => {
      const key = getPeriodKey(testDate, 'halfYearly');
      expect(key).toBe('2026-H2');
      expect(formatPeriodLabel(key, 'halfYearly')).toBe('H2 2026');
    });

    it('generates correct yearly period key and label', () => {
      const key = getPeriodKey(testDate, 'yearly');
      expect(key).toBe('2026');
      expect(formatPeriodLabel(key, 'yearly')).toBe('2026');
    });
  });

  describe('normalizeBudgetToGranularity', () => {
    it('scales monthly budget up to quarterly, half-yearly and yearly', () => {
      expect(normalizeBudgetToGranularity(100, 'monthly', 'quarterly')).toBe(300);
      expect(normalizeBudgetToGranularity(100, 'monthly', 'halfYearly')).toBe(600);
      expect(normalizeBudgetToGranularity(100, 'monthly', 'yearly')).toBe(1200);
    });

    it('scales yearly budget down to monthly', () => {
      expect(normalizeBudgetToGranularity(1200, 'yearly', 'monthly')).toBe(100);
    });
  });

  describe('getCurrentPeriodKey', () => {
    const fixedDate = new Date(2026, 8, 2); // 2026-09-02

    it('returns the current period key for a given date across all granularities', () => {
      expect(getCurrentPeriodKey('monthly', fixedDate)).toBe('2026-09');
      expect(getCurrentPeriodKey('quarterly', fixedDate)).toBe('2026-Q3');
      expect(getCurrentPeriodKey('halfYearly', fixedDate)).toBe('2026-H2');
      expect(getCurrentPeriodKey('yearly', fixedDate)).toBe('2026');
    });

    it('defaults to current date when no referenceDate is provided', () => {
      const now = new Date();
      const currentYear = String(now.getFullYear());
      expect(getCurrentPeriodKey('yearly')).toBe(currentYear);
    });
  });

  describe('getYearFromPeriodKey', () => {
    it('extracts the 4-digit year from various period key formats', () => {
      expect(getYearFromPeriodKey('2024-05')).toBe('2024');
      expect(getYearFromPeriodKey('2025-Q2')).toBe('2025');
      expect(getYearFromPeriodKey('2026-H1')).toBe('2026');
      expect(getYearFromPeriodKey('2027')).toBe('2027');
    });
  });

  describe('formatSubPeriodLabel', () => {
    it('formats short month label without year for monthly granularity', () => {
      expect(formatSubPeriodLabel('2024-01', 'monthly')).toBe('Jan');
      expect(formatSubPeriodLabel('2024-05', 'monthly')).toBe('Mai');
      expect(formatSubPeriodLabel('2024-12', 'monthly')).toBe('Dez');
    });

    it('formats quarter and half-year labels cleanly', () => {
      expect(formatSubPeriodLabel('2024-Q3', 'quarterly')).toBe('Q3');
      expect(formatSubPeriodLabel('2024-H2', 'halfYearly')).toBe('H2');
      expect(formatSubPeriodLabel('2024', 'yearly')).toBe('2024');
    });
  });

  describe('fillPeriodKeyRange', () => {
    it('returns empty array when no keys and no upToKey are provided', () => {
      expect(fillPeriodKeyRange([], 'monthly')).toEqual([]);
    });

    it('returns upToKey if periodKeys is empty', () => {
      expect(fillPeriodKeyRange([], 'monthly', '2026-09')).toEqual(['2026-09']);
    });

    it('fills gap between latest month in target year and upToPeriodKey', () => {
      const keys = ['2026-06', '2026-07'];
      const result = fillPeriodKeyRange(keys, 'monthly', '2026-09');
      expect(result).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
    });

    it('does not create intermediate empty years', () => {
      const keys = ['2023-05', '2026-07'];
      const result = fillPeriodKeyRange(keys, 'monthly', '2026-09');
      expect(result).toEqual(['2023-05', '2026-07', '2026-08', '2026-09']);
    });

    it('fills quarterly and halfYearly ranges up to upToPeriodKey', () => {
      expect(fillPeriodKeyRange(['2026-Q1'], 'quarterly', '2026-Q3')).toEqual([
        '2026-Q1',
        '2026-Q2',
        '2026-Q3',
      ]);
      expect(fillPeriodKeyRange(['2026-H1'], 'halfYearly', '2026-H2')).toEqual([
        '2026-H1',
        '2026-H2',
      ]);
    });
  });

  describe('getDateRangeForPreset', () => {
    // Referenzdatum: 15. September 2026 (Q3, H2)
    const refDate = new Date(2026, 8, 15);

    it('calculates this_year and last_year correctly', () => {
      expect(getDateRangeForPreset('this_year', refDate)).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(getDateRangeForPreset('last_year', refDate)).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    });

    it('calculates this_half_year and last_half_year correctly', () => {
      // September ist H2
      expect(getDateRangeForPreset('this_half_year', refDate)).toEqual({
        startDate: '2026-07-01',
        endDate: '2026-12-31',
      });
      // Vorheriges Halbjahr ist H1 2026
      expect(getDateRangeForPreset('last_half_year', refDate)).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });

      // Wenn Referenzdatum in H1 liegt (z.B. März 2026):
      const refH1 = new Date(2026, 2, 10);
      expect(getDateRangeForPreset('this_half_year', refH1)).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });
      expect(getDateRangeForPreset('last_half_year', refH1)).toEqual({
        startDate: '2025-07-01',
        endDate: '2025-12-31',
      });
    });

    it('calculates this_quarter and last_quarter correctly', () => {
      // September ist Q3
      expect(getDateRangeForPreset('this_quarter', refDate)).toEqual({
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      });
      expect(getDateRangeForPreset('last_quarter', refDate)).toEqual({
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      });

      // Januar (Q1): last_quarter sollte Q4 des Vorjahres sein
      const refQ1 = new Date(2026, 0, 15);
      expect(getDateRangeForPreset('this_quarter', refQ1)).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });
      expect(getDateRangeForPreset('last_quarter', refQ1)).toEqual({
        startDate: '2025-10-01',
        endDate: '2025-12-31',
      });
    });

    it('calculates this_month and last_month correctly', () => {
      // September (30 Tage)
      expect(getDateRangeForPreset('this_month', refDate)).toEqual({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      expect(getDateRangeForPreset('last_month', refDate)).toEqual({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      // Januar: Vormonat ist Dezember des Vorjahres
      const refJan = new Date(2026, 0, 15);
      expect(getDateRangeForPreset('last_month', refJan)).toEqual({
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      });
    });

    it('returns empty strings for all_time', () => {
      expect(getDateRangeForPreset('all_time', refDate)).toEqual({
        startDate: '',
        endDate: '',
      });
    });
  });

  describe('getMonthDateRange', () => {
    it('creates accurate full-month date boundaries', () => {
      expect(getMonthDateRange('2025-02', '2025-04')).toEqual({
        startDate: '2025-02-01',
        endDate: '2025-04-30',
      });
    });

    it('handles leap year in February', () => {
      expect(getMonthDateRange('2024-02', '2024-02')).toEqual({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });
      expect(getMonthDateRange('2025-02', '2025-02')).toEqual({
        startDate: '2025-02-01',
        endDate: '2025-02-28',
      });
    });

    it('allows open-ended date ranges when only startMonth or only endMonth is provided', () => {
      expect(getMonthDateRange('2025-02', '')).toEqual({
        startDate: '2025-02-01',
        endDate: '',
      });
      expect(getMonthDateRange('', '2025-05')).toEqual({
        startDate: '',
        endDate: '2025-05-31',
      });
      expect(getMonthDateRange('', '')).toEqual({
        startDate: '',
        endDate: '',
      });
    });
  });

  describe('detectPresetForRange & formatDateRangeDisplay', () => {
    const refDate = new Date(2026, 8, 15);

    it('detects presets correctly', () => {
      expect(detectPresetForRange('2026-01-01', '2026-12-31', refDate)).toBe('this_year');
      expect(detectPresetForRange('2026-07-01', '2026-12-31', refDate)).toBe('this_half_year');
      expect(detectPresetForRange('2026-07-01', '2026-09-30', refDate)).toBe('this_quarter');
      expect(detectPresetForRange('2026-09-01', '2026-09-30', refDate)).toBe('this_month');
      expect(detectPresetForRange('', '', refDate)).toBe('all_time');
      expect(detectPresetForRange('2025-03-01', '2026-05-31', refDate)).toBe('custom');
    });

    it('formats display labels cleanly', () => {
      expect(formatDateRangeDisplay('2026-01-01', '2026-12-31', refDate)).toBe(
        'Dieses Jahr (2026)'
      );
      expect(formatDateRangeDisplay('', '', refDate)).toBe('Gesamter Zeitraum');
      expect(formatDateRangeDisplay('2025-03-01', '2026-05-31', refDate)).toBe(
        'Mär 2025 – Mai 2026'
      );
      expect(formatDateRangeDisplay('2025-03-01', '2025-03-31', refDate)).toBe('Mär 2025');
    });
  });

  describe('getPeriodKeysBetween', () => {
    it('returns exact period keys for monthly granularity', () => {
      expect(getPeriodKeysBetween('2026-09-01', '2026-09-30', 'monthly')).toEqual(['2026-09']);
      expect(getPeriodKeysBetween('2026-07-01', '2026-09-30', 'monthly')).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
      expect(getPeriodKeysBetween('2025-11-01', '2026-02-28', 'monthly')).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
      ]);
    });

    it('returns exact period keys for quarterly, halfYearly, and yearly', () => {
      expect(getPeriodKeysBetween('2026-07-01', '2026-09-30', 'quarterly')).toEqual(['2026-Q3']);
      expect(getPeriodKeysBetween('2026-01-01', '2026-12-31', 'halfYearly')).toEqual([
        '2026-H1',
        '2026-H2',
      ]);
      expect(getPeriodKeysBetween('2024-01-01', '2026-12-31', 'yearly')).toEqual([
        '2024',
        '2025',
        '2026',
      ]);
    });

    it('returns empty array when inputs are missing or invalid', () => {
      expect(getPeriodKeysBetween('', '', 'monthly')).toEqual([]);
      expect(getPeriodKeysBetween('2026-09-01', '', 'monthly')).toEqual([]);
      expect(getPeriodKeysBetween('2027-01-01', '2026-01-01', 'monthly')).toEqual([]);
    });
  });

  describe('getDayBefore', () => {
    it('calculates the previous day correctly across month and year boundaries', () => {
      expect(getDayBefore('2026-01-01')).toBe('2025-12-31');
      expect(getDayBefore('2026-03-01')).toBe('2026-02-28');
      // Schaltjahr
      expect(getDayBefore('2024-03-01')).toBe('2024-02-29');
      expect(getDayBefore('2026-09-15')).toBe('2026-09-14');
    });
  });

  describe('getPeriodDateRange', () => {
    it('returns start and end date for monthly granularity', () => {
      expect(getPeriodDateRange('2026-02', 'monthly')).toEqual({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
      expect(getPeriodDateRange('2024-02', 'monthly')).toEqual({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });
      expect(getPeriodDateRange('2026-09', 'monthly')).toEqual({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
    });

    it('returns start and end date for quarterly, halfYearly, and yearly', () => {
      expect(getPeriodDateRange('2026-Q1', 'quarterly')).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });
      expect(getPeriodDateRange('2026-Q4', 'quarterly')).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      });
      expect(getPeriodDateRange('2026-H1', 'halfYearly')).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });
      expect(getPeriodDateRange('2026-H2', 'halfYearly')).toEqual({
        startDate: '2026-07-01',
        endDate: '2026-12-31',
      });
      expect(getPeriodDateRange('2026', 'yearly')).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
    });
  });
});
