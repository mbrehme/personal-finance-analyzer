/**
 * @file Cashflow.test.tsx
 * @description Unit-Tests für die Cashflow Page.
 * @module pages/Cashflow.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Cashflow, CASHFLOW_ACCOUNT_FILTER_KEY, CASHFLOW_GRANULARITY_KEY } from './Cashflow';
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

  it('collapses past years by default and allows expanding on click', async () => {
    const user = userEvent.setup();
    const currentMonthKey = getCurrentPeriodKey('monthly');
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Giro' }] as any,
      buckets: [{ id: 'b-1', name: 'Lebensmittel', parentId: null }] as any,
      transactions: [
        {
          id: 'tx-old',
          accountId: 'acc-1',
          valueDate: '2023-05-15',
          bookingDate: '2023-05-15',
          issuer: 'Alt',
          receiver: 'Ich',
          subject: 'Alt',
          type: 'outbound',
          iban: 'DE00',
          value: -100,
          bucketId: 'b-1',
          assignmentSource: 'auto_regex',
        },
        {
          id: 'tx-now',
          accountId: 'acc-1',
          valueDate: `${currentMonthKey}-01`,
          bookingDate: `${currentMonthKey}-01`,
          issuer: 'Neu',
          receiver: 'Ich',
          subject: 'Neu',
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

    // 2023 sollte eingeklappt sein und "komprimiert" anzeigen
    const collapseBtn2023 = screen.getByRole('button', { name: /2023.*komprimiert/i });
    expect(collapseBtn2023).toBeInTheDocument();
    expect(screen.getByText('Jahressumme')).toBeInTheDocument();

    // Klick auf 2023, um es aufzuklappen
    await user.click(collapseBtn2023);

    // Jetzt sollte "Mai" für 2023-05 sichtbar sein
    expect(screen.getByText('Mai')).toBeInTheDocument();
  });

  it('persists and restores account filter and granularity to and from localStorage', async () => {
    const user = userEvent.setup();
    localStorage.setItem(CASHFLOW_ACCOUNT_FILTER_KEY, 'acc-persist');
    localStorage.setItem(CASHFLOW_GRANULARITY_KEY, 'quarterly');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        { id: 'acc-1', name: 'Giro' },
        { id: 'acc-persist', name: 'Sparkonto' },
      ] as any,
      buckets: [] as any,
      transactions: [] as any,
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

    const { unmount } = render(<Cashflow />);

    // Überprüfen, ob die aus localStorage geladenen Werte aktiv sind
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc-persist');

    // Anderes Konto auswählen
    await user.selectOptions(select, 'acc-1');
    expect(localStorage.getItem(CASHFLOW_ACCOUNT_FILTER_KEY)).toBe('acc-1');

    // Granularität auf 'Jährlich' umstellen
    await user.click(screen.getByRole('button', { name: 'Jährlich' }));
    expect(localStorage.getItem(CASHFLOW_GRANULARITY_KEY)).toBe('yearly');

    unmount();
  });
});
