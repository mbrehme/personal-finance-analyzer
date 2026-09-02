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
  it('renders navigation links and normal Neu matchen button', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [],
      buckets: [],
      transactions: [{ id: 'tx-1' }] as any,
      loading: false,
      error: null,
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

    const rematchBtn = screen.getByRole('button', { name: /Neu matchen/i });
    expect(rematchBtn).toBeInTheDocument();
    expect(rematchBtn).not.toBeDisabled();
  });

  it('renders highlighted Neu matchen button when needsReMatch is true and triggers rematch on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [],
      buckets: [],
      transactions: [{ id: 'tx-1' }] as any,
      loading: false,
      error: null,
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

    const rematchBtn = screen.getByRole('button', { name: /Neu matchen/i });
    expect(rematchBtn).toHaveClass('bg-amber-500');

    await user.click(rematchBtn);
    expect(mockTriggerReMatch).toHaveBeenCalledTimes(1);
  });
});

