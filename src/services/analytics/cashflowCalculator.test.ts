/**
 * @file cashflowCalculator.test.ts
 * @description Unit-Tests für die Cashflow-Berechnungs-Engine.
 * @module services/analytics/cashflowCalculator.test
 */

import { describe, it, expect } from 'vitest';
import { calculateCashflowMatrix, extractPeriodKeys } from './cashflowCalculator';
import { Bucket, Transaction } from '@/types/finance';

describe('cashflowCalculator', () => {
  const buckets: Bucket[] = [
    {
      id: 'b-living',
      name: 'Wohnen',
      parentId: null,
      targetBudget: { period: 'monthly', amount: 1500 },
    },
    {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
    },
    {
      id: 'b-salary',
      name: 'Gehalt',
      parentId: null,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      valueDate: '2026-08-01',
      bookingDate: '2026-08-01',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      iban: 'DE00',
      value: 3000,
      bucketId: 'b-salary',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      valueDate: '2026-08-02',
      bookingDate: '2026-08-02',
      issuer: 'Me',
      receiver: 'Vermieter',
      subject: 'Miete',
      type: 'outbound',
      iban: 'DE00',
      value: -1200,
      bucketId: 'b-rent',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-3',
      accountId: 'acc-1',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      iban: 'DE00',
      value: 3000,
      bucketId: 'b-salary',
      assignmentSource: 'auto_regex',
    },
  ];

  it('extracts unique sorted period keys', () => {
    const keys = extractPeriodKeys(transactions, 'monthly');
    expect(keys).toEqual(['2026-08', '2026-09']);
  });

  it('rolls up child bucket sums to parent bucket in cashflow matrix', () => {
    const matrix = calculateCashflowMatrix(buckets, transactions, 'monthly');
    expect(matrix.periodKeys).toEqual(['2026-08', '2026-09']);

    const livingRow = matrix.rows.find((r) => r.bucket.id === 'b-living');
    expect(livingRow).toBeDefined();
    expect(livingRow?.hasChildren).toBe(true);
    // In August: Miete = -1200 gerollt zu Wohnen
    expect(livingRow?.periods['2026-08'].outbound).toBe(-1200);
    expect(livingRow?.periods['2026-08'].budget).toBe(1500);

    const rentRow = matrix.rows.find((r) => r.bucket.id === 'b-rent');
    expect(rentRow?.depth).toBe(1);
    expect(rentRow?.periods['2026-08'].outbound).toBe(-1200);

    const salaryRow = matrix.rows.find((r) => r.bucket.id === 'b-salary');
    expect(salaryRow?.periods['2026-08'].inbound).toBe(3000);
    expect(salaryRow?.periods['2026-09'].inbound).toBe(3000);

    // Gesamtsumme
    expect(matrix.totalRow.periods['2026-08'].net).toBe(1800);
    expect(matrix.totalRow.periods['2026-09'].net).toBe(3000);
    expect(matrix.totalRow.totalNet).toBe(4800);
  });
});
