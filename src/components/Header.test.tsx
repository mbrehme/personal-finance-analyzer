/**
 * @file Header.test.tsx
 * @description Unit-Tests für die Header-Komponente inkl. globalem Neu-Matchen-Button.
 * @module components/Header.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Header } from './Header';
import * as FinanceContextModule from '@/services/storage/FinanceContext';

const mockTriggerReMatch = vi.fn();

describe('Header', () => {
  it('renders navigation links and synchronized status (has_progressed)', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [],
      buckets: [],
      transactions: [{ id: 'tx-1' }] as any,
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
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
      importTransactions: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: mockTriggerReMatch,
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: /Konfiguration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Buchungen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cashflow/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Salden/i })).toBeInTheDocument();

    const rematchBtn = screen.getByTestId('rematch-button');
    expect(rematchBtn).toBeInTheDocument();
    expect(rematchBtn).not.toBeDisabled();
    expect(rematchBtn).toHaveAttribute('data-status', 'has_progressed');
    expect(rematchBtn).toHaveTextContent(/Reprogress/i);
  });

  it('renders highlighted button when needs_reprogress and triggers rematch on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [],
      buckets: [],
      transactions: [{ id: 'tx-1' }] as any,
      loading: false,
      error: null,
      reMatchStatus: 'needs_reprogress',
      setReMatchStatus: vi.fn(),
      needsReMatch: true,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
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
      importTransactions: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: mockTriggerReMatch,
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const rematchBtn = screen.getByTestId('rematch-button');
    expect(rematchBtn).toHaveAttribute('data-status', 'needs_reprogress');
    expect(rematchBtn).toHaveClass('bg-amber-50');
    expect(rematchBtn).toHaveTextContent(/Reprogress/i);

    await user.click(rematchBtn);
    expect(mockTriggerReMatch).toHaveBeenCalledTimes(1);
  });

  it('renders loading button when is_reprogressing and disables button', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [],
      buckets: [],
      transactions: [{ id: 'tx-1' }] as any,
      loading: false,
      error: null,
      reMatchStatus: 'is_reprogressing',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: true,
      setNeedsReMatch: vi.fn(),
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
      importTransactions: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: mockTriggerReMatch,
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const rematchBtn = screen.getByTestId('rematch-button');
    expect(rematchBtn).toBeDisabled();
    expect(rematchBtn).toHaveAttribute('data-status', 'is_reprogressing');
    expect(rematchBtn).toHaveTextContent(/Progressing.../i);
  });
});

