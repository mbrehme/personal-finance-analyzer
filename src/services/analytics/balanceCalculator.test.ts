/**
 * @file balanceCalculator.test.ts
 * @description Unit-Tests für die Salden-Berechnungs-Engine.
 * @module services/analytics/balanceCalculator.test
 */

import { describe, it, expect } from 'vitest';
import { calculateAllBalances } from './balanceCalculator';
import { Account, Transaction } from '@/types/finance';

describe('balanceCalculator', () => {
  const account: Account = {
    id: 'acc-giro',
    name: 'Girokonto',
    bucketIds: [],
    balanceEntries: [
      {
        id: 'be-1',
        date: '2026-08-01',
        amount: 2000,
        note: 'Startsaldo',
      },
    ],
  };

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-giro',
      valueDate: '2026-08-15',
      bookingDate: '2026-08-15',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      iban: 'DE00',
      value: 1000,
      bucketId: null,
      assignmentSource: 'unassigned',
    },
    {
      id: 'tx-2',
      accountId: 'acc-giro',
      valueDate: '2026-09-05',
      bookingDate: '2026-09-05',
      issuer: 'Me',
      receiver: 'Miete',
      subject: 'Miete September',
      type: 'outbound',
      iban: 'DE00',
      value: -800,
      bucketId: null,
      assignmentSource: 'unassigned',
    },
  ];

  it('calculates running balance across multiple monthly periods with checkpoints', () => {
    const result = calculateAllBalances([account], transactions, 'monthly');
    expect(result.periodKeys).toEqual(['2026-08', '2026-09']);

    const giroRow = result.rows[0];
    expect(giroRow).toBeDefined();

    // August: Start 2000, Cashflow +1000 => End 3000
    expect(giroRow.periods['2026-08'].startBalance).toBe(2000);
    expect(giroRow.periods['2026-08'].cashflow).toBe(1000);
    expect(giroRow.periods['2026-08'].endBalance).toBe(3000);

    // September: Start 3000, Cashflow -800 => End 2200
    expect(giroRow.periods['2026-09'].startBalance).toBe(3000);
    expect(giroRow.periods['2026-09'].cashflow).toBe(-800);
    expect(giroRow.periods['2026-09'].endBalance).toBe(2200);

    expect(giroRow.latestBalance).toBe(2200);
    expect(result.totalRow.latestBalance).toBe(2200);
  });
});
