/**
 * @file Cashflow.test.tsx
 * @description Unit-Tests für die Cashflow Page.
 * @module pages/Cashflow.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Cashflow } from './Cashflow';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('Cashflow Page', () => {
  it('renders cashflow page with KPIs and granularity switcher', async () => {
    render(
      <FinanceProvider>
        <Cashflow />
      </FinanceProvider>
    );

    expect(await screen.findByText('Cashflow Matrix')).toBeInTheDocument();
    expect(screen.getByText('Gesamt Einnahmen')).toBeInTheDocument();
    expect(screen.getByText('Gesamt Ausgaben')).toBeInTheDocument();
    expect(screen.getByText('Netto Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Monatlich')).toBeInTheDocument();
  });
});
