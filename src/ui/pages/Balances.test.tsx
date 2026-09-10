/**
 * @file Balances.test.tsx
 * @description Unit-Tests für die Balances Page.
 * @module pages/Balances.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Balances } from './Balances';
import { FinanceProvider } from '@/domain';
import * as FinanceContextModule from '@/domain';
import { AnalyticsContext, AnalyticsLayout } from '@/ui/pages/analytics';

describe('Balances Page', () => {
  it('renders balances page with account summaries', async () => {
    render(
      <FinanceProvider>
        <Balances />
      </FinanceProvider>
    );

    expect(await screen.findByText('Aktueller Gesamtsaldo')).toBeInTheDocument();
    expect(screen.getByText('Aktive Konten')).toBeInTheDocument();
    expect(screen.getByText('Stichtags-Salden')).toBeInTheDocument();
  });

  it('renders real account and virtual subaccount with Virtuell badge', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-real-1',
          name: 'Girokonto Real',
          accountType: 'real',
          iban: 'DE1234567890',
          balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
        },
        {
          id: 'acc-virt-1',
          name: 'Urlaubstopf Virtual',
          accountType: 'virtual',
          parentAccountId: 'acc-real-1',
          categoryIds: ['cat-vacation'],
          balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 200 }],
        },
      ],
      transactions: [],
      categories: [],
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
      assignTransactionCategoryBatch: vi.fn(),
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

    render(<Balances />);

    expect(screen.getByText('Girokonto Real')).toBeInTheDocument();
    expect(screen.getByText('Urlaubstopf Virtual')).toBeInTheDocument();
    expect(screen.getByText('Virtuell')).toBeInTheDocument();

    // Verify sticky Konto column header and cell
    const kontoHeader = screen.getByRole('columnheader', { name: 'Konto' });
    expect(kontoHeader.className).toContain('sticky');
    expect(kontoHeader.className).toContain('left-0');

    const giroCell = screen.getByText('Girokonto Real').closest('td');
    expect(giroCell?.className).toContain('sticky');
    expect(giroCell?.className).toContain('left-0');

    // "Aktueller Stand" Spalte existiert nicht mehr
    expect(screen.queryByText('Aktueller Stand')).not.toBeInTheDocument();

    // Verify current period header and badge
    expect(screen.getByTestId('current-period-header')).toBeInTheDocument();
    expect(screen.getByText('Aktuell')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('applies open-ended startDate filter correctly in UI', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-real-1',
          name: 'Girokonto Real',
          accountType: 'real',
          iban: 'DE1234567890',
          balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
        },
      ],
      transactions: [
        {
          id: 'tx-old',
          date: '2026-07-15',
          issuer: 'Old',
          receiver: 'Me',
          subject: 'Old tx',
          type: 'inbound',
          receiverIban: 'DE1234567890',
          value: 500,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
        {
          id: 'tx-new',
          date: '2026-09-10',
          issuer: 'New',
          receiver: 'Me',
          subject: 'New tx',
          type: 'inbound',
          receiverIban: 'DE1234567890',
          value: 200,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
      ],
      categories: [],
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
      assignTransactionCategoryBatch: vi.fn(),
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

    render(
      <AnalyticsContext.Provider
        value={{
          selectedAccountId: null,
          setSelectedAccountId: vi.fn(),
          granularity: 'monthly',
          setGranularity: vi.fn(),
          startDate: '2026-09-01',
          endDate: null,
          setDateRange: vi.fn(),
          selectedCategoryIds: null,
          setSelectedCategoryIds: vi.fn(),
        }}
      >
        <Balances />
      </AnalyticsContext.Provider>
    );

    // July 2026 and August 2026 must be excluded
    expect(screen.queryByText('Jul 2026')).not.toBeInTheDocument();
    expect(screen.queryByText('Aug 2026')).not.toBeInTheDocument();
    // September 2026 must be rendered
    expect(screen.getByText('Sep 2026')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  describe('Balances Table Deep Links', () => {
    const LocationWatcher: React.FC = () => {
      const location = useLocation();
      return <div data-testid="test-location">{location.pathname + location.search}</div>;
    };

    it('navigates to /transactions with account and date range on cell click', async () => {
      const user = userEvent.setup();
      vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
        accounts: [
          {
            id: 'acc-giro',
            name: 'Girokonto',
            accountType: 'real',
            iban: 'DE1234567890',
            balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
          },
        ] as any,
        transactions: [
          {
            id: 'tx-1',
            date: '2026-08-15',
            receiverIban: 'DE1234567890',
            value: 200,
          },
        ] as any,
        categories: [],
        loading: false,
        error: null,
      } as any);

      render(
        <MemoryRouter
          initialEntries={['/analytics/balances']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="balances" element={<Balances />} />
            </Route>
            <Route path="/transactions" element={<div>Transactions</div>} />
          </Routes>
          <LocationWatcher />
        </MemoryRouter>
      );

      const cell = await screen.findByTitle(
        'Buchungen für "Girokonto" im Zeitraum Aug 2026 anzeigen'
      );
      expect(cell).toBeInTheDocument();

      await user.click(cell);

      expect(screen.getByTestId('test-location')).toHaveTextContent(
        '/transactions?account=acc-giro&startDate=2026-08-01&endDate=2026-08-31'
      );

      vi.restoreAllMocks();
    });

    it('navigates to /transactions on keyboard Enter on cell', async () => {
      const user = userEvent.setup();
      vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
        accounts: [
          {
            id: 'acc-giro',
            name: 'Girokonto',
            accountType: 'real',
            iban: 'DE1234567890',
            balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
          },
        ] as any,
        transactions: [
          {
            id: 'tx-1',
            date: '2026-08-15',
            receiverIban: 'DE1234567890',
            value: 200,
          },
        ] as any,
        categories: [],
        loading: false,
        error: null,
      } as any);

      render(
        <MemoryRouter
          initialEntries={['/analytics/balances']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="balances" element={<Balances />} />
            </Route>
            <Route path="/transactions" element={<div>Transactions</div>} />
          </Routes>
          <LocationWatcher />
        </MemoryRouter>
      );

      const cell = await screen.findByTitle(
        'Buchungen für "Girokonto" im Zeitraum Aug 2026 anzeigen'
      );
      cell.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('test-location')).toHaveTextContent(
        '/transactions?account=acc-giro&startDate=2026-08-01&endDate=2026-08-31'
      );

      vi.restoreAllMocks();
    });

    it('navigates to /transactions on total row cell click', async () => {
      const user = userEvent.setup();
      vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
        accounts: [
          {
            id: 'acc-giro',
            name: 'Girokonto',
            accountType: 'real',
            iban: 'DE1234567890',
            balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
          },
        ] as any,
        transactions: [
          {
            id: 'tx-1',
            date: '2026-08-15',
            receiverIban: 'DE1234567890',
            value: 200,
          },
        ] as any,
        categories: [],
        loading: false,
        error: null,
      } as any);

      render(
        <MemoryRouter
          initialEntries={['/analytics/balances']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="balances" element={<Balances />} />
            </Route>
            <Route path="/transactions" element={<div>Transactions</div>} />
          </Routes>
          <LocationWatcher />
        </MemoryRouter>
      );

      const totalCell = await screen.findByTitle('Alle Buchungen im Zeitraum Aug 2026 anzeigen');
      expect(totalCell).toBeInTheDocument();

      await user.click(totalCell);

      expect(screen.getByTestId('test-location')).toHaveTextContent(
        '/transactions?startDate=2026-08-01&endDate=2026-08-31'
      );

      vi.restoreAllMocks();
    });
  });
});
