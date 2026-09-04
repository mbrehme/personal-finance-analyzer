/**
 * @file TransactionDetailModal.test.tsx
 * @description Unit-Tests für das TransactionDetailModal.
 * @module components/modals/TransactionDetailModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    valueDate: '2026-08-15',
    bookingDate: '2026-08-15',
    issuer: '',
    receiver: 'Lufthansa AG',
    subject: 'Flugbuchung Sommerurlaub',
    iban: 'DE991234567890',
    value: -450,
    categoryId: 'cat-reisen',
    assignmentSource: 'auto_regex',
    origin: 'imported',
    importFilename: 'umsatz-2026.csv',
    importIndex: 12,
    rawFingerprint: 'fp-lufthansa-123',
  };

  it('renders complete transaction details including compound search string', () => {
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

    // Betrag
    expect(screen.getByText('-450,00 €')).toBeInTheDocument();
    expect(screen.getByText('Ausgabe')).toBeInTheDocument();

    // Suchstring
    expect(
      screen.getByText('[Ausgang] Lufthansa AG: Flugbuchung Sommerurlaub (DE991234567890)')
    ).toBeInTheDocument();

    // Basisdaten
    expect(screen.getByText('Flugbuchung Sommerurlaub')).toBeInTheDocument();
    expect(screen.getByText('Lufthansa AG')).toBeInTheDocument();

    // Konten & Virtuelle Unterkonten
    expect(screen.getByText('Haupt-Girokonto')).toBeInTheDocument();
    expect(screen.getByText('Urlaubstopf')).toBeInTheDocument();

    // Kategorie
    expect(screen.getByText('Reisen & Urlaub')).toBeInTheDocument();
    expect(screen.getByText('Automatisch via Regex')).toBeInTheDocument();

    // Import-Metadaten
    expect(screen.getByText('umsatz-2026.csv')).toBeInTheDocument();
    expect(screen.getByText('#13')).toBeInTheDocument();
    expect(screen.getByText('fp-lufthansa-123')).toBeInTheDocument();
  });

  it('handles edit and split action clicks', () => {
    const handleClose = vi.fn();
    const handleEdit = vi.fn();
    const handleSplit = vi.fn();

    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onEdit={handleEdit}
        onSplit={handleSplit}
      />
    );

    // Klick auf Bearbeiten
    fireEvent.click(screen.getByText('Bearbeiten'));
    expect(handleEdit).toHaveBeenCalledWith(mockTx);
    expect(handleClose).toHaveBeenCalled();

    // Klick auf Aufteilen
    fireEvent.click(screen.getByText('Aufteilen (Split)'));
    expect(handleSplit).toHaveBeenCalledWith(mockTx);
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

  it('renders IBAN as text and managed account pills consistently for internal transfers', () => {
    const transferTx: Transaction = {
      id: 'tx-transfer-99',
      accountIban: 'DE44500105175407324900',
      valueDate: '2026-08-10',
      bookingDate: '2026-08-10',
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

    // Beide IBANs sind als Text sichtbar
    expect(screen.getByText('DE44500105175407324900')).toBeInTheDocument();
    expect(screen.getByText('DE44500105175407324995')).toBeInTheDocument();

    // Beide Konten sind als Pill darunter sichtbar (Tagesgeldkonto taucht als Empfänger und als Pill auf)
    expect(screen.getByText('Haupt-Girokonto')).toBeInTheDocument();
    expect(screen.getAllByText('Tagesgeldkonto').length).toBeGreaterThanOrEqual(2);
  });

  it('renders IBAN as text and marks external counter account when counter account is not managed', () => {
    render(
      <TransactionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    // Gebuchtes Konto hat IBAN als Text und Pill darunter
    expect(screen.getByText('DE44500105175407324900')).toBeInTheDocument();
    expect(screen.getByText('Haupt-Girokonto')).toBeInTheDocument();

    // Gegenkonto hat IBAN als Text und Hinweistext als unmanaged darunter
    expect(screen.getByText('DE991234567890')).toBeInTheDocument();
    expect(screen.getByText('Externes Konto (nicht verwaltet)')).toBeInTheDocument();
  });
});
