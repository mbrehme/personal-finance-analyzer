/**
 * @file ResetModal.test.tsx
 * @description Unit-Tests für den ResetModal Dialog.
 * @module components/modals/ResetModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetModal } from './ResetModal';
import * as FinanceContextModule from '@/services/storage/FinanceContext';

describe('ResetModal', () => {
  const mockResetWorkspace = vi.fn().mockResolvedValue(undefined);
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc1', name: 'Girokonto' }] as any,
      categories: [
        { id: 'cat1', name: 'Miete' },
        { id: 'cat2', name: 'Gehalt' },
      ] as any,
      transactions: [{ id: 'tx1', value: -50 }] as any,
      deletedTransactions: [{ id: 'del1', value: -10 }] as any,
      resetWorkspace: mockResetWorkspace,
    } as any);
  });

  it('renders modal with all checkboxes selected by default', () => {
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('heading', { name: 'Workspace zurücksetzen' })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });

    expect(screen.getByText('2 Kategorien')).toBeInTheDocument();
    expect(screen.getByText('1 Konto')).toBeInTheDocument();
    expect(screen.getAllByText('1 Buchung')).toHaveLength(2);
  });

  it('does not render when isOpen is false', () => {
    render(<ResetModal isOpen={false} onClose={mockOnClose} />);
    expect(
      screen.queryByRole('heading', { name: 'Workspace zurücksetzen' })
    ).not.toBeInTheDocument();
  });

  it('allows choosing presets (Nur Kategorien vs Nur Buchungen)', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    const categoriesOnlyBtn = screen.getByRole('button', { name: 'Nur Kategorien' });
    await user.click(categoriesOnlyBtn);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Order: Categories, Accounts, Transactions, Deleted
    expect(checkboxes[0].checked).toBe(true); // Categories
    expect(checkboxes[1].checked).toBe(false); // Accounts
    expect(checkboxes[2].checked).toBe(false); // Transactions
    expect(checkboxes[3].checked).toBe(false); // Deleted

    const transactionsOnlyBtn = screen.getByRole('button', { name: 'Nur Buchungen' });
    await user.click(transactionsOnlyBtn);

    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(true);
  });

  it('calls resetWorkspace with selected options and default target seed', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    // Choose "Nur Kategorien"
    await user.click(screen.getByRole('button', { name: 'Nur Kategorien' }));

    const confirmBtn = screen.getByRole('button', {
      name: /Auf Beispieldaten zurücksetzen/i,
    });
    await user.click(confirmBtn);

    expect(mockResetWorkspace).toHaveBeenCalledWith({
      target: 'seed',
      resetAccounts: false,
      resetCategories: true,
      resetTransactions: false,
      resetDeletedTransactions: false,
      includeSampleTransactions: false,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows switching target to empty/delete mode and calls resetWorkspace with target empty', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    // Switch target to empty
    const emptyBtn = screen.getByTestId('reset-target-empty');
    await user.click(emptyBtn);

    // Button label changes to "Ausgewählte Bereiche löschen"
    const confirmBtn = screen.getByRole('button', {
      name: /Ausgewählte Bereiche löschen/i,
    });
    await user.click(confirmBtn);

    expect(mockResetWorkspace).toHaveBeenCalledWith({
      target: 'empty',
      resetAccounts: true,
      resetCategories: true,
      resetTransactions: true,
      resetDeletedTransactions: true,
      includeSampleTransactions: false,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });
});
