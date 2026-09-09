/**
 * @file balanceCalculator.test.ts
 * @description Unit-Tests für die Salden-Berechnungs-Engine.
 * @module domain/modules/analytics/balanceCalculator.test
 */

import { describe, it, expect } from 'vitest';
import { calculateAllBalances } from './balanceCalculator';
import { Account, Transaction } from '@/types/finance';

describe('balanceCalculator', () => {
  const account: Account = {
    id: 'acc-giro',
    name: 'Girokonto',
    iban: 'DE00',
    categoryIds: [],
    balanceEntries: [
      {
        id: 'be-1',
        date: '2026-08-01',
        amount: 2000,
        note: 'Startsaldo',
      },
    ],
  };

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      date: '2026-08-15',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      senderIban: '',
      receiverIban: 'DE00',
      value: 1000,
      categoryId: null,
      assignmentSource: 'unassigned',
    },
    {
      id: 'tx-2',
      date: '2026-09-05',
      issuer: 'Me',
      receiver: 'Miete',
      subject: 'Miete September',
      type: 'outbound',
      senderIban: 'DE00',
      receiverIban: '',
      value: -800,
      categoryId: null,
      assignmentSource: 'unassigned',
    },
  ];

  it('calculates running balance across multiple monthly periods with checkpoints', () => {
    const result = calculateAllBalances([account], transactions, 'monthly');
    expect(result.periodKeys).toEqual(['2026-08', '2026-09']);

    const giroRow = result.rows[0];
    expect(giroRow).toBeDefined();

    // August: Start 2000, Cashflow +1000 => End 3000
    expect(giroRow.periods['2026-08'].startBalance).toBe(2000);
    expect(giroRow.periods['2026-08'].cashflow).toBe(1000);
    expect(giroRow.periods['2026-08'].endBalance).toBe(3000);

    // September: Start 3000, Cashflow -800 => End 2200
    expect(giroRow.periods['2026-09'].startBalance).toBe(3000);
    expect(giroRow.periods['2026-09'].cashflow).toBe(-800);
    expect(giroRow.periods['2026-09'].endBalance).toBe(2200);

    expect(giroRow.latestBalance).toBe(2200);
    expect(result.totalRow.latestBalance).toBe(2200);
  });

  it('filters by selectedAccountId and custom date range', () => {
    const secondAccount: Account = {
      id: 'acc-tagesgeld',
      name: 'Tagesgeld',
      categoryIds: [],
      balanceEntries: [],
    };

    const result = calculateAllBalances(
      [account, secondAccount],
      transactions,
      'monthly',
      'acc-giro',
      {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }
    );

    expect(result.periodKeys).toEqual(['2026-09']);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].account.id).toBe('acc-giro');
  });

  it('calculates virtual subaccount balance based on category filter and does not double-count in totalRow', () => {
    const realAccount: Account = {
      id: 'acc-real-1',
      name: 'Haupt-Girokonto',
      accountType: 'real',
      iban: 'DE89 3704 0044',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 5000 }],
    };

    const virtualSubaccount: Account = {
      id: 'acc-virtual-travel',
      name: 'Urlaubstopf',
      accountType: 'virtual',
      parentAccountId: 'acc-real-1',
      categoryIds: ['cat-travel'],
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 500 }],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-08-10',
        issuer: 'Employer',
        receiver: 'Me',
        subject: 'Salary',
        receiverIban: 'DE8937040044',
        value: 2000,
        categoryId: 'cat-salary',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-2',
        date: '2026-08-15',
        issuer: 'Me',
        receiver: 'Airline',
        subject: 'Flugbuchung Urlaub',
        senderIban: 'DE8937040044',
        value: -300,
        categoryId: 'cat-travel',
        assignmentSource: 'auto_regex',
      },
    ];

    const result = calculateAllBalances([realAccount, virtualSubaccount], txs, 'monthly');

    // Rows contain Real Account first, followed by its Virtual Subaccount
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].account.id).toBe('acc-real-1');
    expect(result.rows[1].account.id).toBe('acc-virtual-travel');

    // Real Account: Start 5000 + 2000 - 300 = 6700
    const realRow = result.rows[0];
    expect(realRow.periods['2026-08'].startBalance).toBe(5000);
    expect(realRow.periods['2026-08'].cashflow).toBe(1700);
    expect(realRow.periods['2026-08'].endBalance).toBe(6700);
    expect(realRow.latestBalance).toBe(6700);

    // Virtual Subaccount: Start 500 - 300 (only cat-travel) = 200
    const virtualRow = result.rows[1];
    expect(virtualRow.periods['2026-08'].startBalance).toBe(500);
    expect(virtualRow.periods['2026-08'].cashflow).toBe(-300);
    expect(virtualRow.periods['2026-08'].endBalance).toBe(200);
    expect(virtualRow.latestBalance).toBe(200);

    // TotalRow must ONLY sum real accounts to prevent double counting:
    // Total should be 6700, NOT 6700 + 200 = 6900!
    expect(result.totalRow.latestBalance).toBe(6700);
    expect(result.totalRow.periods['2026-08'].endBalance).toBe(6700);
  });

  it('calculates balances dynamically for transactions without accountId using accountIban', () => {
    const realAccount: Account = {
      id: 'acc-real-main',
      name: 'Girokonto',
      accountType: 'real',
      iban: 'DE123456789',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 1000 }],
    };

    const virtualAccount: Account = {
      id: 'acc-virt-groceries',
      name: 'Lebensmittel-Budget',
      accountType: 'virtual',
      parentAccountId: 'acc-real-main',
      categoryIds: ['cat-groceries'],
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 400 }],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-dynamic-1',
        date: '2026-08-05',
        issuer: 'Employer',
        receiver: 'Me',
        subject: 'Salary',
        senderIban: 'DE999999999',
        receiverIban: 'DE123456789',
        value: 2500,
        categoryId: 'cat-salary',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-dynamic-2',
        date: '2026-08-10',
        issuer: 'Me',
        receiver: 'Supermarket',
        subject: 'Wocheneinkauf',
        senderIban: 'DE123456789',
        receiverIban: 'DE888888888',
        value: -150,
        categoryId: 'cat-groceries',
        assignmentSource: 'auto_regex',
      },
    ];

    const result = calculateAllBalances([realAccount, virtualAccount], txs, 'monthly');
    expect(result.rows).toHaveLength(2);

    // Real: 1000 + 2500 - 150 = 3350
    expect(result.rows[0].periods['2026-08'].endBalance).toBe(3350);
    // Virtual: 400 - 150 = 250
    expect(result.rows[1].periods['2026-08'].endBalance).toBe(250);
    // Total sum ignores virtual
    expect(result.totalRow.periods['2026-08'].endBalance).toBe(3350);
  });

  it('inverts cashflow on recipient account and its virtual subaccount when transfer occurs', () => {
    const giroAcc: Account = {
      id: 'acc-giro',
      name: 'Girokonto',
      accountType: 'real',
      iban: 'DE1111',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 2000 }],
    };

    const tagesgeldAcc: Account = {
      id: 'acc-tg',
      name: 'Tagesgeld',
      accountType: 'real',
      iban: 'DE2222',
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 1000 }],
    };

    const savingsSub: Account = {
      id: 'acc-sub-savings',
      name: 'Sparen Topf',
      accountType: 'virtual',
      parentAccountId: 'acc-tg',
      categoryIds: ['cat-sparen'],
      balanceEntries: [{ id: 'b3', date: '2026-08-01', amount: 500 }],
    };

    const creditCardAcc: Account = {
      id: 'acc-cc',
      name: 'Kreditkarte',
      accountType: 'real',
      iban: 'DE3333',
      balanceEntries: [{ id: 'b4', date: '2026-08-01', amount: 0 }],
    };

    const txs: Transaction[] = [
      // 1. Umbuchung von Girokonto auf Tagesgeld für Topf 'Sparen' (Abgang Giro, Eingang Tagesgeld)
      {
        id: 'tx-transfer-1',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Sparen August',
        value: -500,
        categoryId: 'cat-sparen',
        assignmentSource: 'manual',
      },
      // 2. Buchung auf unbeteiligter Kreditkarte mit gleicher Kategorie 'cat-sparen'
      // Darf das virtuelle Unterkonto unter Tagesgeld NICHT berühren!
      {
        id: 'tx-cc-unrelated',
        senderIban: 'DE3333',
        receiverIban: 'DE8888',
        date: '2026-08-15',
        issuer: 'Martin',
        receiver: 'Sparplan extern',
        subject: 'Fremdes Konto',
        value: -200,
        categoryId: 'cat-sparen',
        assignmentSource: 'manual',
      },
    ];

    const result = calculateAllBalances(
      [giroAcc, tagesgeldAcc, savingsSub, creditCardAcc],
      txs,
      'monthly'
    );

    const giroRow = result.rows.find((r) => r.account.id === 'acc-giro');
    const tgRow = result.rows.find((r) => r.account.id === 'acc-tg');
    const savingsRow = result.rows.find((r) => r.account.id === 'acc-sub-savings');
    const ccRow = result.rows.find((r) => r.account.id === 'acc-cc');

    // Girokonto: 2000 - 500 = 1500
    expect(giroRow?.periods['2026-08'].cashflow).toBe(-500);
    expect(giroRow?.periods['2026-08'].endBalance).toBe(1500);

    // Tagesgeld als echtes Bankkonto: Berechnet sich aus Buchungen, bei denen es Empfänger war (+500 €)
    expect(tgRow?.periods['2026-08'].cashflow).toBe(500);
    expect(tgRow?.periods['2026-08'].endBalance).toBe(1500);

    // Virtuelles Unterkonto unter Tagesgeld: Start 500 + 500 = 1000 (die -200 der Kreditkarte werden ignoriert!)
    expect(savingsRow?.periods['2026-08'].cashflow).toBe(500);
    expect(savingsRow?.periods['2026-08'].endBalance).toBe(1000);

    // Kreditkarte: 0 - 200 = -200
    expect(ccRow?.periods['2026-08'].cashflow).toBe(-200);
    expect(ccRow?.periods['2026-08'].endBalance).toBe(-200);
  });

  it('handles transfers between real accounts when both bank statements are imported without double-counting', () => {
    const giroAcc: Account = {
      id: 'acc-giro',
      name: 'Girokonto',
      accountType: 'real',
      iban: 'DE1111',
      balanceEntries: [{ id: 'b1', date: '2026-08-01', amount: 2000 }],
    };

    const tagesgeldAcc: Account = {
      id: 'acc-tg',
      name: 'Tagesgeld',
      accountType: 'real',
      iban: 'DE2222',
      balanceEntries: [{ id: 'b2', date: '2026-08-01', amount: 1000 }],
    };

    const txs: Transaction[] = [
      // Auszug Girokonto: -500 € an Tagesgeld
      {
        id: 'tx-giro-statement',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung Sparen',
        value: -500,
        assignmentSource: 'unassigned',
      },
      // Auszug Tagesgeldkonto: +500 € von Girokonto
      {
        id: 'tx-tg-statement',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung Sparen',
        value: 500,
        assignmentSource: 'unassigned',
      },
    ];

    const result = calculateAllBalances([giroAcc, tagesgeldAcc], txs, 'monthly');

    const giroRow = result.rows.find((r) => r.account.id === 'acc-giro');
    const tgRow = result.rows.find((r) => r.account.id === 'acc-tg');

    // Girokonto darf die Gegenbuchung von Tagesgeld NICHT invertiert abziehen (-500 statt -1000!)
    expect(giroRow?.periods['2026-08'].cashflow).toBe(-500);
    expect(giroRow?.periods['2026-08'].endBalance).toBe(1500);

    // Tagesgeld darf die Buchung von Girokonto NICHT noch einmal addieren (+500 statt +1000!)
    expect(tgRow?.periods['2026-08'].cashflow).toBe(500);
    expect(tgRow?.periods['2026-08'].endBalance).toBe(1500);

    // Gesamtsaldo bleibt unverändert bei 3000 € (keine Phantom-Verluste)
    expect(result.totalRow.periods['2026-08'].endBalance).toBe(3000);
  });

  it('carries forward historic balances from prior years into a filtered current year with only outflows', () => {
    const mainAccount: Account = {
      id: 'acc-main',
      name: 'Hauptkonto',
      iban: 'DE00',
      accountType: 'real',
      balanceEntries: [{ id: 'b-2025', date: '2025-12-31', amount: 5000 }],
    };

    const txs: Transaction[] = [
      // 2025 Inflow vor dem Stichtag
      {
        id: 'tx-2025-1',
        date: '2025-06-15',
        issuer: 'Arbeitgeber',
        receiver: 'Ich',
        subject: 'Gehalt 2025',
        receiverIban: 'DE00',
        value: 5000,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
      // 2026 Nur Ausgänge
      {
        id: 'tx-2026-1',
        date: '2026-02-10',
        issuer: 'Ich',
        receiver: 'Vermieter',
        subject: 'Miete Februar',
        senderIban: 'DE00',
        value: -1200,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
    ];

    // Filter auf das aktuelle Jahr 2026
    const result = calculateAllBalances([mainAccount], txs, 'monthly', null, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    const row = result.rows[0];
    expect(row).toBeDefined();

    // Januar 2026: Startsaldo muss 5000 sein (aus 2025 übernommen!), Cashflow 0 => Endsaldo 5000
    expect(row.periods['2026-01'].startBalance).toBe(5000);
    expect(row.periods['2026-01'].cashflow).toBe(0);
    expect(row.periods['2026-01'].endBalance).toBe(5000);

    // Februar 2026: Startsaldo 5000, Cashflow -1200 => Endsaldo 3800 (POSITIV!)
    expect(row.periods['2026-02'].startBalance).toBe(5000);
    expect(row.periods['2026-02'].cashflow).toBe(-1200);
    expect(row.periods['2026-02'].endBalance).toBe(3800);

    // Aktueller Stand muss positiv (3800 €) sein, nicht negativ (-1200 €)
    expect(row.latestBalance).toBe(3800);
    expect(result.totalRow.latestBalance).toBe(3800);
  });

  it('carries forward historic transaction balance when no checkpoints are configured', () => {
    const accountWithoutCheckpoints: Account = {
      id: 'acc-pure-tx',
      name: 'Reines Transaktionskonto',
      iban: 'DE00',
      accountType: 'real',
      balanceEntries: [],
    };

    const txs: Transaction[] = [
      // 2025 Inflow
      {
        id: 'tx-2025',
        date: '2025-10-01',
        issuer: 'Kunde',
        receiver: 'Ich',
        subject: 'Honorar',
        receiverIban: 'DE00',
        value: 10000,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
      // 2026 Outflow
      {
        id: 'tx-2026',
        date: '2026-03-01',
        issuer: 'Ich',
        receiver: 'Shop',
        subject: 'Kauf',
        senderIban: 'DE00',
        value: -2000,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
    ];

    // Filter auf das aktuelle Jahr 2026
    const result = calculateAllBalances([accountWithoutCheckpoints], txs, 'yearly', null, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    const row = result.rows[0];
    expect(row.periods['2026'].startBalance).toBe(10000);
    expect(row.periods['2026'].cashflow).toBe(-2000);
    expect(row.periods['2026'].endBalance).toBe(8000);
    expect(row.latestBalance).toBe(8000);
  });

  it('correctly anchors multiple checkpoints across multiple years', () => {
    const multiCheckpointAcc: Account = {
      id: 'acc-multi',
      name: 'Mehrere Stichtage',
      iban: 'DE00',
      accountType: 'real',
      balanceEntries: [
        { id: 'cp-2024', date: '2024-12-31', amount: 2000 },
        { id: 'cp-2025', date: '2025-12-31', amount: 8000 },
      ],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-2026',
        senderIban: 'DE00',
        date: '2026-01-15',
        issuer: 'Ich',
        receiver: 'Abo',
        subject: 'Jahresbeitrag',
        value: -500,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
    ];

    const result = calculateAllBalances([multiCheckpointAcc], txs, 'monthly', null, {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const row = result.rows[0];
    // Startet am 2025-12-31 Checkpoint (8000 €)
    expect(row.periods['2026-01'].startBalance).toBe(8000);
    expect(row.periods['2026-01'].cashflow).toBe(-500);
    expect(row.periods['2026-01'].endBalance).toBe(7500);
    expect(row.latestBalance).toBe(7500);
  });

  it('correctly calculates balance with checkpoint and multiple distinct transfers of the same amount', () => {
    const tgAccount: Account = {
      id: 'acc-tg',
      name: 'Tagesgeld',
      iban: 'DE80120300001027106861',
      accountType: 'real',
      categoryIds: [],
      balanceEntries: [{ id: 'cp-2023', date: '2023-12-31', amount: 16930.02 }],
    };

    const giroAccount: Account = {
      id: 'acc-giro',
      name: 'Girokonto',
      iban: 'DE89120300001083850147',
      accountType: 'real',
      categoryIds: [],
      balanceEntries: [],
    };

    // Zwei Eingänge am selben Tag mit jeweils 250 €
    const txs: Transaction[] = [
      {
        id: 'tx-urlaub',
        date: '2026-09-07',
        senderIban: giroAccount.iban,
        receiverIban: tgAccount.iban,
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 250,
        value: 250,
        subject: 'Rücklage: Urlaub',
        categoryId: null,
        assignmentSource: 'unassigned',
      },
      {
        id: 'tx-geschenke',
        date: '2026-09-07',
        senderIban: giroAccount.iban,
        receiverIban: tgAccount.iban,
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 250,
        value: 250,
        subject: 'Geschenke',
        categoryId: null,
        assignmentSource: 'unassigned',
      },
    ];

    const result = calculateAllBalances([tgAccount, giroAccount], txs, 'monthly', 'acc-tg');
    const row = result.rows[0];
    expect(row.periods['2026-09'].startBalance).toBe(16930.02);
    expect(row.periods['2026-09'].cashflow).toBe(500);
    expect(row.periods['2026-09'].endBalance).toBe(17430.02);
    expect(row.latestBalance).toBe(17430.02);
  });
});
