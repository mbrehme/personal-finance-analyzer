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
});
