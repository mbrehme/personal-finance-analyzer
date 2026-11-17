/**
 * @file transactionQuery.test.ts
 * @description Unit-Tests für die reine Domänen-Abfragefunktion queryTransactions.
 * @module domain/modules/transactions/transactionQuery.test
 */

import { describe, it, expect } from 'vitest';
import { queryTransactions, matchesSearch, TransactionQueryFilters } from './transactionQuery';
import { Account, Category, Transaction } from '@/types';

const defaultFilters: TransactionQueryFilters = {
  searchTerm: '',
  accountId: 'all',
  categoryIds: null,
  type: 'all',
  origin: 'all',
  startDate: '',
  endDate: '',
};

describe('transactionQuery', () => {
  const accounts: Account[] = [
    {
      id: 'acc-giro',
      name: 'Girokonto',
      iban: 'DE1111',
      accountType: 'real',
      categoryIds: [],
      balanceEntries: [],
    },
    {
      id: 'acc-tagesgeld',
      name: 'Tagesgeld',
      iban: 'DE2222',
      accountType: 'real',
      categoryIds: [],
      balanceEntries: [],
    },
  ];

  const categories: Category[] = [
    { id: 'cat-salary', name: 'Gehalt', color: '#10b981', icon: 'Wallet', parentId: null },
    { id: 'cat-food', name: 'Lebensmittel', color: '#f59e0b', icon: 'ShoppingBag', parentId: null },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-salary',
      date: '2026-09-01',
      issuer: 'Arbeitgeber',
      receiver: 'Ich',
      subject: 'Lohn September',
      senderIban: 'DE9999',
      receiverIban: 'DE1111',
      value: 3000,
      categoryId: 'cat-salary',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-food',
      date: '2026-09-05',
      issuer: 'Ich',
      receiver: 'REWE',
      subject: 'Wocheneinkauf',
      senderIban: 'DE1111',
      receiverIban: 'DE8888',
      value: -120.5,
      categoryId: 'cat-food',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-transfer',
      date: '2026-09-10',
      issuer: 'Ich',
      receiver: 'Ich',
      subject: 'Sparen',
      senderIban: 'DE1111',
      receiverIban: 'DE2222',
      value: -500,
      categoryId: null,
      assignmentSource: 'unassigned',
    },
  ];

  it('excludes internal transfers from inbound/outbound flow filters in global view', () => {
    const outbound = queryTransactions({
      transactions,
      accounts,
      categories,
      filters: { ...defaultFilters, type: 'outbound' },
    });

    expect(outbound.transactions.map((t) => t.id)).toEqual(['tx-food']);
    expect(outbound.totalSum).toBe(-120.5);
    expect(outbound.outboundSum).toBe(-120.5);
  });

  it('calculates perspective-aware sums when filtering by counter account', () => {
    const res = queryTransactions({
      transactions,
      accounts,
      categories,
      filters: { ...defaultFilters, accountId: 'acc-tagesgeld' },
    });

    expect(res.transactions.map((t) => t.id)).toEqual(['tx-transfer']);
    expect(res.totalSum).toBe(500);
    expect(res.inboundSum).toBe(500);
    expect(res.outboundSum).toBe(0);
  });

  it('filters by category including uncategorized and date range', () => {
    const res = queryTransactions({
      transactions,
      accounts,
      categories,
      filters: {
        ...defaultFilters,
        categoryIds: ['__uncategorized__', 'cat-food'],
        startDate: '2026-09-05',
        endDate: '2026-09-10',
      },
    });

    expect(res.transactions.map((t) => t.id)).toEqual(['tx-transfer', 'tx-food']);
  });

  it('searches across compound fields, formatted amounts, and category names', () => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    expect(matchesSearch(transactions[1], '120,50', map)).toBe(true);
    expect(matchesSearch(transactions[1], 'Lebensmittel', map)).toBe(true);
    expect(matchesSearch(transactions[1], 'REWE', map)).toBe(true);
    expect(matchesSearch(transactions[1], 'Unbekannt', map)).toBe(false);
  });
});
