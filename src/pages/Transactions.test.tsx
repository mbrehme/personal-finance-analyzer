/**
 * @file Transactions.test.tsx
 * @description Unit-Tests für die Transactions Page.
 * @module pages/Transactions.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Transactions } from './Transactions';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('Transactions Page', () => {
  it('renders transactions page with filters, bucket options and import button', async () => {
    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    expect(await screen.findByPlaceholderText(/Volltextsuche/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Buchungen & Transaktionen/i })).toBeInTheDocument();
    expect(screen.getByText(/CSV Import/i)).toBeInTheDocument();
    expect(screen.getByText(/Filter & Suche/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter anwenden/i })).toBeInTheDocument();
  });
});
