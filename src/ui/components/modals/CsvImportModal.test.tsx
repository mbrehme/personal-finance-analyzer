import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CsvImportModal } from './CsvImportModal';

describe('CsvImportModal', () => {
  it('renders upload area initially without an account select dropdown', () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();

    render(
      <CsvImportModal
        isOpen={true}
        onClose={handleClose}
        accounts={[{ id: 'acc-1', name: 'Girokonto', balanceEntries: [] }]}
        onImport={handleImport}
      />
    );

    expect(screen.getByText('Bank-Umsätze importieren (CSV)')).toBeInTheDocument();
    expect(screen.getByText('CSV-Datei auswählen oder hierher ziehen')).toBeInTheDocument();
    // Vor dem Upload noch kein Buchungskonto-Dropdown sichtbar
    expect(screen.queryByLabelText(/Buchungskonto/i)).not.toBeInTheDocument();
  });

  it('shows account selection with only real accounts (excluding virtual accounts) and disables import until account is chosen', async () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn().mockResolvedValue(1);

    const accounts = [
      {
        id: 'acc-real-1',
        name: 'Girokonto Hauptkonto',
        accountType: 'real' as const,
        iban: 'DE11 2233 4455',
        balanceEntries: [],
      },
      {
        id: 'acc-real-2',
        name: 'Tagesgeldkonto',
        accountType: 'real' as const,
        iban: 'DE99 8877 6655',
        balanceEntries: [],
      },
      {
        id: 'acc-virt-1',
        name: 'Urlaubspuffer (Virtuell)',
        accountType: 'virtual' as const,
        parentAccountId: 'acc-real-1',
        balanceEntries: [],
      },
    ];

    const { container } = render(
      <CsvImportModal
        isOpen={true}
        onClose={handleClose}
        accounts={accounts}
        onImport={handleImport}
      />
    );

    const csvContent = `Buchungstag;Empfänger;Verwendungszweck;Betrag;IBAN
01.09.2026;Supermarkt;Einkauf;-25,50;DE9876543210`;
    const file = new File([csvContent], 'umsatz.csv', { type: 'text/csv' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Vorschau und Spalten-Mapping sind sichtbar
    expect(await screen.findByText('Spalten-Zuordnung prüfen')).toBeInTheDocument();

    // Konto-Auswahl ist sichtbar
    const accountSelect = screen.getByLabelText(/Buchungskonto/i);
    expect(accountSelect).toBeInTheDocument();

    // Reale Konten sind vorhanden
    expect(screen.getByRole('option', { name: /Girokonto Hauptkonto/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Tagesgeldkonto/i })).toBeInTheDocument();

    // Virtuelle Konten dürfen NICHT zur Auswahl stehen
    expect(screen.queryByRole('option', { name: /Urlaubspuffer/i })).not.toBeInTheDocument();

    // Import-Button ist deaktiviert, solange kein Konto gewählt wurde
    const importButton = screen.getByRole('button', { name: /1 Buchungen importieren/i });
    expect(importButton).toBeDisabled();

    // Konto manuell auswählen
    fireEvent.change(accountSelect, { target: { value: 'acc-real-1' } });

    // Jetzt ist der Import-Button aktiviert
    expect(importButton).toBeEnabled();

    fireEvent.click(importButton);

    expect(handleImport).toHaveBeenCalledTimes(1);
    const importedTransactions = handleImport.mock.calls[0][0];
    expect(importedTransactions).toHaveLength(1);
    expect(importedTransactions[0].value).toBe(-25.5);
    expect(importedTransactions[0].subject).toBe('Einkauf');
    expect(importedTransactions[0].senderIban).toBe('DE1122334455');
  });

  it('preselects initialAccountId and does not silently overwrite it when CSV contains a different preamble IBAN', async () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn().mockResolvedValue(1);

    const accounts = [
      {
        id: 'acc-real-1',
        name: 'Girokonto Hauptkonto',
        accountType: 'real' as const,
        iban: 'DE1122334455',
        balanceEntries: [],
      },
      {
        id: 'acc-real-2',
        name: 'Rücklagenkonto',
        accountType: 'real' as const,
        iban: 'DE80120300001027106861',
        balanceEntries: [],
      },
    ];

    const { container } = render(
      <CsvImportModal
        isOpen={true}
        onClose={handleClose}
        accounts={accounts}
        initialAccountId="acc-real-1"
        onImport={handleImport}
      />
    );

    // CSV mit Preamble-IBAN von Konto 2 (Rücklagen)
    const csvContent = `"Tagesgeld";"DE80120300001027106861"
"Buchungsdatum";"Empfänger";"Verwendungszweck";"Betrag";"IBAN"
"01.09.2026";"Supermarkt";"Einkauf";"-25,50";"DE9876543210"`;
    const file = new File([csvContent], 'umsatz.csv', { type: 'text/csv' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Buchungskonto bleibt das initial gewählte Hauptkonto (kein stilles Überschreiben!)
    const accountSelect = (await screen.findByLabelText(/Buchungskonto/i)) as HTMLSelectElement;
    expect(accountSelect.value).toBe('acc-real-1');

    // Wechsel-Button wird angeboten
    const switchButton = screen.getByRole('button', {
      name: /Zu 'Rücklagenkonto' wechseln/i,
    });
    expect(switchButton).toBeInTheDocument();

    // Klick auf den Wechsel-Button schaltet auf Rücklagenkonto um
    fireEvent.click(switchButton);
    expect(accountSelect.value).toBe('acc-real-2');
  });
});
