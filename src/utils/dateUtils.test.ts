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
});
