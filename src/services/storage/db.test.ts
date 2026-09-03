/**
 * @file db.test.ts
 * @description Unit-Tests für den IndexedDB/Memory Storage Layer db.ts.
 * @module services/storage/db.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { financeDB } from './db';
import { Account, Category, Transaction } from '@/types/finance';

describe('financeDB Storage Layer', () => {
  beforeEach(async () => {
    await financeDB.clearAll();
  });

  it('saves and retrieves accounts with categoryIds and balanceEntries', async () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Girokonto Test',
      categoryIds: ['b-living'],
      balanceEntries: [{ id: 'be-1', date: '2026-09-01', amount: 2500, note: 'Monatsanfang' }],
    };

    await financeDB.saveAccount(account);
    const accounts = await financeDB.getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Girokonto Test');
    expect(accounts[0].categoryIds).toContain('b-living');
    expect(accounts[0].balanceEntries).toHaveLength(1);
  });

  it('saves, retrieves and deletes categories with manualTransactionIds', async () => {
    const category: Category = {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
      regexPattern: 'Miete|Vermieter',
      manualTransactionIds: ['tx-999'],
    };

    await financeDB.saveCategory(category);
    let categories = await financeDB.getCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0].regexPattern).toBe('Miete|Vermieter');
    expect(categories[0].manualTransactionIds).toContain('tx-999');

    await financeDB.deleteCategory('b-rent');
    categories = await financeDB.getCategories();
    expect(categories).toHaveLength(0);
  });

  it('handles batch transaction saving, descending date ordering and clearing', async () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        valueDate: '2026-08-01',
        bookingDate: '2026-08-01',
        issuer: 'AG',
        receiver: 'Me',
        subject: 'Gehalt August',
        type: 'inbound',
        iban: 'DE00',
        value: 3000,
        bucketId: 'b-salary',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        valueDate: '2026-09-01',
        bookingDate: '2026-09-01',
        issuer: 'AG',
        receiver: 'Me',
        subject: 'Gehalt September',
        type: 'inbound',
        iban: 'DE00',
        value: 3000,
        bucketId: 'b-salary',
        assignmentSource: 'auto_regex',
      },
    ];

    await financeDB.saveTransactions(transactions);
    let txs = await financeDB.getTransactions();
    expect(txs).toHaveLength(2);
    // Standardmäßig absteigend sortiert (neueste zuerst)
    expect(txs[0].id).toBe('tx-2');
    expect(txs[1].id).toBe('tx-1');

    await financeDB.clearTransactions();
    txs = await financeDB.getTransactions();
    expect(txs).toHaveLength(0);
  });

  it('exports and imports configuration with manualTransactionIds', async () => {
    const account: Account = {
      id: 'acc-export',
      name: 'Sparkonto',
      categoryIds: ['b-savings'],
      balanceEntries: [],
    };
    const category: Category = {
      id: 'b-savings',
      name: 'Sparen',
      parentId: null,
      manualTransactionIds: ['tx-manual-1'],
    };

    await financeDB.saveAccount(account);
    await financeDB.saveCategory(category);

    const manualTx: Transaction = {
      id: 'tx-man-1',
      accountId: 'acc-export',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: '',
      receiver: 'Bäcker',
      subject: 'Kaffee',
      type: 'outbound',
      iban: '',
      value: -3.5,
      assignmentSource: 'manual',
      origin: 'manual',
    };
    await financeDB.saveTransaction(manualTx);

    const exported = await financeDB.exportConfiguration();
    expect(exported.accounts).toHaveLength(1);
    expect(exported.categories).toHaveLength(1);
    expect(exported.categories[0].manualTransactionIds).toContain('tx-manual-1');
    expect(exported.manualTransactions).toHaveLength(1);
    expect(exported.manualTransactions![0].id).toBe('tx-man-1');
    // Sicherstellen, dass der Typ nicht im Export-Objekt serialisiert wird
    expect(Object.prototype.hasOwnProperty.call(exported.manualTransactions![0], 'type')).toBe(
      false
    );

    await financeDB.clearAll();
    expect(await financeDB.getAccounts()).toHaveLength(0);
    expect(await financeDB.getTransactions()).toHaveLength(0);

    await financeDB.importConfiguration(exported);
    expect(await financeDB.getAccounts()).toHaveLength(1);
    expect(await financeDB.getCategories()).toHaveLength(1);
    expect(await financeDB.getTransactions()).toHaveLength(1);
    // Nach Re-Import ist der virtuelle Typ dynamisch verfügbar
    expect(await financeDB.getTransactions().then((txs) => txs[0].type)).toBe('outbound');
  });

  it('does not persist type field in database and provides virtual type getter upon retrieval', async () => {
    const rawTx: Transaction = {
      id: 'tx-persist-1',
      accountId: 'acc-1',
      valueDate: '2026-09-03',
      bookingDate: '2026-09-03',
      issuer: 'Me',
      receiver: 'Store',
      subject: 'Groceries',
      iban: '',
      value: -49.95,
      assignmentSource: 'unassigned',
    };

    await financeDB.saveTransaction(rawTx);

    const loaded = await financeDB.getTransactions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].value).toBe(-49.95);
    // Virtueller Getter liefert 'outbound'
    expect(loaded[0].type).toBe('outbound');

    // Dynamisches Verhalten: Änderung des Betrags ändert den virtuellen Typ
    loaded[0].value = 100;
    expect(loaded[0].type).toBe('inbound');

    // Sanitized Version für Persistierung besitzt kein `type`-Feld
    const sanitized = financeDB.sanitizeForPersistence(loaded[0]);
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'type')).toBe(false);
  });
});
