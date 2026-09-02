/**
 * @file db.test.ts
 * @description Unit-Tests für den IndexedDB/Memory Storage Layer db.ts.
 * @module services/storage/db.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { financeDB } from './db';
import { Account, Bucket, Transaction } from '@/types/finance';

describe('financeDB Storage Layer', () => {
  beforeEach(async () => {
    await financeDB.clearAll();
  });

  it('saves and retrieves accounts with bucketIds and balanceEntries', async () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Girokonto Test',
      bucketIds: ['b-living'],
      balanceEntries: [
        { id: 'be-1', date: '2026-09-01', amount: 2500, note: 'Monatsanfang' },
      ],
    };

    await financeDB.saveAccount(account);
    const accounts = await financeDB.getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Girokonto Test');
    expect(accounts[0].bucketIds).toContain('b-living');
    expect(accounts[0].balanceEntries).toHaveLength(1);
  });

  it('saves, retrieves and deletes buckets with manualTransactionIds', async () => {
    const bucket: Bucket = {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
      regexPattern: 'Miete|Vermieter',
      manualTransactionIds: ['tx-999'],
    };

    await financeDB.saveBucket(bucket);
    let buckets = await financeDB.getBuckets();
    expect(buckets).toHaveLength(1);
    expect(buckets[0].regexPattern).toBe('Miete|Vermieter');
    expect(buckets[0].manualTransactionIds).toContain('tx-999');

    await financeDB.deleteBucket('b-rent');
    buckets = await financeDB.getBuckets();
    expect(buckets).toHaveLength(0);
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
      bucketIds: ['b-savings'],
      balanceEntries: [],
    };
    const bucket: Bucket = {
      id: 'b-savings',
      name: 'Sparen',
      parentId: null,
      manualTransactionIds: ['tx-manual-1'],
    };

    await financeDB.saveAccount(account);
    await financeDB.saveBucket(bucket);

    const exported = await financeDB.exportConfiguration();
    expect(exported.accounts).toHaveLength(1);
    expect(exported.buckets).toHaveLength(1);
    expect(exported.buckets[0].manualTransactionIds).toContain('tx-manual-1');

    await financeDB.clearAll();
    expect(await financeDB.getAccounts()).toHaveLength(0);

    await financeDB.importConfiguration(exported);
    expect(await financeDB.getAccounts()).toHaveLength(1);
    expect(await financeDB.getBuckets()).toHaveLength(1);
  });
});
