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
  it('initializes with seed accounts and categories', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.categories.length).toBeGreaterThan(0);
    expect(result.current.buckets.length).toBeGreaterThan(0);
  });

  it('adds and updates an account', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let createdAcc: any;
    await act(async () => {
      createdAcc = await result.current.addAccount({
        name: 'Neues Sparkonto',
        categoryIds: [],
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

  it('manages manual category assignment and records manualTransactionIds', async () => {
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
          categoryId: null,
          assignmentSource: 'unassigned',
        },
      ]);
    });

    const targetCategory = result.current.categories[0];

    await act(async () => {
      await result.current.assignTransactionCategory('tx-test-assign', targetCategory.id);
    });

    const updatedTx = result.current.transactions.find((t) => t.id === 'tx-test-assign');
    expect(updatedTx?.categoryId).toBe(targetCategory.id);
    expect(updatedTx?.bucketId).toBe(targetCategory.id);
    expect(updatedTx?.assignmentSource).toBe('manual');

    const updatedCategory = result.current.categories.find((c) => c.id === targetCategory.id);
    expect(updatedCategory?.manualTransactionIds).toContain('tx-test-assign');
  });

  it('reorders categories and accounts successfully', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reorder Categories
    const initialCategories = [...result.current.categories];
    const reversedCategories = initialCategories.map((c, idx) => ({
      ...c,
      order: initialCategories.length - idx,
    }));

    await act(async () => {
      await result.current.reorderCategories(reversedCategories);
    });

    expect(result.current.categories[0].order).toBe(initialCategories.length);

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

  it('resets workspace to seed categories and accounts', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Delete a category to alter state
    const firstCat = result.current.categories[0];
    await act(async () => {
      await result.current.deleteCategory(firstCat.id);
    });

    // Reset workspace
    await act(async () => {
      await result.current.resetWorkspace();
    });

    expect(result.current.categories.length).toBeGreaterThan(0);
    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.transactions.length).toBe(0);
  });
});
