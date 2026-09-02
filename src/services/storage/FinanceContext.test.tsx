/**
 * @file FinanceContext.test.tsx
 * @description Unit-Tests für FinanceContext State Management.
 * @module services/storage/FinanceContext.test
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FinanceProvider, useFinance } from './FinanceContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FinanceProvider>{children}</FinanceProvider>
);

describe('FinanceContext', () => {
  it('initializes with seed accounts and buckets', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.buckets.length).toBeGreaterThan(0);
  });

  it('adds and updates an account', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let createdAcc: any;
    await act(async () => {
      createdAcc = await result.current.addAccount({
        name: 'Neues Sparkonto',
        bucketIds: [],
        balanceEntries: [],
      });
    });

    expect(createdAcc.id).toBeDefined();
    expect(result.current.accounts.some((a) => a.id === createdAcc.id)).toBe(true);

    await act(async () => {
      await result.current.updateAccount({
        ...createdAcc,
        name: 'Sparkonto Umbenannt',
      });
    });

    const found = result.current.accounts.find((a) => a.id === createdAcc.id);
    expect(found?.name).toBe('Sparkonto Umbenannt');
  });

  it('manages manual bucket assignment and records manualTransactionIds', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Transaktion importieren
    await act(async () => {
      await result.current.importTransactions([
        {
          id: 'tx-test-assign',
          accountId: 'acc-giro-main',
          valueDate: '2026-09-01',
          bookingDate: '2026-09-01',
          issuer: 'Unbekannt',
          receiver: 'Me',
          subject: 'Sonstige Ausgabe',
          type: 'outbound',
          iban: 'DE00',
          value: -50,
          bucketId: null,
          assignmentSource: 'unassigned',
        },
      ]);
    });

    const targetBucket = result.current.buckets[0];

    await act(async () => {
      await result.current.assignTransactionBucket('tx-test-assign', targetBucket.id);
    });

    const updatedTx = result.current.transactions.find((t) => t.id === 'tx-test-assign');
    expect(updatedTx?.bucketId).toBe(targetBucket.id);
    expect(updatedTx?.assignmentSource).toBe('manual');

    const updatedBucket = result.current.buckets.find((b) => b.id === targetBucket.id);
    expect(updatedBucket?.manualTransactionIds).toContain('tx-test-assign');
  });

  it('reorders buckets and accounts successfully', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reorder Buckets
    const initialBuckets = [...result.current.buckets];
    const reversedBuckets = initialBuckets.map((b, idx) => ({
      ...b,
      order: initialBuckets.length - idx,
    }));

    await act(async () => {
      await result.current.reorderBuckets(reversedBuckets);
    });

    expect(result.current.buckets[0].order).toBe(initialBuckets.length);

    // Reorder Accounts
    const initialAccounts = [...result.current.accounts];
    const reorderedAccounts = initialAccounts.map((a, idx) => ({
      ...a,
      order: idx + 5,
    }));

    await act(async () => {
      await result.current.reorderAccounts(reorderedAccounts);
    });

    expect(result.current.accounts[0].order).toBe(5);
  });
});
