/**
 * @file Balances.test.tsx
 * @description Unit-Tests für die Balances Page.
 * @module pages/Balances.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Balances } from './Balances';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('Balances Page', () => {
  it('renders balances page with account summaries', async () => {
    render(
      <FinanceProvider>
        <Balances />
      </FinanceProvider>
    );

    expect(await screen.findByText(/Kontestände & Saldenverlauf|Kontostände & Saldenverlauf/i)).toBeInTheDocument();
    expect(screen.getByText('Aktueller Gesamtsaldo')).toBeInTheDocument();
    expect(screen.getByText('Aktive Konten')).toBeInTheDocument();
  });
});
