/**
 * @file ExportModal.test.tsx
 * @description Unit-Tests für den ExportModal Dialog.
 * @module components/modals/ExportModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportModal } from './ExportModal';
import * as FinanceContextModule from '@/domain';

describe('ExportModal', () => {
  const mockExportConfiguration = vi.fn().mockResolvedValue('{"version":2}');
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        { id: 'acc1', name: 'Girokonto', color: '#000', icon: 'Wallet' },
        { id: 'acc2', name: 'Tagesgeld', color: '#111', icon: 'PiggyBank' },
      ] as any,
      categories: [
        { id: 'cat1', name: 'Miete', color: '#222', icon: 'Home' },
        { id: 'cat2', name: 'Gehalt', color: '#333', icon: 'Briefcase' },
      ] as any,
      transactions: [
        {
          id: 'tx1',
          origin: 'imported',
          value: -50,
          assignmentSource: 'unassigned',
        },
        {
          id: 'tx2',
          origin: 'manual',
          value: -20,
          assignmentSource: 'manual',
        },
      ] as any,
      deletedTransactions: [
        { id: 'del1', origin: 'imported', value: -10, assignmentSource: 'unassigned' },
      ] as any,
      exportConfiguration: mockExportConfiguration,
    } as any);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders modal with all checkboxes selected by default', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('heading', { name: 'Daten exportieren' })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(5);
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });

    expect(screen.getByText('2 Konten')).toBeInTheDocument();
    expect(screen.getByText('2 Kategorien')).toBeInTheDocument();
    expect(screen.getByText('1 Eintrag')).toBeInTheDocument(); // 1 manual
    expect(screen.getByText('2 Buchungen')).toBeInTheDocument(); // 2 transactions
    expect(screen.getByText('1 Buchung')).toBeInTheDocument(); // 1 deleted
  });

  it('does not render when isOpen is false', () => {
    render(<ExportModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('heading', { name: 'Daten exportieren' })).not.toBeInTheDocument();
  });

  it('allows toggling presets (Nur Konfiguration vs Alles auswählen)', async () => {
    const user = userEvent.setup();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const configOnlyBtn = screen.getByRole('button', { name: 'Nur Konfiguration' });
    await user.click(configOnlyBtn);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Accounts: checked, Categories: checked, Manual: checked, Transactions: unchecked, Deleted: unchecked
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(false);
    expect(checkboxes[4].checked).toBe(false);

    const allBtn = screen.getByRole('button', { name: 'Alles auswählen' });
    await user.click(allBtn);

    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });
  });

  it('calls exportConfiguration and triggers download', async () => {
    const user = userEvent.setup();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const exportBtn = screen.getByRole('button', { name: /Exportieren \(\.json\)/i });
    await user.click(exportBtn);

    expect(mockExportConfiguration).toHaveBeenCalledWith({
      includeAccounts: true,
      includeCategories: true,
      includeManualTransactions: true,
      includeTransactions: true,
      includeDeletedTransactions: true,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });
});
