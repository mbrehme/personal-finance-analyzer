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
import { FinanceContextType } from '@/services/storage/FinanceContext';

const mockTriggerReMatch = vi.fn();

const baseMockFinance: FinanceContextType = {
  accounts: [],
  categories: [],
  buckets: [],
  transactions: [{ id: 'tx-1' }] as any,
  loading: false,
  error: null,
  reMatchStatus: 'has_progressed',
  setReMatchStatus: vi.fn(),
  needsReMatch: false,
  reMatching: false,
  setNeedsReMatch: vi.fn(),
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
  triggerReMatch: mockTriggerReMatch,
  resetTransaction: vi.fn(),
  deletedTransactions: [],
  restoreTransaction: vi.fn(),
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn(),
  resetWorkspace: vi.fn(),
};

describe('Header', () => {
  it('renders navigation links and synchronized status (has_progressed)', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      ...baseMockFinance,
      reMatchStatus: 'has_progressed',
    });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: /Konfiguration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Buchungen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Analyse/i })).toBeInTheDocument();

    const rematchBtn = screen.getByTestId('rematch-button');
    expect(rematchBtn).toBeInTheDocument();
    expect(rematchBtn).toHaveAttribute('data-status', 'has_progressed');
  });

  it('renders highlighted button when needs_reprogress and triggers rematch on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      ...baseMockFinance,
      reMatchStatus: 'needs_reprogress',
      needsReMatch: true,
    });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
      ...baseMockFinance,
      reMatchStatus: 'is_reprogressing',
      reMatching: true,
    });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </BrowserRouter>
    );

    const rematchBtn = screen.getByTestId('rematch-button');
    expect(rematchBtn).toHaveAttribute('data-status', 'is_reprogressing');
    expect(rematchBtn).toBeDisabled();
    expect(rematchBtn).toHaveTextContent(/Progressing.../i);
  });

  it('opens data management dropdown and triggers export and reset modals', async () => {
    const user = userEvent.setup();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      ...baseMockFinance,
    });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </BrowserRouter>
    );

    const dataMenuBtn = screen.getByTestId('header-data-menu-btn');
    expect(dataMenuBtn).toBeInTheDocument();

    // Open dropdown
    await user.click(dataMenuBtn);
    expect(screen.getByTestId('header-data-menu-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daten exportieren.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daten importieren.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Workspace zurücksetzen.../i })).toBeInTheDocument();

    // Click Export -> should open Export modal
    await user.click(screen.getByRole('button', { name: /Daten exportieren.../i }));
    expect(screen.getByRole('heading', { name: 'Daten exportieren' })).toBeInTheDocument();

    // Close Export modal
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('heading', { name: 'Daten exportieren' })).not.toBeInTheDocument();

    // Open dropdown again and click Reset
    await user.click(dataMenuBtn);
    await user.click(screen.getByRole('button', { name: /Workspace zurücksetzen.../i }));
    expect(screen.getByRole('heading', { name: 'Workspace zurücksetzen' })).toBeInTheDocument();
  });
});
