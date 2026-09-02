/**
 * @file CsvImportModal.test.tsx
 * @description Unit-Tests für CsvImportModal.
 * @module components/modals/CsvImportModal.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CsvImportModal } from './CsvImportModal';

describe('CsvImportModal', () => {
  it('renders modal when open', () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();

    render(
      <CsvImportModal
        isOpen={true}
        onClose={handleClose}
        accounts={[{ id: 'acc-1', name: 'Girokonto', currency: 'EUR', bucketIds: [], balanceEntries: [] }]}
        onImport={handleImport}
      />
    );

    expect(screen.getByText('Bank-Umsätze importieren (CSV)')).toBeInTheDocument();
    expect(screen.getByText('Girokonto')).toBeInTheDocument();
  });
});
