/**
 * @file finance.test.ts
 * @description Tests für Helferfunktionen in finance.ts.
 * @module types/finance.test
 */

import { describe, it, expect } from 'vitest';
import { buildCompoundSearchField, Transaction } from './finance';

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
});
