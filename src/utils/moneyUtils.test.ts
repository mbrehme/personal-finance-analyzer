/**
 * @file moneyUtils.test.ts
 * @description Unit-Tests für moneyUtils.
 * @module utils/moneyUtils.test
 */

import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  roundToTwoDecimals,
  parseCurrencyValue,
  formatAmountForInput,
} from './moneyUtils';

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

  describe('parseCurrencyValue', () => {
    it('correctly parses German formatted numbers with thousand separators and cents', () => {
      expect(parseCurrencyValue('16.930,02')).toBe(16930.02);
      expect(parseCurrencyValue('16.930,02 €')).toBe(16930.02);
      expect(parseCurrencyValue('16930,02')).toBe(16930.02);
      expect(parseCurrencyValue('1.250,50 €')).toBe(1250.5);
      expect(parseCurrencyValue('0,02')).toBe(0.02);
      expect(parseCurrencyValue(',02')).toBe(0.02);
      expect(parseCurrencyValue('.02')).toBe(0.02);
      expect(parseCurrencyValue('16.930')).toBe(16930);
    });

    it('handles international and alternate formats', () => {
      expect(parseCurrencyValue('16,930.02')).toBe(16930.02);
      expect(parseCurrencyValue('16930.02')).toBe(16930.02);
      expect(parseCurrencyValue('2 500,00')).toBe(2500);
      expect(parseCurrencyValue("2'500.00")).toBe(2500);
    });

    it('handles negative signs and accounting notation', () => {
      expect(parseCurrencyValue('-16.930,02')).toBe(-16930.02);
      expect(parseCurrencyValue('16.930,02-')).toBe(-16930.02);
      expect(parseCurrencyValue('(16.930,02)')).toBe(-16930.02);
      expect(parseCurrencyValue('16.930,02 S')).toBe(-16930.02);
      expect(parseCurrencyValue('16.930,02 H')).toBe(16930.02);
    });

    it('returns 0 for empty or invalid input', () => {
      expect(parseCurrencyValue('')).toBe(0);
      expect(parseCurrencyValue('   ')).toBe(0);
      expect(parseCurrencyValue('abc')).toBe(0);
    });
  });

  describe('formatAmountForInput', () => {
    it('returns empty string for 0 or NaN', () => {
      expect(formatAmountForInput(0)).toBe('');
      expect(formatAmountForInput(NaN)).toBe('');
    });

    it('formats integers without decimal places', () => {
      expect(formatAmountForInput(100)).toBe('100');
      expect(formatAmountForInput(1200)).toBe('1.200');
    });

    it('formats numbers with decimals using comma and two fraction digits', () => {
      expect(formatAmountForInput(16930.02)).toBe('16.930,02');
      expect(formatAmountForInput(150.5)).toBe('150,50');
      expect(formatAmountForInput(0.02)).toBe('0,02');
    });
  });
});
