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
    expect(screen.queryByRole('button', { name: /Filter anwenden/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zeitraum auswählen/i })).toBeInTheDocument();
    expect(screen.getByText('Gesamter Zeitraum')).toBeInTheDocument();
  });

  it('allows opening the date range picker and selecting a preset, which filters directly', async () => {
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

    // Auswahl wendet Filter direkt an ohne separaten Anwenden-Knopf
    await user.click(screen.getByRole('button', { name: 'Dieses Jahr' }));
    expect(screen.getByText(/Dieses Jahr/i)).toBeInTheDocument();
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
      transactions: [
        {
          id: 'tx-imp',
          accountIban: 'DE1111',
          date: '2026-03-01',
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
          accountIban: 'DE1111',
          date: '2026-03-02',
          issuer: 'Ich',
          receiver: 'Bäcker',
          subject: 'Manuelle Buchung',
          type: 'outbound',
          iban: '',
          value: -12,
          assignmentSource: 'manual',
          origin: 'override',
        },
        {
          id: 'tx-overridden',
          accountIban: 'DE1111',
          date: '2026-03-03',
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
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initially both transactions are rendered
    expect(await screen.findByText('Importierter Einkauf')).toBeInTheDocument();
    expect(screen.getByText('Manuelle Buchung')).toBeInTheDocument();

    // Select "Overrides" directly filters
    const selects = screen.getAllByRole('combobox');
    // Origin select has options: Herkunft: Alle, Importiert, Splits, Overrides
    const originSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'imported')
    ) as HTMLSelectElement;
    expect(originSelect).toBeDefined();

    await user.selectOptions(originSelect, 'override');

    // Under "Overrides": both manual booking and overridden bank booking are visible immediately
    expect(screen.getByText('Manuelle Buchung')).toBeInTheDocument();
    expect(screen.getByText('Tanken angepasst')).toBeInTheDocument();
    expect(screen.getAllByText('Geändert').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Importierter Einkauf')).not.toBeInTheDocument();

    // Now select "Bank-Import" directly filters
    await user.selectOptions(originSelect, 'imported');

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
      transactions: [
        {
          id: 'tx-1',
          accountIban: 'DE1111',
          date: '2026-03-01',
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
          accountIban: 'DE1111',
          date: '2026-03-02',
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
      transactions: [
        {
          id: 'tx-salary-1',
          accountIban: 'DE1111',
          date: '2026-05-30', // Geändert von 2026-05-01
          originalDate: '2026-05-01',
          originalAccountIban: 'DE1111',
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
      transactions: [
        // 1. Umbuchung von Girokonto auf Tagesgeld
        {
          id: 'tx-transfer-1',
          senderIban: 'DE1111',
          receiverIban: 'DE2222',
          date: '2026-08-10',
          receiver: 'Tagesgeldkonto',
          issuer: 'Martin',
          subject: 'Umbuchung Tagesgeld Rücklage',
          type: 'outbound',
          value: -500,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
        // 2. Buchung auf Girokonto, die auch zum virtuellen Unterkonto Urlaubstopf gehört
        {
          id: 'tx-vacation-1',
          senderIban: 'DE1111',
          receiverIban: 'DE9999',
          date: '2026-08-15',
          receiver: 'Lufthansa',
          issuer: 'Martin',
          subject: 'Flug nach Mallorca',
          type: 'outbound',
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
          senderIban: 'DE44500105175407324900',
          receiverIban: 'DE5544332211',
          date: '2026-08-20',
          receiver: 'Eurowings',
          issuer: 'Martin',
          subject: 'Flugurlaub Sommer',
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

  it('filters transactions dynamically when selecting an account from the account dropdown', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro',
          name: 'Girokonto',
          iban: 'DE1111',
          color: '#000',
          icon: 'Wallet',
          accountType: 'real',
        },
        {
          id: 'acc-tagesgeld',
          name: 'Tagesgeld',
          iban: 'DE2222',
          color: '#111',
          icon: 'Wallet',
          accountType: 'real',
        },
      ] as any,
      categories: [] as any,
      transactions: [
        {
          id: 'tx-giro',
          senderIban: 'DE1111',
          receiverIban: 'DE999',
          date: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Giro Einkauf',
          type: 'outbound',
          value: -45,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-tg',
          senderIban: '',
          receiverIban: 'DE2222',
          date: '2026-03-02',
          issuer: 'Bank',
          receiver: 'Ich',
          subject: 'Zinsen Tagesgeld',
          type: 'inbound',
          value: 15,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      loading: false,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initially both transactions are visible
    expect(await screen.findByText('Giro Einkauf')).toBeInTheDocument();
    expect(screen.getByText('Zinsen Tagesgeld')).toBeInTheDocument();

    // Select "Tagesgeld" from the account dropdown
    const accountSelect = screen.getByLabelText(/Konto filtern/i);
    await user.selectOptions(accountSelect, 'acc-tagesgeld');

    // Only Tagesgeld transaction should remain, Giro should be filtered out
    expect(screen.getByText('Zinsen Tagesgeld')).toBeInTheDocument();
    expect(screen.queryByText('Giro Einkauf')).not.toBeInTheDocument();

    // Switch back to "Alle Konten"
    await user.selectOptions(accountSelect, 'all');
    expect(screen.getByText('Giro Einkauf')).toBeInTheDocument();
    expect(screen.getByText('Zinsen Tagesgeld')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('assigns transaction category directly via table row category picker', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    const assignCategoryMock = vi.fn();

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro',
          name: 'Girokonto',
          iban: 'DE1111',
          color: '#000',
          icon: 'Wallet',
          accountType: 'real',
        },
      ] as any,
      categories: [
        {
          id: 'cat-groceries',
          name: 'Lebensmittel',
          color: '#f59e0b',
          icon: 'Utensils',
          parentId: null,
        },
      ] as any,
      transactions: [
        {
          id: 'tx-1',
          accountIban: 'DE1111',
          date: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf',
          type: 'outbound',
          iban: 'DE999',
          value: -45,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategory: assignCategoryMock,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initial state: "(Keine Kategorie)"
    const rowPickerBtn = screen.getByTestId('tx-category-picker-tx-1');
    expect(rowPickerBtn).toBeInTheDocument();
    expect(rowPickerBtn).toHaveTextContent('(Keine Kategorie)');

    // Open row picker
    await user.click(rowPickerBtn);

    // Pick "Lebensmittel"
    const catBtn = screen.getByTitle('Kategorie "Lebensmittel" auswählen');
    await user.click(catBtn);

    expect(assignCategoryMock).toHaveBeenCalledWith('tx-1', 'cat-groceries');

    vi.restoreAllMocks();
  });

  it('supports bulk selection and batch category assignment', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    const assignBatchMock = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro',
          name: 'Girokonto',
          iban: 'DE1111',
          color: '#000',
          icon: 'Wallet',
          accountType: 'real',
        },
      ] as any,
      categories: [
        {
          id: 'cat-groceries',
          name: 'Lebensmittel',
          color: '#f59e0b',
          icon: 'Utensils',
          parentId: null,
        },
        {
          id: 'cat-housing',
          name: 'Wohnen',
          color: '#3b82f6',
          icon: 'Home',
          parentId: null,
        },
      ] as any,
      transactions: [
        {
          id: 'tx-1',
          accountIban: 'DE1111',
          date: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Einkauf 1',
          type: 'outbound',
          iban: 'DE999',
          value: -45,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-2',
          accountIban: 'DE1111',
          date: '2026-03-02',
          issuer: 'Discounter',
          receiver: 'Ich',
          subject: 'Einkauf 2',
          type: 'outbound',
          iban: 'DE888',
          value: -25,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-3',
          accountIban: 'DE1111',
          date: '2026-03-03',
          issuer: 'Baumarkt',
          receiver: 'Ich',
          subject: 'Einkauf 3',
          type: 'outbound',
          iban: 'DE777',
          value: -60,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: assignBatchMock,
      assignTransactionCategory: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initial state: bulk action bar is not rendered
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();

    // 1. Select single transaction via checkbox
    const cb1 = screen.getByTestId('tx-select-checkbox-tx-1');
    await user.click(cb1);

    // Floating bar appears with count 1
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(screen.getByText(/1 Buchung ausgewählt/i)).toBeInTheDocument();

    // 2. Select second transaction
    const cb2 = screen.getByTestId('tx-select-checkbox-tx-2');
    await user.click(cb2);

    expect(screen.getByText(/2 Buchungen ausgewählt/i)).toBeInTheDocument();

    // 3. Test Select All via header checkbox
    const selectAllCb = screen.getByRole('checkbox', {
      name: /Alle sichtbaren Buchungen auswählen/i,
    });
    // Header should be indeterminate since 2 of 3 are selected
    expect((selectAllCb as HTMLInputElement).indeterminate).toBe(true);

    // Click select all -> all 3 selected
    await user.click(selectAllCb);
    expect(screen.getByText(/3 Buchungen ausgewählt/i)).toBeInTheDocument();
    expect((selectAllCb as HTMLInputElement).checked).toBe(true);

    // 4. Cancel / Abbrechen button clears selection
    const cancelBtn = screen.getByRole('button', { name: 'Auswahl aufheben' });
    await user.click(cancelBtn);
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();

    // 5. Select tx-1 and tx-2 again, then assign category
    await user.click(cb1);
    await user.click(cb2);
    expect(screen.getByText(/2 Buchungen ausgewählt/i)).toBeInTheDocument();

    // Open bulk category picker
    const bulkPickerBtn = screen.getByTestId('bulk-category-picker');
    expect(bulkPickerBtn).toBeInTheDocument();
    await user.click(bulkPickerBtn);

    // Select "Lebensmittel"
    const catFoodBtn = screen.getByTitle('Kategorie "Lebensmittel" auswählen');
    await user.click(catFoodBtn);

    // Verify assignTransactionCategoryBatch called with tx-1 and tx-2
    expect(assignBatchMock).toHaveBeenCalledWith(
      expect.arrayContaining(['tx-1', 'tx-2']),
      'cat-groceries'
    );
    expect(assignBatchMock.mock.calls[0][0]).toHaveLength(2);

    vi.restoreAllMocks();
  });

  it('matchesSearch correctly matches compound key, formatted and raw amount, and category name', async () => {
    const { matchesSearch } = await import('./Transactions');
    const tx: any = {
      id: 'tx-reaktor',
      date: '2025-12-08',
      amount: 6943.75,
      value: -6943.75,
      senderIban: 'DE80120300001027106861',
      receiverIban: 'DE89120300001083850147',
      subject: 'Abschlusszahlung Reaktor Berlin',
      receiver: 'Denise Gül Brehme und Martin Brehme',
      categoryId: 'cat-reaktor',
    };

    const categoryMap = new Map([['cat-reaktor', 'Reaktor Berlin Kredit']]);

    // Match by subject
    expect(matchesSearch(tx, 'Abschlusszahlung', categoryMap)).toBe(true);
    expect(matchesSearch(tx, 'Reaktor', categoryMap)).toBe(true);

    // Match by amount (various notations: 6943, 6.943,75, 6943.75, -6943)
    expect(matchesSearch(tx, '6943', categoryMap)).toBe(true);
    expect(matchesSearch(tx, '6.943,75', categoryMap)).toBe(true);
    expect(matchesSearch(tx, '-6.943', categoryMap)).toBe(true);
    expect(matchesSearch(tx, '6943.75', categoryMap)).toBe(true);

    // Match by category name
    expect(matchesSearch(tx, 'Kredit', categoryMap)).toBe(true);

    // No match
    expect(matchesSearch(tx, 'Unbekannt', categoryMap)).toBe(false);
  });

  it('calculates and displays column sum, footer sum, and bulk selected sum', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        { id: 'acc-giro', name: 'Girokonto', iban: 'DE1111', color: '#000', icon: 'Wallet' },
      ] as any,
      categories: [] as any,
      transactions: [
        {
          id: 'tx-salary',
          accountIban: 'DE1111',
          date: '2026-03-01',
          issuer: 'Arbeitgeber',
          receiver: 'Ich',
          subject: 'Gehalt',
          type: 'inbound',
          iban: 'DE999',
          value: 3000,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-rent',
          accountIban: 'DE1111',
          date: '2026-03-02',
          issuer: 'Ich',
          receiver: 'Vermieter',
          subject: 'Miete',
          type: 'outbound',
          iban: 'DE888',
          value: -1000,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-food',
          accountIban: 'DE1111',
          date: '2026-03-03',
          issuer: 'Ich',
          receiver: 'Supermarkt',
          subject: 'Einkauf',
          type: 'outbound',
          iban: 'DE777',
          value: -200,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Total: 3000 - 1000 - 200 = 1800 -> +1.800,00 €
    const headerSum = screen.getByTestId('transactions-column-sum');
    expect(headerSum).toBeInTheDocument();
    expect(headerSum).toHaveTextContent('+1.800,00');

    const footerSum = screen.getByTestId('transactions-footer-total-sum');
    expect(footerSum).toBeInTheDocument();
    expect(footerSum).toHaveTextContent('+1.800,00');

    // Check footer breakdown
    expect(screen.getByText(/Summe \(3 Buchungen\)/i)).toBeInTheDocument();
    const breakdown = screen.getByTestId('transactions-footer-breakdown');
    expect(breakdown).toHaveTextContent('+3.000,00');
    expect(breakdown).toHaveTextContent('-1.200,00');

    // Select tx-rent (-1000) and tx-food (-200) -> selectedTotalSum = -1200
    const rentCb = screen.getByTestId('tx-select-checkbox-tx-rent');
    const foodCb = screen.getByTestId('tx-select-checkbox-tx-food');
    await user.click(rentCb);
    await user.click(foodCb);

    const bulkSelectedSum = screen.getByTestId('bulk-selected-sum');
    expect(bulkSelectedSum).toBeInTheDocument();
    expect(bulkSelectedSum).toHaveTextContent('-1.200,00');

    vi.restoreAllMocks();
  });

  it('requires Enter for full-text search while other filters apply directly without apply button', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        { id: 'acc-1', name: 'Girokonto', iban: 'DE1111', color: '#000', icon: 'Wallet' },
        { id: 'acc-2', name: 'Sparkonto', iban: 'DE2222', color: '#111', icon: 'PiggyBank' },
      ] as any,
      categories: [
        { id: 'cat-food', name: 'Lebensmittel', parentId: null, color: '#f00', icon: 'Apple' },
      ] as any,
      transactions: [
        {
          id: 'tx-1',
          senderIban: 'DE1111',
          receiverIban: 'DE999',
          date: '2026-03-01',
          issuer: 'Supermarkt',
          receiver: 'Ich',
          subject: 'Wocheneinkauf',
          type: 'outbound',
          value: -100,
          categoryId: 'cat-food',
          assignmentSource: 'manual',
          origin: 'imported',
        },
        {
          id: 'tx-2',
          senderIban: 'DE888',
          receiverIban: 'DE2222',
          date: '2026-03-02',
          issuer: 'Arbeitgeber',
          receiver: 'Ich',
          subject: 'Gehaltszahlung',
          type: 'inbound',
          value: 3000,
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Initial state: both transactions are shown
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    // Verify "Filter anwenden" button does NOT exist
    expect(screen.queryByRole('button', { name: /Filter anwenden/i })).not.toBeInTheDocument();

    // 1. Fulltext search: typing without Enter does NOT filter yet
    const searchInput = screen.getByPlaceholderText(/Volltextsuche/i);
    await user.type(searchInput, 'Wochen');

    // Both are still visible because Enter was not pressed
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    // Now press Enter -> filter is applied
    await user.keyboard('{Enter}');
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.queryByText('Gehaltszahlung')).not.toBeInTheDocument();

    // Clear search using clear button -> both visible again immediately
    const clearSearchBtn = screen.getByRole('button', { name: 'Suche leeren' });
    await user.click(clearSearchBtn);
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    // 2. Account filter: changes filter IMMEDIATELY without pressing Enter
    const accountSelect = screen.getByLabelText('Konto filtern');
    await user.selectOptions(accountSelect, 'acc-2');
    expect(screen.queryByText('Wocheneinkauf')).not.toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    // Switch back to Alle Konten
    await user.selectOptions(accountSelect, 'all');
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    // 3. Typ filter: changes filter IMMEDIATELY
    const typeSelect = screen.getByLabelText('Buchungstyp filtern');
    await user.selectOptions(typeSelect, 'inbound');
    expect(screen.queryByText('Wocheneinkauf')).not.toBeInTheDocument();
    expect(screen.getByText('Gehaltszahlung')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('displays Umbuchung badge and correct directional amount when filtering by virtual or real parent account', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    const giroAcc = {
      id: 'acc-giro',
      name: 'Haupt-Girokonto',
      iban: 'DE11112222',
      accountType: 'real',
      color: '#3b82f6',
      icon: 'Landmark',
      categoryIds: [],
    };
    const ruecklagenAcc = {
      id: 'acc-ruecklagen',
      name: 'Rücklagen',
      iban: 'DE22223333',
      accountType: 'real',
      color: '#10b981',
      icon: 'Landmark',
      categoryIds: [],
    };
    const urlaubVirtAcc = {
      id: 'acc-urlaub',
      name: 'Urlaub',
      accountType: 'virtual',
      parentAccountId: 'acc-ruecklagen',
      color: '#8b5cf6',
      icon: 'FolderTree',
      categoryIds: ['cat-urlaub'],
    };

    const transferTx = {
      id: 'tx-transfer-urlaub',
      date: '2026-07-06',
      senderIban: 'DE11112222',
      receiverIban: 'DE22223333',
      issuer: 'Martin',
      receiver: 'Umbuchung Urlaub',
      subject: 'Spartopf Sommer',
      value: -250,
      amount: 250,
      categoryId: 'cat-urlaub',
      type: 'outbound',
      origin: 'imported',
      assignmentSource: 'manual',
    };

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [giroAcc, ruecklagenAcc, urlaubVirtAcc] as any,
      categories: [{ id: 'cat-urlaub', name: 'Urlaub', color: '#8b5cf6', icon: 'Sun' }] as any,
      transactions: [transferTx] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // 1. Alle Konten: Transaktion sichtbar mit "Umbuchung" Badge und ungerichtetem Betrag
    expect(screen.getByText('Spartopf Sommer')).toBeInTheDocument();
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();
    expect(screen.getByText('250,00 €')).toBeInTheDocument();

    const accountSelect = screen.getByLabelText('Konto filtern');

    // 2. Filter auf virtuelles Unterkonto "Urlaub"
    await user.selectOptions(accountSelect, 'acc-urlaub');
    expect(screen.getByText('Spartopf Sommer')).toBeInTheDocument();
    // Umbuchung Badge muss AUCH mit Kontofilter sichtbar bleiben!
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();
    // Aus Sicht von Urlaub ist es ein Zugang (+250,00 €)
    expect(screen.getAllByText('+250,00 €').length).toBeGreaterThanOrEqual(1);

    // 3. Filter auf reales Hauptkonto "Rücklagen"
    await user.selectOptions(accountSelect, 'acc-ruecklagen');
    // Transaktion MUSS auch unter Rücklagen gefunden werden!
    expect(screen.getByText('Spartopf Sommer')).toBeInTheDocument();
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();
    // Aus Sicht des Rücklagenkontos ist es ein Zugang (+250,00 €)
    expect(screen.getAllByText('+250,00 €').length).toBeGreaterThanOrEqual(1);

    // 4. Filter auf Senderkonto "Haupt-Girokonto"
    await user.selectOptions(accountSelect, 'acc-giro');
    expect(screen.getByText('Spartopf Sommer')).toBeInTheDocument();
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();
    // Aus Sicht des Girokontos ist es ein Abgang (-250,00 €)
    expect(screen.getAllByText('-250,00 €').length).toBeGreaterThanOrEqual(1);

    vi.restoreAllMocks();
  });

  it('renders incoming transfer into virtual account with correct direction (from Hauptkonto to Rücklagen > Geschenke)', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    const giroAcc = {
      id: 'acc-giro',
      name: 'Haupt-Girokonto',
      iban: 'DE11112222',
      accountType: 'real',
      color: '#3b82f6',
      icon: 'Landmark',
      balanceEntries: [],
    };
    const ruecklagenAcc = {
      id: 'acc-ruecklagen',
      name: 'Rücklagen',
      iban: 'DE22223333',
      accountType: 'real',
      color: '#10b981',
      icon: 'PiggyBank',
      balanceEntries: [],
    };
    const geschenkeVirtAcc = {
      id: 'acc-geschenke',
      name: 'Geschenke',
      accountType: 'virtual',
      parentAccountId: 'acc-ruecklagen',
      categoryIds: ['cat-geschenke'],
      color: '#8b5cf6',
      icon: 'FolderTree',
      balanceEntries: [],
    };

    const incomingTransferTx = {
      id: 'tx-incoming-geschenke',
      date: '2026-09-07',
      senderIban: 'DE11112222',
      receiverIban: 'DE22223333',
      issuer: 'Denise und Martin',
      receiver: 'Denise und Martin',
      subject: 'Monatliche Rücklage Geschenke',
      value: 250,
      amount: 250,
      categoryId: 'cat-geschenke',
      type: 'inbound',
      origin: 'imported',
      assignmentSource: 'manual',
    };

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [giroAcc, ruecklagenAcc, geschenkeVirtAcc] as any,
      categories: [
        { id: 'cat-geschenke', name: 'Geschenke', color: '#8b5cf6', icon: 'Gift' },
      ] as any,
      transactions: [incomingTransferTx] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Umbuchung Badge muss sichtbar sein
    expect(screen.getByText('Monatliche Rücklage Geschenke')).toBeInTheDocument();
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();

    // Richtung im Kontofeld: Haupt-Girokonto als fromAccount, Geschenke als toAccount
    expect(screen.getByText('Haupt-Girokonto')).toBeInTheDocument();
    expect(screen.getAllByText('Geschenke').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTitle(/Nach: Geschenke/)).toBeInTheDocument();

    // Filtern auf das virtuelle Unterkonto
    const accountSelect = screen.getByLabelText('Konto filtern');
    await user.selectOptions(accountSelect, 'acc-geschenke');
    expect(screen.getByText('Monatliche Rücklage Geschenke')).toBeInTheDocument();
    expect(screen.getByText('Umbuchung')).toBeInTheDocument();
    expect(screen.getAllByText('+250,00 €').length).toBeGreaterThanOrEqual(1);

    vi.restoreAllMocks();
  });

  it('displays filtered account as primary with directional incoming arrow for transfers', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');

    const accounts = [
      {
        id: 'acc-giro-main',
        name: 'Haupt-Girokonto',
        accountType: 'real' as const,
        iban: 'DE89120300001083850147',
        balanceEntries: [],
      },
      {
        id: 'acc-ruecklagen',
        name: 'Rücklagen',
        accountType: 'real' as const,
        iban: 'DE80120300001027106861',
        balanceEntries: [],
      },
    ];

    // Transfer von Rücklagen nach Hauptkonto (aus Sicht Rücklagen Ausgang, aus Sicht Hauptkonto Eingang)
    const transferTx = {
      id: 'tx-transfer-1',
      senderIban: 'DE80120300001027106861',
      receiverIban: 'DE89120300001083850147',
      date: '2026-09-07',
      value: 500,
      subject: 'Rücklagenauflösung',
      receiver: 'Haupt-Girokonto',
      sender: 'Rücklagen',
      categoryId: null,
      assignmentSource: 'unassigned',
      origin: 'imported',
    };

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: accounts as any,
      categories: [] as any,
      transactions: [transferTx] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Auf Hauptkonto filtern
    const accountSelect = screen.getByLabelText('Konto filtern');
    await user.selectOptions(accountSelect, 'acc-giro-main');

    // Das gefilterte Hauptkonto muss vorhanden sein
    expect(screen.getByText('Haupt-Girokonto')).toBeInTheDocument();
    expect(screen.getAllByText('Rücklagen').length).toBeGreaterThanOrEqual(1);

    // Richtung im Kontofeld für Eingang von Rücklagen
    expect(screen.getByTitle('Umbuchungseingang von Rücklagen')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('renders revert action button when a category was manually assigned and triggers resetTransaction', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const FinanceContextModule = await import('@/domain');
    const mockReset = vi.fn();

    const manualTx = {
      id: 'tx-manual-cat-1',
      date: '2026-09-07',
      senderIban: 'DE89120300001083850147',
      value: 250,
      originalValue: 250,
      subject: 'Geschenke',
      receiver: 'Denise Gül Brehme',
      issuer: 'Denise Gül Brehme und Martin Brehme',
      categoryId: 'cat-geschenke',
      assignmentSource: 'manual',
      origin: 'imported',
    };

    const categories = [
      {
        id: 'cat-geschenke',
        name: 'Geschenke',
        color: '#3b82f6',
        icon: 'Gift',
        parentId: null,
      },
    ];

    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      accounts: [
        {
          id: 'acc-giro-main',
          name: 'Haupt-Girokonto',
          accountType: 'real',
          iban: 'DE89120300001083850147',
          balanceEntries: [],
        },
      ] as any,
      categories: categories as any,
      transactions: [manualTx] as any,
      deletedTransactions: [],
      loading: false,
      assignTransactionCategoryBatch: vi.fn(),
      assignTransactionCategory: vi.fn(),
      deleteTransaction: vi.fn(),
      resetTransaction: mockReset,
    } as any);

    render(
      <FinanceProvider>
        <Transactions />
      </FinanceProvider>
    );

    // Sowohl der Button in den Zeilen-Aktionen als auch das Klick-Icon an der Kategorie müssen vorhanden sein
    const rowResetBtn = screen.getByRole('button', { name: 'Transaktion zurücksetzen' });
    expect(rowResetBtn).toBeInTheDocument();

    const catResetBtn = screen.getByRole('button', {
      name: 'Kategorie auf automatische Erkennung zurücksetzen',
    });
    expect(catResetBtn).toBeInTheDocument();

    // Klick auf den Reset-Button ruft resetTransaction auf
    await user.click(rowResetBtn);
    expect(mockReset).toHaveBeenCalledWith('tx-manual-cat-1');

    await user.click(catResetBtn);
    expect(mockReset).toHaveBeenCalledWith('tx-manual-cat-1');

    vi.restoreAllMocks();
  });

  describe('URL Query Parameter Filter Synchronization', () => {
    it('correctly parses search params with aliases and defaults', async () => {
      const { parseTransactionFiltersFromParams, serializeTransactionFiltersToParams } =
        await import('./Transactions');

      const params = new URLSearchParams(
        'category=__uncategorized__&startDate=2024-04-01&endDate=2024-04-30&search=Lufthansa&account=acc-1&type=outbound&origin=imported'
      );
      const parsed = parseTransactionFiltersFromParams(params);

      expect(parsed.categoryIds).toEqual(['__uncategorized__']);
      expect(parsed.startDate).toBe('2024-04-01');
      expect(parsed.endDate).toBe('2024-04-30');
      expect(parsed.searchTerm).toBe('Lufthansa');
      expect(parsed.accountId).toBe('acc-1');
      expect(parsed.type).toBe('outbound');
      expect(parsed.origin).toBe('imported');

      // Serializing back produces identical clean params
      const serialized = serializeTransactionFiltersToParams(parsed);
      expect(serialized.get('category')).toBe('__uncategorized__');
      expect(serialized.get('startDate')).toBe('2024-04-01');
      expect(serialized.get('endDate')).toBe('2024-04-30');
      expect(serialized.get('search')).toBe('Lufthansa');
      expect(serialized.get('account')).toBe('acc-1');
      expect(serialized.get('type')).toBe('outbound');
      expect(serialized.get('origin')).toBe('imported');
    });

    it('supports alias parameters (q, categories, from, to)', async () => {
      const { parseTransactionFiltersFromParams } = await import('./Transactions');

      const params = new URLSearchParams(
        'q=Einkauf&categories=cat-1,cat-2&from=2024-05-01&to=2024-05-31&accountId=acc-2'
      );
      const parsed = parseTransactionFiltersFromParams(params);

      expect(parsed.searchTerm).toBe('Einkauf');
      expect(parsed.categoryIds).toEqual(['cat-1', 'cat-2']);
      expect(parsed.startDate).toBe('2024-05-01');
      expect(parsed.endDate).toBe('2024-05-31');
      expect(parsed.accountId).toBe('acc-2');
    });

    it('initializes filters from URL deep link and updates URL when filter changes', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const { MemoryRouter, useLocation } = await import('react-router-dom');
      const user = userEvent.setup();
      const FinanceContextModule = await import('@/domain');

      const testTransactions = [
        {
          id: 'tx-match',
          date: '2024-04-15',
          value: -50,
          subject: 'Unkategorisiert April',
          receiver: 'Supermarkt',
          issuer: '',
          senderIban: 'DE11',
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
        {
          id: 'tx-wrong-cat',
          date: '2024-04-20',
          value: -100,
          subject: 'Kategorisiert April',
          receiver: 'Bäcker',
          issuer: '',
          senderIban: 'DE11',
          categoryId: 'cat-essen',
          assignmentSource: 'auto_regex',
          origin: 'imported',
        },
        {
          id: 'tx-wrong-date',
          date: '2024-05-10',
          value: -30,
          subject: 'Unkategorisiert Mai',
          receiver: 'Kiosk',
          issuer: '',
          senderIban: 'DE11',
          categoryId: null,
          assignmentSource: 'unassigned',
          origin: 'imported',
        },
      ];

      const testAccounts = [
        {
          id: 'acc-giro',
          name: 'Girokonto',
          accountType: 'real',
          iban: 'DE11',
          balanceEntries: [],
        },
      ];

      const testCategories = [
        {
          id: 'cat-essen',
          name: 'Lebensmittel',
          color: '#10b981',
          icon: 'Utensils',
          parentId: null,
        },
      ];

      vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
        accounts: testAccounts as any,
        categories: testCategories as any,
        transactions: testTransactions as any,
        deletedTransactions: [],
        loading: false,
        assignTransactionCategoryBatch: vi.fn(),
        assignTransactionCategory: vi.fn(),
        deleteTransaction: vi.fn(),
        resetTransaction: vi.fn(),
      } as any);

      let currentSearch = '';
      const LocationWatcher = () => {
        const location = useLocation();
        currentSearch = location.search;
        return null;
      };

      // Tiefenlink mit Uncategorized im April 2024
      render(
        <MemoryRouter
          initialEntries={[
            '/transactions?category=__uncategorized__&startDate=2024-04-01&endDate=2024-04-30',
          ]}
        >
          <LocationWatcher />
          <FinanceProvider>
            <Transactions />
          </FinanceProvider>
        </MemoryRouter>
      );

      // Nur tx-match darf gerendert werden
      expect(await screen.findByText('Unkategorisiert April')).toBeInTheDocument();
      expect(screen.queryByText('Kategorisiert April')).not.toBeInTheDocument();
      expect(screen.queryByText('Unkategorisiert Mai')).not.toBeInTheDocument();

      // Filter zurücksetzen klicken
      const resetFiltersBtn = screen.getByRole('button', { name: /^Zurücksetzen$/ });
      expect(resetFiltersBtn).toBeInTheDocument();
      await user.click(resetFiltersBtn);

      // Nach dem Zurücksetzen sind alle Buchungen sichtbar
      expect(screen.getByText('Unkategorisiert April')).toBeInTheDocument();
      expect(screen.getByText('Kategorisiert April')).toBeInTheDocument();
      expect(screen.getByText('Unkategorisiert Mai')).toBeInTheDocument();

      // Die URL-Suchparameter wurden geleert
      expect(currentSearch).toBe('');

      vi.restoreAllMocks();
    });
  });
});
