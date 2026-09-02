/**
 * @file AccountModal.test.tsx
 * @description Unit-Tests für AccountModal.
 * @module components/modals/AccountModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountModal } from './AccountModal';

describe('AccountModal', () => {
  it('renders modal and saves account with bucketIds and balanceEntries', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        existingBuckets={[
          { id: 'b-rent', name: 'Miete', parentId: null },
          { id: 'b-food', name: 'Essen', parentId: null },
        ]}
      />
    );

    expect(screen.getByText('Neues Konto anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Girokonto ING, Tagesgeld DKB, Depot');
    fireEvent.change(nameInput, { target: { value: 'Hauptkonto' } });

    // Bucket auswählen
    const rentCheckbox = screen.getByText('Miete');
    fireEvent.click(rentCheckbox);

    const submitBtn = screen.getByText('Konto anlegen');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hauptkonto',
        bucketIds: ['b-rent'],
      })
    );
  });
});
