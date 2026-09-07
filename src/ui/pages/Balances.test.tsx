/**
 * @file Balances.test.tsx
 * @description Unit-Tests für die Balances Page.
 * @module pages/Balances.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Balances } from './Balances';
import { FinanceProvider } from '@/domain';
import * as FinanceContextModule from '@/domain';

describe('Balances Page', () => {
  it('renders balances page with account summaries', async () => {
    render(
      <FinanceProvider>
        <Balances />
      </FinanceProvider>
    );

    expect(await screen.findByText('Aktueller Gesamtsaldo')).toBeInTheDocument();
    expect(screen.getByText('Aktive Konten')).toBeInTheDocument();
    expect(screen.getByText('Stichtags-Salden')).toBeInTheDocument();
  });

  it('renders real account and virtual subaccount with Virtuell badge', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-real-1',
          name: 'Girokonto Real',
          accountType: 'real',
          iban: 'DE1234567890',
          balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
        },
        {
          id: 'acc-virt-1',
          name: 'Urlaubstopf Virtual',
          accountType: 'virtual',
          parentAccountId: 'acc-real-1',
          categoryIds: ['cat-vacation'],
          balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 200 }],
        },
      ],
      transactions: [],
      categories: [],
      buckets: [],
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
      autoReprogress: true,
      setAutoReprogress: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
      addBucket: vi.fn(),
      updateBucket: vi.fn(),
      deleteBucket: vi.fn(),
      reorderBuckets: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      reorderAccounts: vi.fn(),
      addBalanceEntry: vi.fn(),
      deleteBalanceEntry: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      importTransactions: vi.fn(),
      assignTransactionCategory: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      resetTransaction: vi.fn(),
      deletedTransactions: [],
      restoreTransaction: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    });

    render(<Balances />);

    expect(screen.getByText('Girokonto Real')).toBeInTheDocument();
    expect(screen.getByText('Urlaubstopf Virtual')).toBeInTheDocument();
    expect(screen.getByText('Virtuell')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
