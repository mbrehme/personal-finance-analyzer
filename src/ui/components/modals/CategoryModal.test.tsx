/**
 * @file CategoryModal.test.tsx
 * @description Unit-Tests für CategoryModal.
 * @module components/modals/CategoryModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryModal } from './CategoryModal';
import { ISODateString } from '@/types/finance';

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

  it('handles adding multiple budgets with validFrom and saves them correctly', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryModal isOpen={true} onClose={vi.fn()} onSave={handleSave} existingCategories={[]} />
    );

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Streaming' } });

    const budgetCheckbox = screen.getByRole('checkbox');
    fireEvent.click(budgetCheckbox);

    // Initial budget is 100
    const firstBudgetInput = screen.getByDisplayValue('100');
    fireEvent.change(firstBudgetInput, { target: { value: '25' } });

    // Add another budget
    const addBtn = screen.getByText(/Weiteres Budget hinzufügen/i);
    fireEvent.click(addBtn);

    // There should now be two budget entries
    expect(screen.getByText('Budget #1')).toBeInTheDocument();
    expect(screen.getByText('Budget #2')).toBeInTheDocument();

    const inputs = screen.getAllByPlaceholderText('0.00');
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[1], { target: { value: '35' } });

    const dateInputs = screen.getAllByLabelText('Gültig ab');
    expect(dateInputs).toHaveLength(2);
    fireEvent.change(dateInputs[1], { target: { value: '2027-01-01' } });

    const submitBtn = screen.getByText('Kategorie anlegen');
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Streaming',
        targetBudget: {
          amount: 25,
          period: 'monthly',
        },
        targetBudgets: [
          {
            amount: 25,
            period: 'monthly',
          },
          {
            amount: 35,
            period: 'monthly',
            validFrom: '2027-01-01',
          },
        ],
      })
    );
  });

  it('pre-populates existing multiple budgets and supports deleting an entry', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const existingCategory = {
      id: 'cat-test',
      name: 'Internet',
      parentId: null,
      order: 0,
      targetBudget: { amount: 50, period: 'monthly' as const },
      targetBudgets: [
        { id: 'b1', amount: 50, period: 'monthly' as const },
        {
          id: 'b2',
          amount: 65,
          period: 'monthly' as const,
          validFrom: '2026-06-01' as ISODateString,
        },
      ],
    };

    render(
      <CategoryModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        category={existingCategory}
        existingCategories={[existingCategory]}
      />
    );

    expect(screen.getByText('Budget #1')).toBeInTheDocument();
    expect(screen.getByText('Budget #2')).toBeInTheDocument();

    const deleteButtons = screen.getAllByTitle('Budget entfernen');
    expect(deleteButtons).toHaveLength(2);

    // Delete the second budget
    fireEvent.click(deleteButtons[1]);

    expect(screen.queryByText('Budget #2')).not.toBeInTheDocument();

    const submitBtn = screen.getByText('Änderungen speichern');
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cat-test',
        name: 'Internet',
        targetBudget: {
          id: 'b1',
          amount: 50,
          period: 'monthly',
        },
        targetBudgets: [
          {
            id: 'b1',
            amount: 50,
            period: 'monthly',
          },
        ],
      })
    );
  });
});
