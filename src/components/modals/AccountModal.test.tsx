/**
 * @file AccountModal.test.tsx
 * @description Unit-Tests für AccountModal (Echtes Bankkonto mit IBAN und Virtuelles Unterkonto).
 * @module components/modals/AccountModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AccountModal } from './AccountModal';
import { Account } from '@/types/finance';

describe('AccountModal', () => {
  const existingAccounts: Account[] = [
    {
      id: 'acc-real-1',
      name: 'Haupt-Girokonto',
      accountType: 'real',
      iban: 'DE8937040044',
      balanceEntries: [],
    },
  ];

  it('renders modal and saves real account with IBAN and no categories', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingAccounts={existingAccounts}
      />
    );

    expect(screen.getByText('Neues Bankkonto anlegen')).toBeInTheDocument();
    expect(screen.getByText('Echtes Bankkonto')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Girokonto ING, Tagesgeld DKB, Depot');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Hauptkonto ING' } });
    });

    // IBAN eingeben
    const ibanInput = screen.getByPlaceholderText('z. B. DE89 3704 0044 0532 0130 00');
    await act(async () => {
      fireEvent.change(ibanInput, { target: { value: 'de89 3704 0044 0532 0130 00' } });
    });

    const submitBtn = screen.getByRole('button', { name: /Konto anlegen/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hauptkonto ING',
        accountType: 'real',
        iban: 'DE89370400440532013000',
        categoryIds: [],
      })
    );
  });

  it('switches to virtual subaccount, selects parent account and saves with filter categories', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingAccounts={existingAccounts}
        existingCategories={[
          { id: 'cat-travel', name: 'Urlaub & Reisen', parentId: null },
          { id: 'cat-savings', name: 'Rücklagen', parentId: null },
        ]}
      />
    );

    // Auf "Virtuelles Unterkonto" umschalten
    const virtualBtn = screen.getByText('Virtuelles Unterkonto');
    await act(async () => {
      fireEvent.click(virtualBtn);
    });

    expect(screen.getByText('Neues virtuelles Unterkonto anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Urlaubstopf, Notgroschen, Steuerrücklage');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Urlaubstopf' } });
    });

    // Elternkonto auswählen
    const parentSelect = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(parentSelect, { target: { value: 'acc-real-1' } });
    });

    // Kategorie Filter-Picker öffnen
    const catPickerBtn = screen.getByTestId('category-filter-dropdown-btn');
    await act(async () => {
      fireEvent.click(catPickerBtn);
    });

    // Zuerst "Keine" auswählen
    const noneBtn = screen.getByRole('button', { name: 'Keine' });
    await act(async () => {
      fireEvent.click(noneBtn);
    });

    // "Urlaub & Reisen" anklicken
    const travelBtn = screen.getByRole('button', { name: /Urlaub & Reisen/i });
    await act(async () => {
      fireEvent.click(travelBtn);
    });

    const submitBtn = screen.getByRole('button', { name: /Konto anlegen/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Urlaubstopf',
        accountType: 'virtual',
        parentAccountId: 'acc-real-1',
        categoryIds: ['cat-travel'],
      })
    );
  });

  it('validates that a virtual subaccount requires a parent account', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingAccounts={existingAccounts}
      />
    );

    // Auf "Virtuelles Unterkonto" umschalten
    await act(async () => {
      fireEvent.click(screen.getByText('Virtuelles Unterkonto'));
    });

    const nameInput = screen.getByPlaceholderText('z. B. Urlaubstopf, Notgroschen, Steuerrücklage');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Urlaub' } });
    });

    // Ohne Elternkonto absenden
    const submitBtn = screen.getByRole('button', { name: /Konto anlegen/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(handleSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        /Bitte wähle ein übergeordnetes echtes Konto für das virtuelle Unterkonto aus/i
      )
    ).toBeInTheDocument();
  });
});
