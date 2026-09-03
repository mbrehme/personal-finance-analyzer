/**
 * @file finance.test.ts
 * @description Tests für Helferfunktionen in finance.ts.
 * @module types/finance.test
 */

import { describe, it, expect } from 'vitest';
import { buildCompoundSearchField, sortTransactionsDesc, Transaction } from './finance';

describe('finance domain helpers', () => {
  it('builds a compound search field with format [Typ] Empfänger: Zweck (Iban)', () => {
    const tx: Transaction = {
      id: 'tx-123',
      accountId: 'acc-ing',
      valueDate: '2026-09-02',
      bookingDate: '2026-09-02',
      issuer: 'Arbeitgeber GmbH',
      receiver: 'Max Mustermann',
      subject: 'Gehaltszahlung August',
      type: 'inbound',
      iban: 'DE1234567890',
      value: 3500,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const compound = buildCompoundSearchField(tx);
    expect(compound).toBe('[Eingang] Max Mustermann: Gehaltszahlung August (DE1234567890)');

    const txOutbound: Transaction = {
      id: 'tx-124',
      accountId: 'acc-ing',
      valueDate: '2026-09-02',
      bookingDate: '2026-09-02',
      issuer: 'Max Mustermann',
      receiver: 'REWE Markt GmbH',
      subject: 'Kartenzahlung',
      type: 'outbound',
      iban: 'DE9876543210',
      value: -42.5,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const compoundOutbound = buildCompoundSearchField(txOutbound);
    expect(compoundOutbound).toBe('[Ausgang] REWE Markt GmbH: Kartenzahlung (DE9876543210)');
  });

  it('sorts transactions by date descending and preserves CSV importIndex order for same date', () => {
    const tx1: Transaction = {
      id: 'tx-1',
      accountId: 'acc-1',
      valueDate: '2026-08-10',
      bookingDate: '2026-08-10',
      issuer: 'Rewe',
      receiver: 'Me',
      subject: 'Einkauf',
      type: 'outbound',
      iban: '',
      value: -20,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 0,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const tx2: Transaction = {
      id: 'tx-2',
      accountId: 'acc-1',
      valueDate: '2026-08-10',
      bookingDate: '2026-08-10',
      issuer: 'Apotheke',
      receiver: 'Me',
      subject: 'Medikamente',
      type: 'outbound',
      iban: '',
      value: -15,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 1,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const tx3: Transaction = {
      id: 'tx-3',
      accountId: 'acc-1',
      valueDate: '2026-08-20',
      bookingDate: '2026-08-20',
      issuer: 'Gehalt',
      receiver: 'Me',
      subject: 'Lohn',
      type: 'inbound',
      iban: '',
      value: 3000,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 2,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const sorted = sortTransactionsDesc([tx2, tx1, tx3]);
    // Neuestes Datum zuerst
    expect(sorted[0].id).toBe('tx-3');
    // Am gleichen Tag: importIndex 0 vor importIndex 1
    expect(sorted[1].id).toBe('tx-1');
    expect(sorted[2].id).toBe('tx-2');
  });

  it('places split child transactions directly adjacent to their parent transaction', () => {
    const parentTx: Transaction = {
      id: 'tx-parent',
      accountId: 'acc-1',
      valueDate: '2026-07-20',
      bookingDate: '2026-07-20',
      issuer: 'Supermarkt',
      receiver: 'Me',
      subject: 'Einkauf Rest',
      type: 'outbound',
      iban: '',
      value: -36.29,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 0,
    };

    const unrelatedTx1: Transaction = {
      id: 'tx-unrelated-1',
      accountId: 'acc-1',
      valueDate: '2026-07-20',
      bookingDate: '2026-07-20',
      issuer: 'Café',
      receiver: 'Me',
      subject: 'Kaffee',
      type: 'outbound',
      iban: '',
      value: -28.33,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 1,
    };

    const unrelatedTx2: Transaction = {
      id: 'tx-unrelated-2',
      accountId: 'acc-1',
      valueDate: '2026-07-20',
      bookingDate: '2026-07-20',
      issuer: 'Strandcafé',
      receiver: 'Me',
      subject: 'Snack',
      type: 'outbound',
      iban: '',
      value: -14.0,
      bucketId: null,
      assignmentSource: 'unassigned',
      importIndex: 2,
    };

    const splitChildTx: Transaction = {
      id: 'tx-split-child',
      splitFromId: 'tx-parent',
      accountId: 'acc-1',
      valueDate: '2026-07-20',
      bookingDate: '2026-07-20',
      issuer: 'Supermarkt',
      receiver: 'Me',
      subject: 'Einkauf Teilbetrag',
      type: 'outbound',
      iban: '',
      value: -80.0,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const sorted = sortTransactionsDesc([unrelatedTx2, unrelatedTx1, parentTx, splitChildTx]);
    const ids = sorted.map((t) => t.id);

    // Parent and child must be directly consecutive: tx-parent immediately followed by tx-split-child
    expect(ids).toEqual(['tx-parent', 'tx-split-child', 'tx-unrelated-1', 'tx-unrelated-2']);
  });
});
