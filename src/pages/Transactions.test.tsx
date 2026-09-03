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
  it('renders transactions page with filters, category options and import button', async () => {
    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    expect(await screen.findByPlaceholderText(/Volltextsuche/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Buchungen & Transaktionen/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/CSV Import/i)).toBeInTheDocument();
    expect(screen.getByText(/Filter & Suche/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter anwenden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zeitraum auswählen/i })).toBeInTheDocument();
    expect(screen.getByText('Gesamter Zeitraum')).toBeInTheDocument();
  });

  it('allows opening the date range picker and selecting a preset', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    const datePickerBtn = await screen.findByRole('button', { name: /Zeitraum auswählen/i });
    await user.click(datePickerBtn);

    expect(screen.getByText('Zeitraum wählen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dieses Jahr' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dieses Jahr' }));
    expect(screen.getByText(/Dieses Jahr/i)).toBeInTheDocument();

    // Filter erst anwenden, wenn der Button geklickt wird
    const applyBtn = screen.getByRole('button', { name: /Filter anwenden/i });
    await user.click(applyBtn);
  });
});
