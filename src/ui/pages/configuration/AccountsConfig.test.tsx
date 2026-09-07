/**
 * @file AccountsConfig.test.tsx
 * @description Unit-Tests für die AccountsConfig Subpage.
 * @module pages/configuration/AccountsConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsConfig } from './AccountsConfig';
import { FinanceProvider } from '@/domain';

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

  it('renders real account with Bankkonto badge and Unterkonto quick action', async () => {
    render(
      <FinanceProvider>
        <AccountsConfig />
      </FinanceProvider>
    );

    await screen.findByText('Haupt-Girokonto');
    expect(screen.getByText('Bankkonto')).toBeInTheDocument();
    expect(screen.getByText('Unterkonto anlegen')).toBeInTheDocument();

    // Click on "Unterkonto anlegen"
    fireEvent.click(screen.getByText('Unterkonto anlegen'));

    // Verify modal is open and has preselected parent account
    expect(screen.getByText('Neues virtuelles Unterkonto anlegen')).toBeInTheDocument();
    expect(screen.getByText(/Übergeordnetes echtes Bankkonto/i)).toBeInTheDocument();
  });
});
