/**
 * @file Cashflow.test.tsx
 * @description Unit-Tests für die Cashflow Page.
 * @module pages/Cashflow.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  Cashflow,
  CASHFLOW_ACCOUNT_FILTER_KEY,
  CASHFLOW_GRANULARITY_KEY,
  CASHFLOW_START_DATE_KEY,
  CASHFLOW_END_DATE_KEY,
} from './Cashflow';
import { AnalyticsLayout } from '@/ui/pages/analytics';
import { FinanceProvider } from '@/services/storage/FinanceContext';
import * as FinanceContextModule from '@/services/storage/FinanceContext';
import { getCurrentPeriodKey } from '@/utils/dateUtils';

const renderInAnalytics = (ui: React.ReactElement = <Cashflow />) => {
  return render(
    <MemoryRouter
      initialEntries={['/analytics/cashflow']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
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
      <MemoryRouter
        initialEntries={['/analytics/cashflow']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
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
      categories: [{ id: 'b-1', name: 'Lebensmittel', parentId: null }] as any,
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
      autoReprogress: true,
      setAutoReprogress: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
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
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      importTransactions: vi.fn(),
      assignTransactionCategory: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      resetTransaction: vi.fn(),
      deletedTransactions: [],
      restoreTransaction: vi.fn(),
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
      categories: [{ id: 'b-1', name: 'Lebensmittel', parentId: null }] as any,
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
      autoReprogress: true,
      setAutoReprogress: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
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
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      importTransactions: vi.fn(),
      assignTransactionCategory: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      resetTransaction: vi.fn(),
      deletedTransactions: [],
      restoreTransaction: vi.fn(),
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
      categories: [] as any,
      buckets: [] as any,
      transactions: [] as any,
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
      autoReprogress: true,
      setAutoReprogress: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
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
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      importTransactions: vi.fn(),
      assignTransactionCategory: vi.fn(),
      assignTransactionBucket: vi.fn(),
      deleteTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      resetTransaction: vi.fn(),
      deletedTransactions: [],
      restoreTransaction: vi.fn(),
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

  it('renders uncategorized row as second to last row before total row', async () => {
    const currentMonthKey = getCurrentPeriodKey('monthly');
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Giro' }] as any,
      categories: [{ id: 'cat-1', name: 'Lebensmittel', parentId: null }] as any,
      buckets: [{ id: 'cat-1', name: 'Lebensmittel', parentId: null }] as any,
      transactions: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          valueDate: `${currentMonthKey}-05`,
          bookingDate: `${currentMonthKey}-05`,
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf',
          type: 'outbound',
          iban: 'DE00',
          value: -50,
          categoryId: 'cat-1',
          assignmentSource: 'manual',
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          valueDate: `${currentMonthKey}-10`,
          bookingDate: `${currentMonthKey}-10`,
          issuer: 'Unbekannt',
          receiver: 'Ich',
          subject: 'Ohne Kategorie',
          type: 'outbound',
          iban: 'DE00',
          value: -35,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
      ] as any,
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
      addBucket: vi.fn(),
      updateBucket: vi.fn(),
      deleteBucket: vi.fn(),
      reorderBuckets: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      importTransactions: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      resetTransaction: vi.fn(),
      deletedTransactions: [],
      restoreTransaction: vi.fn(),
      clearTransactions: vi.fn(),
      triggerReMatch: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    } as any);

    renderInAnalytics();

    // Lebensmittel-Kategorie in Tabelle vorhanden
    const table = screen.getByRole('table');
    expect(within(table).getByText('Lebensmittel')).toBeInTheDocument();

    // Vorletzte Zeile: Nicht kategorisiert
    const uncatRow = screen.getByTestId('cashflow-uncategorized-row');
    expect(uncatRow).toBeInTheDocument();
    expect(uncatRow).toHaveTextContent('Nicht kategorisiert');
    expect(uncatRow).toHaveTextContent('-35,00 €');

    // Gesamtergebnis-Zeile (letzte Zeile)
    expect(screen.getByText('Netto-Gesamtergebnis')).toBeInTheDocument();
  });

  it('renders stacked category bar chart above the matrix table', () => {
    renderInAnalytics();
    expect(screen.getByTestId('stacked-category-barchart')).toBeInTheDocument();
    expect(screen.getByText('Cashflow & Ø Verteilung nach Kategorien')).toBeInTheDocument();
  });

  it('allows filtering categories via category filter dropdown and updates matrix table', async () => {
    const user = userEvent.setup();
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Giro' }] as any,
      categories: [
        { id: 'cat-1', name: 'Lebensmittel', parentId: null },
        { id: 'cat-2', name: 'Wohnen', parentId: null },
      ] as any,
      buckets: [
        { id: 'cat-1', name: 'Lebensmittel', parentId: null },
        { id: 'cat-2', name: 'Wohnen', parentId: null },
      ] as any,
      transactions: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          valueDate: '2026-01-15',
          bookingDate: '2026-01-15',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf',
          type: 'outbound',
          iban: 'DE00',
          value: -50,
          categoryId: 'cat-1',
          bucketId: 'cat-1',
          assignmentSource: 'auto_regex',
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          valueDate: '2026-01-10',
          bookingDate: '2026-01-10',
          issuer: 'Vermieter',
          receiver: 'Ich',
          subject: 'Miete',
          type: 'outbound',
          iban: 'DE00',
          value: -800,
          categoryId: 'cat-2',
          bucketId: 'cat-2',
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
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
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
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      importCsv: vi.fn(),
      reMatchAllTransactions: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    } as any);

    renderInAnalytics();

    // Beide Kategorien anfangs in der Tabelle sichtbar
    const initialTable = screen.getByRole('table');
    expect(within(initialTable).getByText('Lebensmittel')).toBeInTheDocument();
    expect(within(initialTable).getByText('Wohnen')).toBeInTheDocument();

    // Kategorie-Filter im Toolbar öffnen
    const filterBtn = screen.getByTestId('category-filter-dropdown-btn');
    await user.click(filterBtn);

    // "Wohnen" im Panel abwählen
    const panel = screen.getByTestId('category-filter-dropdown-panel');
    const wohnenOption = within(panel).getByRole('button', { name: /Wohnen/i });
    await user.click(wohnenOption);

    // "Wohnen" Zeile in der Matrix-Tabelle verschwindet
    const table = screen.getByRole('table');
    expect(within(table).queryByText('Wohnen')).not.toBeInTheDocument();
    // "Lebensmittel" bleibt sichtbar
    expect(within(table).getByText('Lebensmittel')).toBeInTheDocument();
  });

  it('allows switching between Kategorien and Konten view modes', async () => {
    const user = userEvent.setup();
    localStorage.clear();

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        { id: 'acc-1', name: 'Girokonto Hauptkonto', accountType: 'bank', color: '#3b82f6' },
        { id: 'acc-2', name: 'Tagesgeldkonto', accountType: 'bank', color: '#10b981' },
      ] as any,
      categories: [{ id: 'cat-1', name: 'Lebensmittel', parentId: null }] as any,
      buckets: [{ id: 'cat-1', name: 'Lebensmittel', parentId: null }] as any,
      transactions: [
        {
          id: 'tx-1',
          accountIban: 'DE1111',
          iban: 'DE1111',
          accountId: 'acc-1',
          valueDate: '2026-01-05',
          bookingDate: '2026-01-05',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf',
          type: 'outbound',
          value: -50,
          categoryId: 'cat-1',
          assignmentSource: 'manual',
        },
      ] as any,
      loading: false,
      error: null,
      reMatchStatus: 'has_progressed',
      setReMatchStatus: vi.fn(),
      needsReMatch: false,
      reMatching: false,
      setNeedsReMatch: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      reorderAccounts: vi.fn(),
      addBalanceEntry: vi.fn(),
      deleteBalanceEntry: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      importCsv: vi.fn(),
      reMatchAllTransactions: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      resetWorkspace: vi.fn(),
    } as any);

    renderInAnalytics();

    // Standardmäßig ist 'Kategorien' aktiv
    expect(screen.getByRole('button', { name: 'Kategorien' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konten' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Kategorie/i })).toBeInTheDocument();

    const initialTable = screen.getByRole('table');
    expect(within(initialTable).getByText('Lebensmittel')).toBeInTheDocument();
    expect(within(initialTable).queryByText('Girokonto Hauptkonto')).not.toBeInTheDocument();

    // Zu 'Konten' wechseln
    const accountsToggle = screen.getByRole('button', { name: 'Konten' });
    await user.click(accountsToggle);

    // Header wechselt zu 'Konto'
    expect(screen.getByRole('columnheader', { name: /Konto/i })).toBeInTheDocument();

    // Konten werden in der Tabelle angezeigt
    const accountTable = screen.getByRole('table');
    expect(within(accountTable).getByText('Girokonto Hauptkonto')).toBeInTheDocument();
    expect(within(accountTable).getByText('Tagesgeldkonto')).toBeInTheDocument();
    expect(within(accountTable).queryByText('Lebensmittel')).not.toBeInTheDocument();

    // Zurück zu 'Kategorien' wechseln
    const categoriesToggle = screen.getByRole('button', { name: 'Kategorien' });
    await user.click(categoriesToggle);

    expect(screen.getByRole('columnheader', { name: /Kategorie/i })).toBeInTheDocument();
    const categoriesTable = screen.getByRole('table');
    expect(within(categoriesTable).getByText('Lebensmittel')).toBeInTheDocument();
  });
});
