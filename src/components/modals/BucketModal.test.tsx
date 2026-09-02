/**
 * @file BucketModal.test.tsx
 * @description Unit-Tests für BucketModal.
 * @module components/modals/BucketModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BucketModal } from './BucketModal';

describe('BucketModal', () => {
  it('renders modal when open and handles submit', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <BucketModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingBuckets={[]}
      />
    );

    expect(screen.getByText('Neuen Bucket anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Versicherungen' } });

    const regexInput = screen.getByPlaceholderText('z. B. Rewe|Edeka|Aldi|Lidl');
    fireEvent.change(regexInput, { target: { value: 'Allianz|HUK|Debeka' } });

    const submitBtn = screen.getByText('Bucket anlegen');
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
      <BucketModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        existingBuckets={[]}
      />
    );

    expect(screen.getByText('Neuen Bucket anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Urlaub' } });

    const budgetCheckbox = screen.getByRole('checkbox');
    fireEvent.click(budgetCheckbox);

    const budgetInput = screen.getByDisplayValue('100');
    fireEvent.change(budgetInput, { target: { value: '500' } });

    const submitBtn = screen.getByText('Bucket anlegen');
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

  it('displays rollup hint for parent buckets and allows setting manual budget', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const parentBucket = {
      id: 'b-parent',
      name: 'Wohnen',
      parentId: null,
      order: 0,
    };
    const childBucket = {
      id: 'b-child',
      name: 'Miete',
      parentId: 'b-parent',
      order: 0,
      targetBudget: { amount: 1200, period: 'monthly' as const },
    };

    render(
      <BucketModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        bucket={parentBucket}
        existingBuckets={[parentBucket, childBucket]}
      />
    );

    // Automatischer Rollup-Hinweis muss sichtbar sein
    expect(screen.getByText(/Automatisches Rollup aktiv/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.200,00/i)).toBeInTheDocument();

    // Klick auf "Manuell überschreiben"
    const overrideBtn = screen.getByRole('button', { name: /Manuell überschreiben/i });
    fireEvent.click(overrideBtn);

    // Rollup-Hinweis unter den Inputs sichtbar
    expect(screen.getByText(/Rollup der Kinder:/i)).toBeInTheDocument();

    // Speichern mit manuellem Betrag
    const submitBtn = screen.getByText('Änderungen speichern');
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'b-parent',
        name: 'Wohnen',
        targetBudget: {
          amount: 1200,
          period: 'monthly',
        },
      })
    );
  });
});
