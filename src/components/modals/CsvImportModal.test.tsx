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
        accounts={[{ id: 'acc-1', name: 'Girokonto', bucketIds: [], balanceEntries: [] }]}
        onImport={handleImport}
      />
    );

    expect(screen.getByText('Bank-Umsätze importieren (CSV)')).toBeInTheDocument();
    expect(screen.getByText('Girokonto')).toBeInTheDocument();
  });

  it('renders account with IBAN and virtual subaccount in select dropdown', () => {
    const handleClose = vi.fn();
    const handleImport = vi.fn();

    render(
      <CsvImportModal
        isOpen={true}
        onClose={handleClose}
        accounts={[
          {
            id: 'acc-1',
            name: 'Girokonto Real',
            accountType: 'real',
            iban: 'DE12 3456 7890',
            bucketIds: [],
            balanceEntries: [],
          },
          {
            id: 'acc-2',
            name: 'Urlaubstopf Virtual',
            accountType: 'virtual',
            parentAccountId: 'acc-1',
            bucketIds: [],
            balanceEntries: [],
          },
        ]}
        onImport={handleImport}
      />
    );

    expect(screen.getByText('Girokonto Real (DE12 3456 7890)')).toBeInTheDocument();
    expect(screen.getByText('Urlaubstopf Virtual (Virtuelles Unterkonto)')).toBeInTheDocument();
  });
});
