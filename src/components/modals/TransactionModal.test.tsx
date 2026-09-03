/**
 * @file TransactionModal.test.tsx
 * @description Unit-Tests für TransactionModal (Create, Edit mit Side-by-Side & Split-Validierung).
 * @module components/modals/TransactionModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TransactionModal } from './TransactionModal';
import { Account, Category, Transaction } from '@/types/finance';

describe('TransactionModal', () => {
  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'Girokonto', categoryIds: [], balanceEntries: [] },
  ];
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'Lebensmittel', parentId: null },
    { id: 'cat-drugstore', name: 'Drogerie', parentId: null },
  ];

  const mockTransaction: Transaction = {
    id: 'tx-1',
    accountId: 'acc-1',
    valueDate: '2026-09-01',
    bookingDate: '2026-09-01',
    issuer: '',
    receiver: 'REWE Markt GmbH',
    subject: 'REWE SAG DANKE FILIALE 1234',
    type: 'outbound',
    iban: 'DE8937040044',
    value: -100,
    assignmentSource: 'unassigned',
    origin: 'imported',
    rawFingerprint: 'fp-12345',
    originalValueDate: '2026-09-01',
    originalValue: -100,
    originalSubject: 'REWE SAG DANKE FILIALE 1234',
    originalReceiver: 'REWE Markt GmbH',
    originalIban: 'DE8937040044',
  };

  const onSave = vi.fn();
  const onSplit = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in create mode and submits new manual transaction', async () => {
    render(
      <TransactionModal
        isOpen={true}
        mode="create"
        accounts={mockAccounts}
        categories={mockCategories}
        onSave={onSave}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Neue Buchung erfassen')).toBeInTheDocument();

    // Fill in required fields
    const subjectInput = screen.getByPlaceholderText('Beschreibung der Buchung...');
    fireEvent.change(subjectInput, { target: { value: 'Bargeld Einkauf' } });

    // In MoneyInput enter 45
    const moneyInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(moneyInput, { target: { value: '45' } });

    // Submit form
    const form = screen.getByRole('dialog').querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        subject: 'Bargeld Einkauf',
        value: -45,
        type: 'outbound',
      })
    );
  });

  it('renders side-by-side view in edit mode for imported transactions with reset button', () => {
    render(
      <TransactionModal
        isOpen={true}
        mode="edit"
        initialTransaction={mockTransaction}
        accounts={mockAccounts}
        categories={mockCategories}
        onSave={onSave}
        onClose={onClose}
      />
    );

    // Verify side-by-side headers
    expect(screen.getByText('Bankdaten (Original)')).toBeInTheDocument();
    expect(screen.getByText('Deine Anpassungen')).toBeInTheDocument();

    // Verify original bank values are shown read-only
    expect(screen.getByText('REWE SAG DANKE FILIALE 1234')).toBeInTheDocument();

    // Change subject in editable column
    const subjectInput = screen.getByDisplayValue('REWE SAG DANKE FILIALE 1234');
    fireEvent.change(subjectInput, { target: { value: 'Wocheneinkauf' } });

    // Reset button should now be visible for subject
    const resetBtn = screen.getByTitle('Auf Bankwert zurücksetzen');
    expect(resetBtn).toBeInTheDocument();

    // Click reset
    fireEvent.click(resetBtn);
    expect(subjectInput).toHaveValue('REWE SAG DANKE FILIALE 1234');
  });

  it('handles split mode: validates remaining amount cannot go <= 0, live calculates remaining, and submits split', async () => {
    render(
      <TransactionModal
        isOpen={true}
        mode="split"
        initialTransaction={mockTransaction}
        accounts={mockAccounts}
        categories={mockCategories}
        onSave={onSave}
        onSplit={onSplit}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Buchung aufteilen (Split)')).toBeInTheDocument();
    expect(screen.getByText('Ursprünglicher Betrag:')).toBeInTheDocument();

    // Enter split amount that is too large (120 € on a 100 € transaction)
    const moneyInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(moneyInput, { target: { value: '120' } });

    // Validation warning must appear and submit button disabled
    expect(
      screen.getByText(/Der verbleibende Restbetrag kann nicht unter 0,00 € fallen/i)
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Jetzt aufteilen/i });
    expect(submitBtn).toBeDisabled();

    // Now enter valid split amount of 30 €
    fireEvent.change(moneyInput, { target: { value: '30' } });

    // Live remaining balance should now be 70,00 €
    expect(screen.getByText('-70,00 €')).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    // Click split submit
    const form = screen.getByRole('dialog').querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSplit).toHaveBeenCalledWith(
      'tx-1',
      30,
      expect.objectContaining({
        subject: expect.stringContaining('Teilbetrag'),
      })
    );
  });
});
