/**
 * @file CategoryModal.test.tsx
 * @description Unit-Tests für CategoryModal.
 * @module components/modals/CategoryModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryModal } from './CategoryModal';

describe('CategoryModal', () => {
  it('renders modal when open and handles submit', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <CategoryModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingCategories={[]}
      />
    );

    expect(screen.getByText('Neue Kategorie anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Versicherungen' } });

    const regexInput = screen.getByPlaceholderText('z. B. Rewe|Edeka|Aldi|Lidl');
    fireEvent.change(regexInput, { target: { value: 'Allianz|HUK|Debeka' } });

    const submitBtn = screen.getByText('Kategorie anlegen');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Versicherungen',
        regexPattern: 'Allianz|HUK|Debeka',
      })
    );
  });

  it('handles target budget input with MoneyInput', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryModal isOpen={true} onClose={vi.fn()} onSave={handleSave} existingCategories={[]} />
    );

    expect(screen.getByText('Neue Kategorie anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Urlaub' } });

    const budgetCheckbox = screen.getByRole('checkbox');
    fireEvent.click(budgetCheckbox);

    const budgetInput = screen.getByDisplayValue('100');
    fireEvent.change(budgetInput, { target: { value: '500' } });

    const submitBtn = screen.getByText('Kategorie anlegen');
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Urlaub',
        targetBudget: {
          amount: 500,
          period: 'monthly',
        },
      })
    );
  });

  it('displays rollup hint for parent categories and allows setting manual budget', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const parentCategory = {
      id: 'b-parent',
      name: 'Wohnen',
      parentId: null,
      order: 0,
    };
    const childCategory = {
      id: 'b-child',
      name: 'Miete',
      parentId: 'b-parent',
      order: 0,
      targetBudget: { amount: 1200, period: 'monthly' as const },
    };

    render(
      <CategoryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        category={parentCategory}
        existingCategories={[parentCategory, childCategory]}
      />
    );

    // Automatischer Rollup-Hinweis muss sichtbar sein
    expect(screen.getByText(/Automatisches Rollup aktiv/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.200,00/i)).toBeInTheDocument();

    // Keine Option für manuelle Budgeteingabe bei Elternkategorien
    expect(
      screen.queryByRole('button', { name: /Manuell überschreiben/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Soll-Budget festlegen')).not.toBeInTheDocument();

    // Speichern der Elternkategorie (targetBudget muss undefined sein)
    const submitBtn = screen.getByText('Änderungen speichern');
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'b-parent',
        name: 'Wohnen',
        targetBudget: undefined,
      })
    );
  });
});
