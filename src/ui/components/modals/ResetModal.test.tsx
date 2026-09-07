/**
 * @file ResetModal.test.tsx
 * @description Unit-Tests für den ResetModal Dialog mit gruppierter Bereichswahl (Konfiguration & Buchungen)
 * und differenzierter Einzelauswahl von Themen (Kategorien, Konten, Transaktionen, Overrides, Splits, Papierkorb).
 * @module components/modals/ResetModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetModal } from './ResetModal';
import * as FinanceContextModule from '@/domain';

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
      transactions: [
        { id: 'tx1', value: -50 },
        { id: 'tx2', value: -20, splitFromId: 'tx1' },
        { id: 'tx3', value: -100, isOverridden: true },
      ] as any,
      deletedTransactions: [{ id: 'del1', value: -10 }] as any,
      resetWorkspace: mockResetWorkspace,
    } as any);
  });

  it('renders modal with all 6 individual checkboxes grouped under Konfiguration and Buchungen', () => {
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('heading', { name: 'Workspace zurücksetzen' })).toBeInTheDocument();
    expect(screen.getByText('Konfiguration')).toBeInTheDocument();
    expect(screen.getByText('Buchungen')).toBeInTheDocument();

    const catCheckbox = screen.getByTestId('reset-option-categories') as HTMLInputElement;
    const accCheckbox = screen.getByTestId('reset-option-accounts') as HTMLInputElement;
    const txCheckbox = screen.getByTestId('reset-option-transactions') as HTMLInputElement;
    const overridesCheckbox = screen.getByTestId('reset-option-overrides') as HTMLInputElement;
    const splitsCheckbox = screen.getByTestId('reset-option-splits') as HTMLInputElement;
    const deletedCheckbox = screen.getByTestId('reset-option-deleted') as HTMLInputElement;

    expect(catCheckbox.checked).toBe(true);
    expect(accCheckbox.checked).toBe(true);
    expect(txCheckbox.checked).toBe(true);
    expect(overridesCheckbox.checked).toBe(false);
    expect(splitsCheckbox.checked).toBe(false);
    expect(deletedCheckbox.checked).toBe(true);

    expect(screen.getByText(/2 Kategorien/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Konto/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Buchungen/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ResetModal isOpen={false} onClose={mockOnClose} />);
    expect(
      screen.queryByRole('heading', { name: 'Workspace zurücksetzen' })
    ).not.toBeInTheDocument();
  });

  it('allows quick preset selection using the Bereichswähler (Nur Konfiguration, Nur Buchungen, Alles)', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    const catCheckbox = screen.getByTestId('reset-option-categories') as HTMLInputElement;
    const accCheckbox = screen.getByTestId('reset-option-accounts') as HTMLInputElement;
    const txCheckbox = screen.getByTestId('reset-option-transactions') as HTMLInputElement;
    const overridesCheckbox = screen.getByTestId('reset-option-overrides') as HTMLInputElement;
    const splitsCheckbox = screen.getByTestId('reset-option-splits') as HTMLInputElement;
    const deletedCheckbox = screen.getByTestId('reset-option-deleted') as HTMLInputElement;

    // 1. Nur Konfiguration
    const configOnlyBtn = screen.getByTestId('reset-select-config');
    await user.click(configOnlyBtn);

    expect(catCheckbox.checked).toBe(true);
    expect(accCheckbox.checked).toBe(true);
    expect(txCheckbox.checked).toBe(false);
    expect(overridesCheckbox.checked).toBe(false);
    expect(splitsCheckbox.checked).toBe(false);
    expect(deletedCheckbox.checked).toBe(false);

    // 2. Nur Buchungen
    const transactionsOnlyBtn = screen.getByTestId('reset-select-transactions');
    await user.click(transactionsOnlyBtn);

    expect(catCheckbox.checked).toBe(false);
    expect(accCheckbox.checked).toBe(false);
    expect(txCheckbox.checked).toBe(true);
    expect(overridesCheckbox.checked).toBe(true);
    expect(splitsCheckbox.checked).toBe(true);
    expect(deletedCheckbox.checked).toBe(true);

    // 3. Alles
    const allBtn = screen.getByTestId('reset-select-all');
    await user.click(allBtn);

    expect(catCheckbox.checked).toBe(true);
    expect(accCheckbox.checked).toBe(true);
    expect(txCheckbox.checked).toBe(true);
    expect(deletedCheckbox.checked).toBe(true);
  });

  it('allows group header toggle ("Alle" / "Keine") for Konfiguration and Buchungen', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    const catCheckbox = screen.getByTestId('reset-option-categories') as HTMLInputElement;
    const accCheckbox = screen.getByTestId('reset-option-accounts') as HTMLInputElement;
    const txCheckbox = screen.getByTestId('reset-option-transactions') as HTMLInputElement;
    const overridesCheckbox = screen.getByTestId('reset-option-overrides') as HTMLInputElement;
    const splitsCheckbox = screen.getByTestId('reset-option-splits') as HTMLInputElement;
    const deletedCheckbox = screen.getByTestId('reset-option-deleted') as HTMLInputElement;

    // Both config items are checked by default -> button says "Keine"
    const configToggle = screen.getByTestId('reset-group-toggle-config');
    expect(configToggle).toHaveTextContent('Keine');

    await user.click(configToggle);
    expect(catCheckbox.checked).toBe(false);
    expect(accCheckbox.checked).toBe(false);
    expect(configToggle).toHaveTextContent('Alle');

    // For Buchungen, not all are checked by default -> button says "Alle"
    const buchungenToggle = screen.getByTestId('reset-group-toggle-transactions');
    expect(buchungenToggle).toHaveTextContent('Alle');

    await user.click(buchungenToggle);
    expect(txCheckbox.checked).toBe(true);
    expect(overridesCheckbox.checked).toBe(true);
    expect(splitsCheckbox.checked).toBe(true);
    expect(deletedCheckbox.checked).toBe(true);
    expect(buchungenToggle).toHaveTextContent('Keine');
  });

  it('allows individually toggling checkboxes within groups', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    const catCheckbox = screen.getByTestId('reset-option-categories') as HTMLInputElement;
    const splitsCheckbox = screen.getByTestId('reset-option-splits') as HTMLInputElement;

    expect(catCheckbox.checked).toBe(true);
    expect(splitsCheckbox.checked).toBe(false);

    await user.click(catCheckbox);
    expect(catCheckbox.checked).toBe(false);

    await user.click(splitsCheckbox);
    expect(splitsCheckbox.checked).toBe(true);
  });

  it('calls resetWorkspace with selected options and default target seed', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    // Choose "Nur Konfiguration"
    await user.click(screen.getByTestId('reset-select-config'));

    const confirmBtn = screen.getByRole('button', {
      name: /Auf Beispieldaten zurücksetzen/i,
    });
    await user.click(confirmBtn);

    expect(mockResetWorkspace).toHaveBeenCalledWith({
      target: 'seed',
      resetAccounts: true,
      resetCategories: true,
      resetTransactions: false,
      resetOverrides: false,
      resetSplits: false,
      resetDeletedTransactions: false,
      includeSampleTransactions: false,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows switching target to empty mode and calling resetWorkspace', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    // Switch target to empty
    const emptyBtn = screen.getByTestId('reset-target-empty');
    await user.click(emptyBtn);

    // In empty mode, overrides and splits default to true
    const overridesCheckbox = screen.getByTestId('reset-option-overrides') as HTMLInputElement;
    expect(overridesCheckbox.checked).toBe(true);

    // Choose "Nur Buchungen"
    await user.click(screen.getByTestId('reset-select-transactions'));

    const confirmBtn = screen.getByRole('button', {
      name: /Ausgewählte Bereiche zurücksetzen/i,
    });
    await user.click(confirmBtn);

    expect(mockResetWorkspace).toHaveBeenCalledWith({
      target: 'empty',
      resetAccounts: false,
      resetCategories: false,
      resetTransactions: true,
      resetOverrides: true,
      resetSplits: true,
      resetDeletedTransactions: true,
      includeSampleTransactions: false,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes when clicking close or cancel buttons', async () => {
    const user = userEvent.setup();
    render(<ResetModal isOpen={true} onClose={mockOnClose} />);

    const cancelBtn = screen.getByRole('button', { name: 'Abbrechen' });
    await user.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: 'Schließen' });
    await user.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
