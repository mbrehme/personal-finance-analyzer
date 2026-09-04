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
    categoryIds: [],
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
      categoryId: null,
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
      categoryId: null,
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

  it('filters by selectedAccountId and custom date range', () => {
    const secondAccount: Account = {
      id: 'acc-tagesgeld',
      name: 'Tagesgeld',
      categoryIds: [],
      balanceEntries: [],
    };

    const result = calculateAllBalances(
      [account, secondAccount],
      transactions,
      'monthly',
      'acc-giro',
      {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }
    );

    expect(result.periodKeys).toEqual(['2026-09']);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].account.id).toBe('acc-giro');
  });

  it('calculates virtual subaccount balance based on category filter and does not double-count in totalRow', () => {
    const realAccount: Account = {
      id: 'acc-real-1',
      name: 'Haupt-Girokonto',
      accountType: 'real',
      iban: 'DE89 3704 0044',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 5000 }],
    };

    const virtualSubaccount: Account = {
      id: 'acc-virtual-travel',
      name: 'Urlaubstopf',
      accountType: 'virtual',
      parentAccountId: 'acc-real-1',
      categoryIds: ['cat-travel'],
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 500 }],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-real-1',
        valueDate: '2026-08-10',
        bookingDate: '2026-08-10',
        issuer: 'Employer',
        receiver: 'Me',
        subject: 'Salary',
        iban: 'DE8937040044',
        value: 2000,
        categoryId: 'cat-salary',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-2',
        accountId: 'acc-real-1',
        valueDate: '2026-08-15',
        bookingDate: '2026-08-15',
        issuer: 'Me',
        receiver: 'Airline',
        subject: 'Flugbuchung Urlaub',
        iban: 'DE8937040044',
        value: -300,
        categoryId: 'cat-travel',
        assignmentSource: 'auto_regex',
      },
    ];

    const result = calculateAllBalances([realAccount, virtualSubaccount], txs, 'monthly');

    // Rows contain Real Account first, followed by its Virtual Subaccount
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].account.id).toBe('acc-real-1');
    expect(result.rows[1].account.id).toBe('acc-virtual-travel');

    // Real Account: Start 5000 + 2000 - 300 = 6700
    const realRow = result.rows[0];
    expect(realRow.periods['2026-08'].startBalance).toBe(5000);
    expect(realRow.periods['2026-08'].cashflow).toBe(1700);
    expect(realRow.periods['2026-08'].endBalance).toBe(6700);
    expect(realRow.latestBalance).toBe(6700);

    // Virtual Subaccount: Start 500 - 300 (only cat-travel) = 200
    const virtualRow = result.rows[1];
    expect(virtualRow.periods['2026-08'].startBalance).toBe(500);
    expect(virtualRow.periods['2026-08'].cashflow).toBe(-300);
    expect(virtualRow.periods['2026-08'].endBalance).toBe(200);
    expect(virtualRow.latestBalance).toBe(200);

    // TotalRow must ONLY sum real accounts to prevent double counting:
    // Total should be 6700, NOT 6700 + 200 = 6900!
    expect(result.totalRow.latestBalance).toBe(6700);
    expect(result.totalRow.periods['2026-08'].endBalance).toBe(6700);
  });

  it('calculates balances dynamically for transactions without accountId using accountIban', () => {
    const realAccount: Account = {
      id: 'acc-real-main',
      name: 'Girokonto',
      accountType: 'real',
      iban: 'DE123456789',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
    };

    const virtualAccount: Account = {
      id: 'acc-virt-groceries',
      name: 'Lebensmittel-Budget',
      accountType: 'virtual',
      parentAccountId: 'acc-real-main',
      categoryIds: ['cat-groceries'],
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 400 }],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-dynamic-1',
        accountIban: 'DE123456789',
        valueDate: '2026-08-05',
        bookingDate: '2026-08-05',
        issuer: 'Employer',
        receiver: 'Me',
        subject: 'Salary',
        iban: 'DE999999999',
        value: 2500,
        categoryId: 'cat-salary',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-dynamic-2',
        accountIban: 'DE123456789',
        valueDate: '2026-08-10',
        bookingDate: '2026-08-10',
        issuer: 'Me',
        receiver: 'Supermarket',
        subject: 'Wocheneinkauf',
        iban: 'DE888888888',
        value: -150,
        categoryId: 'cat-groceries',
        assignmentSource: 'auto_regex',
      },
    ];

    const result = calculateAllBalances([realAccount, virtualAccount], txs, 'monthly');
    expect(result.rows).toHaveLength(2);

    // Real: 1000 + 2500 - 150 = 3350
    expect(result.rows[0].periods['2026-08'].endBalance).toBe(3350);
    // Virtual: 400 - 150 = 250
    expect(result.rows[1].periods['2026-08'].endBalance).toBe(250);
    // Total sum ignores virtual
    expect(result.totalRow.periods['2026-08'].endBalance).toBe(3350);
  });
});
