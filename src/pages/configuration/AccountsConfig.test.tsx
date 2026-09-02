/**
 * @file AccountsConfig.test.tsx
 * @description Unit-Tests für die AccountsConfig Subpage.
 * @module pages/configuration/AccountsConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountsConfig } from './AccountsConfig';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('AccountsConfig Subpage', () => {
  it('renders managed accounts and drag handles', async () => {
    render(
      <FinanceProvider>
        <AccountsConfig />
      </FinanceProvider>
    );

    const title = await screen.findByText(/Verwaltete Konten/i);
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Neues Konto')).toBeInTheDocument();

    const dragHandles = screen.getAllByTitle('Ziehen zum Umsortieren');
    expect(dragHandles.length).toBeGreaterThan(0);
    expect(screen.getByText(/Stichtag:/i)).toBeInTheDocument();
  });
});

