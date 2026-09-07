/**
 * @file Transactions.test.tsx
 * @description Unit-Tests für die Transactions Page.
 * @module pages/Transactions.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Transactions } from './Transactions';
import { FinanceProvider } from '@/domain';

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

  it('does not render Neue Buchung button but renders origin filter and CSV import', async () => {
    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Wait for content to finish loading
    expect(await screen.findByText('CSV Import')).toBeInTheDocument();
    // Verify Neue Buchung button is NOT present (manual creation disabled)
    expect(screen.queryByRole('button', { name: /Neue Buchung/i })).not.toBeInTheDocument();
    expect(screen.getByText('Alle Quellen')).toBeInTheDocument();
  });

  it('filters transactions by origin (Overrides vs. Importiert)', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Girokonto', color: '#000', icon: 'Wallet' }] as any,
      categories: [] as any,
      buckets: [] as any,
      transactions: [
        {
          id: 'tx-imp',
          accountId: 'acc-1',
          valueDate: '2026-03-01',
          bookingDate: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Importierter Einkauf',
          type: 'outbound',
          iban: 'DE11',
          value: -45,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-man',
          accountId: 'acc-1',
          valueDate: '2026-03-02',
          bookingDate: '2026-03-02',
          issuer: 'Ich',
          receiver: 'Bäcker',
          subject: 'Manuelle Buchung',
          type: 'outbound',
          iban: '',
          value: -12,
          assignmentSource: 'manual',
          origin: 'manual',
        },
        {
          id: 'tx-overridden',
          accountId: 'acc-1',
          valueDate: '2026-03-03',
          bookingDate: '2026-03-03',
          issuer: 'Tankstelle',
          receiver: 'Ich',
          subject: 'Tanken angepasst',
          originalSubject: 'ARAL FILIALE 1234',
          type: 'outbound',
          iban: 'DE22',
          value: -80,
          originalValue: -80,
          assignmentSource: 'unassigned',
          origin: 'imported',
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

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initially both transactions are rendered
    expect(await screen.findByText('Importierter Einkauf')).toBeInTheDocument();
    expect(screen.getByText('Manuelle Buchung')).toBeInTheDocument();

    // Select "Overrides"
    const selects = screen.getAllByRole('combobox');
    // Origin select has options: Herkunft: Alle, Importiert, Splits, Overrides
    const originSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'imported')
    ) as HTMLSelectElement;
    expect(originSelect).toBeDefined();

    await user.selectOptions(originSelect, 'override');
    const applyBtn = screen.getByRole('button', { name: /Filter anwenden/i });
    await user.click(applyBtn);

    // Under "Overrides": both manual booking and overridden bank booking are visible
    expect(screen.getByText('Manuelle Buchung')).toBeInTheDocument();
    expect(screen.getByText('Tanken angepasst')).toBeInTheDocument();
    expect(screen.getAllByText('Geändert').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Importierter Einkauf')).not.toBeInTheDocument();

    // Now select "Bank-Import"
    await user.selectOptions(originSelect, 'imported');
    await user.click(applyBtn);

    // Only untouched bank imports are visible, overrides and manual bookings are hidden
    expect(screen.getByText('Importierter Einkauf')).toBeInTheDocument();
    expect(screen.queryByText('Tanken angepasst')).not.toBeInTheDocument();
    expect(screen.queryByText('Manuelle Buchung')).not.toBeInTheDocument();
  });

  it('filters transactions using the hierarchical CategoryFilterDropdown', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Girokonto', color: '#000', icon: 'Wallet' }] as any,
      categories: [
        { id: 'cat-food', name: 'Lebensmittel', parentId: null, color: '#f59e0b' },
        { id: 'cat-rent', name: 'Miete', parentId: null, color: '#3b82f6' },
      ] as any,
      buckets: [] as any,
      transactions: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          valueDate: '2026-03-01',
          bookingDate: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Wocheneinkauf',
          type: 'outbound',
          iban: 'DE11',
          value: -75,
          categoryId: 'cat-food',
          assignmentSource: 'manual',
          origin: 'imported',
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          valueDate: '2026-03-02',
          bookingDate: '2026-03-02',
          issuer: 'Vermieter',
          receiver: 'Ich',
          subject: 'Warmmiete',
          type: 'outbound',
          iban: 'DE22',
          value: -950,
          categoryId: 'cat-rent',
          assignmentSource: 'manual',
          origin: 'imported',
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

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Anfangs sind beide Buchungen sichtbar
    expect(await screen.findByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Warmmiete')).toBeInTheDocument();

    // Kategorie-Filter öffnen
    const catDropdownBtn = screen.getByTestId('category-filter-dropdown-btn');
    await user.click(catDropdownBtn);

    // "Keine" auswählen (alle abwählen)
    const noneBtn = screen.getByRole('button', { name: 'Keine' });
    await user.click(noneBtn);

    // Keine Buchungen mehr sichtbar
    expect(screen.queryByText('Wocheneinkauf')).not.toBeInTheDocument();
    expect(screen.queryByText('Warmmiete')).not.toBeInTheDocument();

    // Nur "Lebensmittel" anwählen
    const panel = screen.getByTestId('category-filter-dropdown-panel');
    const foodOption = panel.querySelector('button[type="button"] span.truncate');
    expect(foodOption).toBeDefined();
    await user.click(screen.getByRole('button', { name: /Lebensmittel/i }));

    // Wocheneinkauf sichtbar, Warmmiete nicht sichtbar
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.queryByText('Warmmiete')).not.toBeInTheDocument();

    // "Alle" auswählen
    const allBtn = screen.getByRole('button', { name: 'Alle' });
    await user.click(allBtn);

    // Beide Buchungen wieder sichtbar
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Warmmiete')).toBeInTheDocument();
  });

  it('renders "Geändert" badge only for modified columns when only date is changed', async () => {
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [{ id: 'acc-1', name: 'Haupt-Girokonto', color: '#000', icon: 'Wallet' }] as any,
      categories: [
        { id: 'cat-salary', name: 'Einnahmen > Martin', parentId: null, color: '#10b981' },
      ] as any,
      buckets: [] as any,
      transactions: [
        {
          id: 'tx-salary-1',
          accountId: 'acc-1',
          valueDate: '2026-05-30', // Geändert von 2026-05-01
          bookingDate: '2026-05-01',
          originalValueDate: '2026-05-01',
          originalAccountId: 'acc-1',
          originalValue: 6650.62,
          originalSubject: 'Lohn - Gehalt Abrechnung 05/2026',
          originalReceiver: 'Brehme Martin',
          originalIssuer: '',
          receiver: 'Brehme Martin',
          issuer: '',
          subject: 'Lohn - Gehalt Abrechnung 05/2026',
          type: 'inbound',
          iban: '',
          value: 6650.62,
          categoryId: 'cat-salary',
          assignmentSource: 'auto_regex',
          origin: 'imported',
          rawFingerprint: 'fp-1',
        },
      ] as any,
      deletedTransactions: [],
      deleteTransaction: vi.fn(),
      restoreTransaction: vi.fn(),
      permanentlyDeleteTransaction: vi.fn(),
      assignTransactionCategory: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      resetTransactionToOriginal: vi.fn(),
      loading: false,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Es darf genau 1 "Geändert"-Badge geben (nur beim Datum 30.05.2026)
    const badges = await screen.findAllByText('Geändert');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('td')).toHaveTextContent('30.05.2026');
  });

  it('renders multiple accounts for transfers between real accounts and virtual subaccounts', async () => {
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro',
          name: 'Haupt-Girokonto',
          accountType: 'real',
          iban: 'DE1111',
          color: '#3b82f6',
          icon: 'Landmark',
          balanceEntries: [],
        },
        {
          id: 'acc-tagesgeld',
          name: 'Tagesgeldkonto',
          accountType: 'real',
          iban: 'DE2222',
          color: '#10b981',
          icon: 'Landmark',
          balanceEntries: [],
        },
        {
          id: 'acc-sub-urlaub',
          name: 'Urlaubstopf',
          accountType: 'virtual',
          parentAccountId: 'acc-giro',
          categoryIds: ['cat-urlaub'],
          color: '#8b5cf6',
          icon: 'FolderTree',
          balanceEntries: [],
        },
      ] as any,
      categories: [
        { id: 'cat-urlaub', name: 'Urlaub & Reisen', parentId: null, color: '#f59e0b' },
      ] as any,
      buckets: [] as any,
      transactions: [
        // 1. Umbuchung von Girokonto auf Tagesgeld
        {
          id: 'tx-transfer-1',
          accountId: 'acc-giro',
          valueDate: '2026-08-10',
          bookingDate: '2026-08-10',
          receiver: 'Tagesgeldkonto',
          issuer: 'Martin',
          subject: 'Umbuchung Tagesgeld Rücklage',
          type: 'outbound',
          iban: 'DE2222',
          value: -500,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
        // 2. Buchung auf Girokonto, die auch zum virtuellen Unterkonto Urlaubstopf gehört
        {
          id: 'tx-vacation-1',
          accountId: 'acc-giro',
          valueDate: '2026-08-15',
          bookingDate: '2026-08-15',
          receiver: 'Lufthansa',
          issuer: 'Martin',
          subject: 'Flug nach Mallorca',
          type: 'outbound',
          iban: 'DE9999',
          value: -350,
          categoryId: 'cat-urlaub',
          assignmentSource: 'auto_regex',
        },
      ] as any,
      deletedTransactions: [],
      deleteTransaction: vi.fn(),
      restoreTransaction: vi.fn(),
      permanentlyDeleteTransaction: vi.fn(),
      assignTransactionCategory: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      splitTransaction: vi.fn(),
      resetTransactionToOriginal: vi.fn(),
      loading: false,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Prüfe, dass die Umbuchung beide echten Konten als Badges anzeigt (Tagesgeldkonto als Empfänger und als Gegenkonto)
    expect(screen.getAllByText('Tagesgeldkonto').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Haupt-Girokonto').length).toBeGreaterThanOrEqual(1);
    // In der Tabellenansicht werden keine IBANs als Text gerendert (nur im Detail-Dialog)
    expect(screen.queryByText('DE1111')).not.toBeInTheDocument();
    expect(screen.queryByText('DE2222')).not.toBeInTheDocument();
    // Prüfe, dass das virtuelle Unterkonto angezeigt wird
    expect(screen.getByText('Urlaubstopf')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('opens transaction detail modal with compound search string when clicking a row', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro',
          name: 'Haupt-Girokonto',
          accountType: 'real',
          iban: 'DE44500105175407324900',
          balanceEntries: [],
        },
      ] as any,
      categories: [
        {
          id: 'cat-reisen',
          name: 'Reisen & Flug',
          parentId: null,
        },
      ] as any,
      transactions: [
        {
          id: 'tx-flight-detail',
          accountIban: 'DE44500105175407324900',
          valueDate: '2026-08-20',
          bookingDate: '2026-08-20',
          receiver: 'Eurowings',
          issuer: 'Martin',
          subject: 'Flugurlaub Sommer',
          iban: 'DE5544332211',
          value: -280,
          categoryId: 'cat-reisen',
          assignmentSource: 'auto_regex',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      deleteTransaction: vi.fn(),
      loading: false,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Buchung ist in der Tabelle sichtbar
    const rowText = await screen.findByText('Flugurlaub Sommer');
    expect(rowText).toBeInTheDocument();

    // Klick auf die Buchungszeile
    await user.click(rowText);

    // Detail-Modal öffnet sich
    expect(screen.getByText('Buchungsdetails')).toBeInTheDocument();
    expect(screen.getByText('ID: tx-flight-detail')).toBeInTheDocument();

    // Suchstring ist sichtbar
    expect(
      screen.getByText('[Ausgang] Eurowings: Flugurlaub Sommer (DE5544332211)')
    ).toBeInTheDocument();

    // Schließen
    const closeButtons = screen.getAllByRole('button', { name: 'Schließen' });
    await user.click(closeButtons[0]);

    expect(screen.queryByText('Buchungsdetails')).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
