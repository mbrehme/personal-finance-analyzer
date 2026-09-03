/**
 * @file finance.test.ts
 * @description Tests für Helferfunktionen in finance.ts.
 * @module types/finance.test
 */

import { describe, it, expect } from 'vitest';
import {
  buildCompoundSearchField,
  sortTransactionsDesc,
  getTransactionType,
  Transaction,
} from './finance';

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

  it('sorts orphaned split child chronologically when parent is missing/deleted', () => {
    const tx1: Transaction = {
      id: 'tx-1',
      accountId: 'acc-1',
      valueDate: '2026-09-03',
      bookingDate: '2026-09-03',
      issuer: 'A',
      receiver: 'B',
      subject: 'Newest',
      type: 'outbound',
      iban: '',
      value: -10,
      bucketId: null,
      assignmentSource: 'unassigned',
    };
    const orphanChild: Transaction = {
      id: 'tx-orphan',
      splitFromId: 'tx-deleted-parent',
      accountId: 'acc-1',
      valueDate: '2026-09-02',
      bookingDate: '2026-09-02',
      issuer: 'A',
      receiver: 'B',
      subject: 'Middle',
      type: 'outbound',
      iban: '',
      value: -20,
      bucketId: null,
      assignmentSource: 'unassigned',
    };
    const tx3: Transaction = {
      id: 'tx-3',
      accountId: 'acc-1',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'A',
      receiver: 'B',
      subject: 'Oldest',
      type: 'outbound',
      iban: '',
      value: -30,
      bucketId: null,
      assignmentSource: 'unassigned',
    };

    const sorted = sortTransactionsDesc([tx3, orphanChild, tx1]);
    expect(sorted.map((t) => t.id)).toEqual(['tx-1', 'tx-orphan', 'tx-3']);
  });

  it('determines virtual transaction type purely based on value sign', () => {
    // getTransactionType with numbers
    expect(getTransactionType(100)).toBe('inbound');
    expect(getTransactionType(0)).toBe('inbound');
    expect(getTransactionType(-0.01)).toBe('outbound');
    expect(getTransactionType(-500)).toBe('outbound');

    // getTransactionType with transaction objects without static type property
    const inboundTx: Partial<Transaction> = { value: 250 };
    const outboundTx: Partial<Transaction> = { value: -12.99 };

    expect(getTransactionType(inboundTx as Transaction)).toBe('inbound');
    expect(getTransactionType(outboundTx as Transaction)).toBe('outbound');

    // buildCompoundSearchField uses virtual getTransactionType
    const searchInbound = buildCompoundSearchField({
      value: 100,
      receiver: 'Max',
      subject: 'Bonus',
      iban: 'DE11',
    } as Transaction);
    expect(searchInbound).toContain('[Eingang]');

    const searchOutbound = buildCompoundSearchField({
      value: -50,
      receiver: 'Rewe',
      subject: 'Einkauf',
      iban: 'DE22',
    } as Transaction);
    expect(searchOutbound).toContain('[Ausgang]');
  });

  it('resets a modified transaction back to original bank values and unassigns category', async () => {
    const { resetTransactionToOriginal, isTransactionOverridden } = await import('./finance');

    const modifiedTx: Transaction = {
      id: 'tx-override-1',
      accountId: 'acc-2',
      originalAccountId: 'acc-1',
      valueDate: '2026-08-15',
      originalValueDate: '2026-08-10',
      bookingDate: '2026-08-15',
      originalBookingDate: '2026-08-10',
      issuer: 'Manuell Sender',
      originalIssuer: 'Bank Sender',
      receiver: 'Manuell Empfänger',
      originalReceiver: 'Bank Empfänger',
      subject: 'Manuell Verwendungszweck',
      originalSubject: 'Bank Verwendungszweck',
      iban: 'DE9999',
      originalIban: 'DE1111',
      value: -100,
      originalValue: -50,
      categoryId: 'cat-1',
      bucketId: 'cat-1',
      assignmentSource: 'manual',
      origin: 'imported',
      splitFromId: 'tx-parent',
      deletedAt: '2026-08-20T12:00:00.000Z',
    };

    expect(isTransactionOverridden(modifiedTx)).toBe(true);

    const restored = resetTransactionToOriginal(modifiedTx);

    expect(restored.id).toBe('tx-override-1');
    expect(restored.accountId).toBe('acc-1');
    expect(restored.valueDate).toBe('2026-08-10');
    expect(restored.bookingDate).toBe('2026-08-10');
    expect(restored.issuer).toBe('Bank Sender');
    expect(restored.receiver).toBe('Bank Empfänger');
    expect(restored.subject).toBe('Bank Verwendungszweck');
    expect(restored.iban).toBe('DE1111');
    expect(restored.value).toBe(-50);
    expect(restored.categoryId).toBeNull();
    expect(restored.bucketId).toBeNull();
    expect(restored.assignmentSource).toBe('unassigned');
    expect(restored.splitFromId).toBeUndefined();
    expect(restored.deletedAt).toBeUndefined();
    expect(isTransactionOverridden(restored)).toBe(false);
  });
});
