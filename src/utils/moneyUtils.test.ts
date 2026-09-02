/**
 * @file moneyUtils.test.ts
 * @description Unit-Tests für moneyUtils.
 * @module utils/moneyUtils.test
 */

import { describe, it, expect } from 'vitest';
import { formatMoney, roundToTwoDecimals } from './moneyUtils';

describe('moneyUtils', () => {
  describe('formatMoney', () => {
    it('always formats integers with two decimal places', () => {
      const formatted = formatMoney(1200);
      expect(formatted).toMatch(/1\.200,00\s*€/);
    });

    it('always formats single decimal with trailing zero', () => {
      const formatted = formatMoney(1200.5);
      expect(formatted).toMatch(/1\.200,50\s*€/);
    });

    it('formats negative amounts with minus sign', () => {
      const formatted = formatMoney(-42.1);
      expect(formatted).toMatch(/-42,10\s*€/);
    });

    it('respects signDisplay always', () => {
      const positive = formatMoney(50, { signDisplay: 'always' });
      expect(positive).toMatch(/\+50,00\s*€/);

      const negative = formatMoney(-50, { signDisplay: 'always' });
      expect(negative).toMatch(/-50,00\s*€/);
    });

    it('formats without symbol when withSymbol is false', () => {
      const formatted = formatMoney(1234.56, { withSymbol: false });
      expect(formatted).toBe('1.234,56');
    });
  });

  describe('roundToTwoDecimals', () => {
    it('rounds floating point numbers to two decimals', () => {
      expect(roundToTwoDecimals(12.3456)).toBe(12.35);
      expect(roundToTwoDecimals(12.3444)).toBe(12.34);
      expect(roundToTwoDecimals(210.68 * 12)).toBe(2528.16);
      expect(roundToTwoDecimals(1000 / 3)).toBe(333.33);
    });
  });
});

