/**
 * @file Cashflow.test.tsx
 * @description Unit-Tests für die Cashflow Page.
 * @module pages/Cashflow.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  Cashflow,
  CASHFLOW_ACCOUNT_FILTER_KEY,
  CASHFLOW_GRANULARITY_KEY,
  CASHFLOW_START_DATE_KEY,
  CASHFLOW_END_DATE_KEY,
} from './Cashflow';
import { AnalyticsLayout } from '@/pages/analytics';
import { FinanceProvider } from '@/services/storage/FinanceContext';
import * as FinanceContextModule from '@/services/storage/FinanceContext';
import { getCurrentPeriodKey } from '@/utils/dateUtils';

const renderInAnalytics = (ui: React.ReactElement = <Cashflow />) => {
  return render(
    <MemoryRouter initialEntries={['/analytics/cashflow']}>
      <Routes>
        <Route path="/analytics" element={<AnalyticsLayout />}>
          <Route path="cashflow" element={ui} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

const renderWithProvider = (ui: React.ReactElement = <Cashflow />) => {
  return render(
    <FinanceProvider>
      <MemoryRouter initialEntries={['/analytics/cashflow']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsLayout />}>
            <Route path="cashflow" element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>
    </FinanceProvider>
  );
};

describe('Cashflow Page', () => {
  it('renders cashflow page with KPIs and granularity switcher', async () => {
    renderWithProvider();

    expect(await screen.findByText('Gesamt Einnahmen')).toBeInTheDocument();
    expect(screen.getByText('Gesamt Ausgaben')).toBeInTheDocument();
    expect(screen.getByText('Netto Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Monatlich')).toBeInTheDocument();
    expect(screen.getByText('Ø')).toBeInTheDocument();
    expect(screen.getByText('pro Monat')).toBeInTheDocument();
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

    renderInAnalytics();

    expect(screen.getByTestId('current-period-header')).toBeInTheDocument();
    expect(screen.getByText('Aktuell')).toBeInTheDocument();
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

    renderInAnalytics();

    // 2023 sollte eingeklappt sein und die Jahressumme anzeigen
    const collapseBtn2023 = screen.getByRole('button', { name: /2023/i });
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

    const { unmount } = renderInAnalytics();

    // Überprüfen, ob die aus localStorage geladenen Werte aktiv sind
    const select = screen.getByTestId('analytics-account-select') as HTMLSelectElement;
    expect(select.value).toBe('acc-persist');

    // Anderes Konto auswählen
    await user.selectOptions(select, 'acc-1');
    expect(localStorage.getItem(CASHFLOW_ACCOUNT_FILTER_KEY)).toBe('acc-1');

    // Granularität auf 'Jährlich' umstellen
    await user.click(screen.getByRole('button', { name: 'Jährlich' }));
    expect(localStorage.getItem(CASHFLOW_GRANULARITY_KEY)).toBe('yearly');

    unmount();
  });

  it('allows filtering by date range via DateRangePicker and persists in localStorage', async () => {
    const user = userEvent.setup();
    localStorage.removeItem(CASHFLOW_START_DATE_KEY);
    localStorage.removeItem(CASHFLOW_END_DATE_KEY);

    render(
      <FinanceProvider>
        <Cashflow />
      </FinanceProvider>
    );
    renderWithProvider();

    const datePickerBtn = screen.getByRole('button', { name: /Zeitraum auswählen/i });
    expect(datePickerBtn).toBeInTheDocument();

    await user.click(datePickerBtn);
    expect(screen.getByText('Zeitraum wählen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dieses Jahr' }));
    expect(localStorage.getItem(CASHFLOW_START_DATE_KEY)).toBeTruthy();
    expect(localStorage.getItem(CASHFLOW_END_DATE_KEY)).toBeTruthy();
  });

  it('renders the period column when selecting a single month with no transactions', async () => {
    const user = userEvent.setup();
    localStorage.removeItem(CASHFLOW_START_DATE_KEY);
    localStorage.removeItem(CASHFLOW_END_DATE_KEY);

    renderWithProvider();

    const datePickerBtn = screen.getByRole('button', { name: /Zeitraum auswählen/i });
    await user.click(datePickerBtn);

    // Klick auf "Dieser Monat"
    await user.click(screen.getByRole('button', { name: 'Dieser Monat' }));

    // Die Monatsspalte muss in der Tabelle vorhanden sein
    expect(screen.getByTestId('current-period-header')).toBeInTheDocument();
    expect(screen.getByText('Aktuell')).toBeInTheDocument();
  });
});
