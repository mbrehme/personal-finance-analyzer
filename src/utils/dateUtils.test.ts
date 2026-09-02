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

    it('parses German date format DD.MM.YYYY', () => {
      expect(toISODateString('15.03.2026')).toBe('2026-03-15');
      expect(toISODateString('1.5.2026')).toBe('2026-05-01');
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
});
