/**
 * @file BucketModal.test.tsx
 * @description Unit-Tests für BucketModal (Backwards Compatibility Alias).
 * @module components/modals/BucketModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BucketModal } from './BucketModal';

describe('BucketModal Alias', () => {
  it('renders modal when open and handles submit via legacy props', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <BucketModal isOpen={true} onClose={handleClose} onSave={handleSave} existingBuckets={[]} />
    );

    expect(screen.getByText('Neue Kategorie anlegen')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('z. B. Miete, Lebensmittel, Gehalt');
    fireEvent.change(nameInput, { target: { value: 'Versicherungen' } });

    const submitBtn = screen.getByText('Kategorie anlegen');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Versicherungen',
      })
    );
  });
});
