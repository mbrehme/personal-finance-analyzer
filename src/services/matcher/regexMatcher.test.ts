/**
 * @file regexMatcher.test.ts
 * @description Unit-Tests für die Regex-Matching Engine.
 * @module services/matcher/regexMatcher.test
 */

import { describe, it, expect } from 'vitest';
import { matchTransaction, reMatchAllTransactions, getLeafBuckets } from './regexMatcher';
import { Bucket, Transaction } from '@/types/finance';

describe('regexMatcher Engine', () => {
  const buckets: Bucket[] = [
    {
      id: 'b-living',
      name: 'Wohnen',
      parentId: null,
      // Parent hat kein Regex
    },
    {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
      regexPattern: 'Miete|Vermieter Immobilien GmbH',
    },
    {
      id: 'b-groceries',
      name: 'Lebensmittel',
      parentId: null,
      regexPattern: 'Rewe|Edeka|Aldi|Lidl|Bio-Markt',
    },
    {
      id: 'b-salary',
      name: 'Gehalt',
      parentId: null,
      regexPattern: 'acc-ing.*Gehalt|Tech Corp',
    },
    {
      id: 'b-special',
      name: 'Sonderkategorie',
      parentId: null,
      manualTransactionIds: ['tx-manual-special'],
    },
  ];

  it('correctly filters leaf buckets only', () => {
    const leafBuckets = getLeafBuckets(buckets);
    const leafIds = leafBuckets.map((b) => b.id);
    expect(leafIds).not.toContain('b-living'); // Parent
    expect(leafIds).toContain('b-rent'); // Child
    expect(leafIds).toContain('b-groceries'); // Leaf
  });

  it('matches transaction based on subject/receiver via regex', () => {
    const tx: Transaction = {
      id: 'tx-1',
      accountId: 'acc-1',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'Me',
      receiver: 'Rewe Filiale 1234',
      subject: 'Kartenzahlung',
      type: 'outbound',
      iban: 'DE00',
      value: -45.5,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, buckets);
    expect(match.bucketId).toBe('b-groceries');
    expect(match.assignmentSource).toBe('auto_regex');
  });

  it('matches compound field with accountId and subject', () => {
    const tx: Transaction = {
      id: 'tx-2',
      accountId: 'acc-ing-giro',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'Tech Corp',
      receiver: 'Me',
      subject: 'Gehaltsabrechnung',
      type: 'inbound',
      iban: 'DE00',
      value: 4200,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, buckets);
    expect(match.bucketId).toBe('b-salary');
    expect(match.assignmentSource).toBe('auto_regex');
  });

  it('prioritizes manual assignment via bucket.manualTransactionIds', () => {
    const tx: Transaction = {
      id: 'tx-manual-special',
      accountId: 'acc-1',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'Rewe', // Wäre eigentlich b-groceries
      receiver: 'Me',
      subject: 'Einkauf',
      type: 'outbound',
      iban: 'DE00',
      value: -10,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, buckets);
    expect(match.bucketId).toBe('b-special');
    expect(match.assignmentSource).toBe('manual');
  });

  it('does not overwrite existing manual assignment during reMatchAllTransactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-manual-locked',
        accountId: 'acc-1',
        valueDate: '2026-09-01',
        bookingDate: '2026-09-01',
        issuer: 'Rewe',
        receiver: 'Me',
        subject: 'Einkauf',
        type: 'outbound',
        iban: 'DE00',
        value: -20,
        bucketId: 'b-rent', // Manuell auf Miete gesetzt
        assignmentSource: 'manual',
      },
      {
        id: 'tx-auto',
        accountId: 'acc-1',
        valueDate: '2026-09-01',
        bookingDate: '2026-09-01',
        issuer: 'Edeka',
        receiver: 'Me',
        subject: 'Einkauf',
        type: 'outbound',
        iban: 'DE00',
        value: -30,
        bucketId: null,
        assignmentSource: 'unassigned',
      },
    ];

    const reMatched = reMatchAllTransactions(transactions, buckets);
    expect(reMatched[0].bucketId).toBe('b-rent'); // Unverändert
    expect(reMatched[0].assignmentSource).toBe('manual');
    expect(reMatched[1].bucketId).toBe('b-groceries'); // Neu zugewiesen
    expect(reMatched[1].assignmentSource).toBe('auto_regex');
  });
});
