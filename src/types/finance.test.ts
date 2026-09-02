/**
 * @file finance.test.ts
 * @description Tests für Helferfunktionen in finance.ts.
 * @module types/finance.test
 */

import { describe, it, expect } from 'vitest';
import { buildCompoundSearchField, sortTransactionsDesc, Transaction } from './finance';

describe('finance domain helpers', () => {
  it('builds a compound search field with all relevant transaction properties', () => {
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
    expect(compound).toContain('acc-ing');
    expect(compound).toContain('Arbeitgeber GmbH');
    expect(compound).toContain('Max Mustermann');
    expect(compound).toContain('Gehaltszahlung August');
    expect(compound).toContain('inbound');
    expect(compound).toContain('3500');
    expect(compound).toContain('DE1234567890');
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
});
