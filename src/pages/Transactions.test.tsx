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
  it('renders transactions page with filters and import button', async () => {
    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    expect(await screen.findByText(/Buchungen & Transaktionen/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Volltextsuche/i)).toBeInTheDocument();
    expect(screen.getByText(/CSV Import/i)).toBeInTheDocument();
  });
});
