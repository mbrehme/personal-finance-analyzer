/**
 * @file Cashflow.test.tsx
 * @description Unit-Tests für die Cashflow Page.
 * @module pages/Cashflow.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Cashflow } from './Cashflow';
import { FinanceProvider } from '@/services/storage/FinanceContext';
import * as FinanceContextModule from '@/services/storage/FinanceContext';
import { getCurrentPeriodKey } from '@/utils/dateUtils';

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

  it('highlights the current period column and renders jump to today button', async () => {
    const currentMonthKey = getCurrentPeriodKey('monthly');
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Giro' }] as any,
      buckets: [{ id: 'b-1', name: 'Lebensmittel', parentId: null }] as any,
      transactions: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          valueDate: `${currentMonthKey}-01`,
          bookingDate: `${currentMonthKey}-01`,
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf',
          type: 'outbound',
          iban: 'DE00',
          value: -50,
          bucketId: 'b-1',
          assignmentSource: 'auto_regex',
        },
      ] as any,
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
      addBucket: vi.fn(),
      updateBucket: vi.fn(),
      deleteBucket: vi.fn(),
      reorderBuckets: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      reorderAccounts: vi.fn(),
      addBalanceEntry: vi.fn(),
      deleteBalanceEntry: vi.fn(),
      importTransactions: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    });

    render(<Cashflow />);

    expect(screen.getByTestId('current-period-header')).toBeInTheDocument();
    expect(screen.getByText('Aktuell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Heute/i })).toBeInTheDocument();
  });
});
