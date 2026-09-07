/**
 * @file TransactionDetailModal.test.tsx
 * @description Unit-Tests für das vereinheitlichte TransactionDetailModal mit Inline-Editing.
 * @module components/modals/TransactionDetailModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionDetailModal } from './TransactionDetailModal';
import { Transaction, Account, Category } from '@/types/finance';

describe('TransactionDetailModal', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-giro',
      name: 'Haupt-Girokonto',
      accountType: 'real',
      iban: 'DE44500105175407324900',
      balanceEntries: [],
    },
    {
      id: 'acc-tagesgeld',
      name: 'Tagesgeldkonto',
      accountType: 'real',
      iban: 'DE44500105175407324995',
      balanceEntries: [],
    },
    {
      id: 'acc-virt-urlaub',
      name: 'Urlaubstopf',
      accountType: 'virtual',
      parentAccountId: 'acc-giro',
      categoryIds: ['cat-reisen'],
      balanceEntries: [],
    },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-reisen', name: 'Reisen & Urlaub', parentId: null },
    { id: 'cat-essen', name: 'Lebensmittel', parentId: null },
  ];

  const mockTx: Transaction = {
    id: 'tx-101',
    accountIban: 'DE44500105175407324900',
    date: '2026-08-15',
    issuer: '',
    receiver: 'Lufthansa AG',
    subject: 'Flugbuchung Sommerurlaub',
    iban: 'DE991234567890',
    value: -450,
    categoryId: 'cat-reisen',
    assignmentSource: 'auto_regex',
    origin: 'imported',
    importFilename: 'umsatz-2026.csv',
    dayIndex: 12,
    rawFingerprint: 'fp-lufthansa-123',
  };

  it('renders complete transaction details with inline inputs and non-editable amount notice', () => {
    const handleClose = vi.fn();

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    // Header & ID
    expect(screen.getByText('Buchungsdetails')).toBeInTheDocument();
    expect(screen.getByText('ID: tx-101')).toBeInTheDocument();

    // Betrag (nicht editierbar) & Sperr-Badge
    expect(screen.getByText('-450,00 €')).toBeInTheDocument();
    expect(screen.getByText('Fest (nur über Split änderbar)')).toBeInTheDocument();
    expect(screen.getByText('Ausgabe')).toBeInTheDocument();

    // Initialer Suchstring
    expect(
      screen.getByText('[Ausgang] Lufthansa AG: Flugbuchung Sommerurlaub (DE991234567890)')
    ).toBeInTheDocument();

    // Inline-Eingabefelder für Verwendungszweck, Partner und Wertstellungsdatum
    expect(screen.getByDisplayValue('Flugbuchung Sommerurlaub')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lufthansa AG')).toBeInTheDocument();
    expect(screen.getByLabelText('Wertstellungsdatum (Valuta)')).toHaveValue('2026-08-15');

    // Konten & Virtuelle Unterkonten
    expect(screen.getByText(/IBAN: DE44500105175407324900/)).toBeInTheDocument();
    expect(screen.getByText('Urlaubstopf')).toBeInTheDocument();

    // Kategorie & Herkunft
    expect(screen.getByText('Automatisch via Regex')).toBeInTheDocument();

    // Import-Metadaten
    expect(screen.getByText('umsatz-2026.csv')).toBeInTheDocument();
    expect(screen.getByText('#13')).toBeInTheDocument();
    expect(screen.getByText('fp-lufthansa-123')).toBeInTheDocument();
  });

  it('excludes virtual accounts from the booking account dropdown', () => {
    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    const accountSelect = screen.getByLabelText('Buchungskonto') as HTMLSelectElement;
    const optionTexts = Array.from(accountSelect.options).map((opt) => opt.textContent || '');

    // Reale Konten sind vorhanden
    expect(optionTexts.some((text) => text.includes('Haupt-Girokonto'))).toBe(true);
    expect(optionTexts.some((text) => text.includes('Tagesgeldkonto'))).toBe(true);

    // Virtuelle Unterkonten sind NICHT als Auswahloption vorhanden
    expect(optionTexts.some((text) => text.includes('Urlaubstopf'))).toBe(false);
  });

  it('dynamically updates compound search string when editing subject or partner', () => {
    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    const subjectInput = screen.getByLabelText('Verwendungszweck');
    fireEvent.change(subjectInput, { target: { value: 'Geänderter Urlaubszweck' } });

    // Compound search string updates in real time
    expect(
      screen.getByText('[Ausgang] Lufthansa AG: Geänderter Urlaubszweck (DE991234567890)')
    ).toBeInTheDocument();
  });

  it('saves updated transaction and sets assignmentSource to manual when category changes', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onSave={handleSave}
      />
    );

    // Verwendungszweck ändern
    const subjectInput = screen.getByLabelText('Verwendungszweck');
    fireEvent.change(subjectInput, { target: { value: 'Flug nach Mallorca' } });

    // Kategorie ändern auf Lebensmittel
    const categorySelect = screen.getByLabelText('Kategorie');
    fireEvent.change(categorySelect, { target: { value: 'cat-essen' } });

    // Speichern anklicken
    const saveButton = screen.getByRole('button', { name: /Speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedTx = handleSave.mock.calls[0][0] as Transaction;
    expect(savedTx.subject).toBe('Flug nach Mallorca');
    expect(savedTx.categoryId).toBe('cat-essen');
    expect(savedTx.assignmentSource).toBe('manual');
    expect(handleClose).toHaveBeenCalled();
  });

  it('handles split action button click', () => {
    const handleClose = vi.fn();
    const handleSplit = vi.fn();

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onSplit={handleSplit}
      />
    );

    // Klick auf Aufteilen (Split) im Footer
    const splitButton = screen.getByRole('button', { name: 'Aufteilen (Split)' });
    fireEvent.click(splitButton);

    expect(handleSplit).toHaveBeenCalledWith(mockTx);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders reset button for overridden transaction and invokes onReset', () => {
    const overriddenTx: Transaction = {
      ...mockTx,
      originalSubject: 'Ursprünglicher Flug',
      originalReceiver: 'LH Group',
      subject: 'Manueller Flug',
    };
    const handleReset = vi.fn();

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={overriddenTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onReset={handleReset}
      />
    );

    // Badge "Override" und Rohdatenanzeige
    expect(screen.getByText('Override')).toBeInTheDocument();
    expect(screen.getByText('Ursprüngliche Bank-Rohdaten:')).toBeInTheDocument();
    expect(screen.getByText('Ursprünglicher Flug')).toBeInTheDocument();

    // Reset-Button
    const resetButton = screen.getByRole('button', { name: /Auf Bankdaten zurücksetzen/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(handleReset).toHaveBeenCalledWith(overriddenTx.id);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <TransactionDetailModal
        isOpen={false}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders managed counter account pill for internal transfers', () => {
    const transferTx: Transaction = {
      id: 'tx-transfer-99',
      accountIban: 'DE44500105175407324900',
      date: '2026-08-10',
      receiver: 'Tagesgeldkonto',
      issuer: 'Martin',
      subject: 'Umbuchung',
      iban: 'DE44500105175407324995',
      value: -500,
      assignmentSource: 'manual',
      origin: 'imported',
    };

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={transferTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    // Gegenkonto IBAN und Name sichtbar
    expect(screen.getByText('DE44500105175407324995')).toBeInTheDocument();
    expect(screen.getByText(/IBAN: DE44500105175407324900/)).toBeInTheDocument();
    expect(screen.getByText('Tagesgeldkonto')).toBeInTheDocument();
  });

  it('marks external counter account when counter account is not managed', () => {
    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    // Gegenkonto hat IBAN als Text und Hinweistext als extern darunter
    expect(screen.getByText('DE991234567890')).toBeInTheDocument();
    expect(screen.getByText('Externes Konto (nicht verwaltet)')).toBeInTheDocument();
  });
});
