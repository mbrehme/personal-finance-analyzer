/**
 * @file cashflowCalculator.test.ts
 * @description Unit-Tests für die Cashflow-Berechnungs-Engine.
 * @module services/analytics/cashflowCalculator.test
 */

import { describe, it, expect } from 'vitest';
import { calculateCashflowMatrix, extractPeriodKeys } from './cashflowCalculator';
import { Category, Transaction } from '@/types/finance';

describe('cashflowCalculator', () => {
  const categories: Category[] = [
    {
      id: 'b-living',
      name: 'Wohnen',
      parentId: null,
    },
    {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
      targetBudget: { period: 'monthly', amount: 1500 },
    },
    {
      id: 'b-salary',
      name: 'Gehalt',
      parentId: null,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      valueDate: '2026-08-01',
      bookingDate: '2026-08-01',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      iban: 'DE00',
      value: 3000,
      categoryId: 'b-salary',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      valueDate: '2026-08-02',
      bookingDate: '2026-08-02',
      issuer: 'Me',
      receiver: 'Vermieter',
      subject: 'Miete',
      type: 'outbound',
      iban: 'DE00',
      value: -1200,
      categoryId: 'b-rent',
      assignmentSource: 'auto_regex',
    },
    {
      id: 'tx-3',
      accountId: 'acc-1',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: 'AG',
      receiver: 'Me',
      subject: 'Gehalt',
      type: 'inbound',
      iban: 'DE00',
      value: 3000,
      categoryId: 'b-salary',
      assignmentSource: 'auto_regex',
    },
  ];

  it('extracts unique sorted period keys', () => {
    const keys = extractPeriodKeys(transactions, 'monthly');
    expect(keys).toEqual(['2026-08', '2026-09']);
  });

  it('rolls up child category sums to parent category in cashflow matrix', () => {
    const matrix = calculateCashflowMatrix(categories, transactions, 'monthly');
    expect(matrix.periodKeys).toEqual(['2026-08', '2026-09']);

    const livingRow = matrix.rows.find((r) => r.category.id === 'b-living');
    expect(livingRow).toBeDefined();
    expect(livingRow?.hasChildren).toBe(true);
    // In August: Miete = -1200 gerollt zu Wohnen
    expect(livingRow?.periods['2026-08'].outbound).toBe(-1200);
    expect(livingRow?.periods['2026-08'].budget).toBe(1500);

    const rentRow = matrix.rows.find((r) => r.category.id === 'b-rent');
    expect(rentRow?.depth).toBe(1);
    expect(rentRow?.periods['2026-08'].outbound).toBe(-1200);

    const salaryRow = matrix.rows.find((r) => r.category.id === 'b-salary');
    expect(salaryRow?.periods['2026-08'].inbound).toBe(3000);
    expect(salaryRow?.periods['2026-09'].inbound).toBe(3000);

    // Gesamtsumme
    expect(matrix.totalRow.periods['2026-08'].net).toBe(1800);
    expect(matrix.totalRow.periods['2026-09'].net).toBe(3000);
    expect(matrix.totalRow.totalNet).toBe(4800);
  });

  it('correctly calculates diffToBudget as actual minus budget', () => {
    const testCategories: Category[] = [
      {
        id: 'b-exp',
        name: 'Ausgabe Kategorie',
        parentId: null,
        targetBudget: { period: 'monthly', amount: 500 },
      },
      {
        id: 'b-inc',
        name: 'Einnahme Kategorie',
        parentId: null,
        targetBudget: { period: 'monthly', amount: 500 },
      },
    ];

    const testTxs: Transaction[] = [
      {
        id: 'tx-exp-1',
        accountId: 'acc-1',
        valueDate: '2026-08-10',
        bookingDate: '2026-08-10',
        issuer: 'Me',
        receiver: 'Shop',
        subject: 'Shop',
        type: 'outbound',
        iban: 'DE00',
        value: -518,
        categoryId: 'b-exp',
        assignmentSource: 'auto_regex',
      },
      {
        id: 'tx-inc-1',
        accountId: 'acc-1',
        valueDate: '2026-08-10',
        bookingDate: '2026-08-10',
        issuer: 'Partner',
        receiver: 'Me',
        subject: 'Einnahme',
        type: 'inbound',
        iban: 'DE00',
        value: 518,
        categoryId: 'b-inc',
        assignmentSource: 'auto_regex',
      },
    ];

    const matrix = calculateCashflowMatrix(testCategories, testTxs, 'monthly');
    const expRow = matrix.rows.find((r) => r.category.id === 'b-exp');
    const incRow = matrix.rows.find((r) => r.category.id === 'b-inc');

    // Beide haben einen tatsächlichen Betrag von 518 und ein Soll von 500
    // Differenz muss in beiden Fällen +18 (18 mehr als geplant) sein
    expect(expRow?.periods['2026-08'].diffToBudget).toBe(18);
    expect(incRow?.periods['2026-08'].diffToBudget).toBe(18);
  });

  it('rolls up child budgets to parent categories when parent has no manual budget', () => {
    const hierarchyCategories: Category[] = [
      {
        id: 'b-parent',
        name: 'Ausgaben',
        parentId: null,
      },
      {
        id: 'b-child-1',
        name: 'Miete',
        parentId: 'b-parent',
        targetBudget: { period: 'monthly', amount: 1000 },
      },
      {
        id: 'b-child-2',
        name: 'Kredite',
        parentId: 'b-parent',
      },
      {
        id: 'b-grandchild',
        name: 'KFW',
        parentId: 'b-child-2',
        targetBudget: { period: 'monthly', amount: 250 },
      },
      {
        id: 'b-manual-parent',
        name: 'Haushalt',
        parentId: null,
        targetBudget: { period: 'monthly', amount: 500 },
      },
      {
        id: 'b-manual-child',
        name: 'Lebensmittel',
        parentId: 'b-manual-parent',
        targetBudget: { period: 'monthly', amount: 300 },
      },
    ];

    const matrix = calculateCashflowMatrix(hierarchyCategories, [], 'monthly', undefined, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    const parentRow = matrix.rows.find((r) => r.category.id === 'b-parent');
    const child2Row = matrix.rows.find((r) => r.category.id === 'b-child-2');
    const manualParentRow = matrix.rows.find((r) => r.category.id === 'b-manual-parent');

    // b-child-2 erbt Budget von b-grandchild (250)
    expect(child2Row?.effectiveBudget).toBe(250);
    expect(child2Row?.isBudgetRollup).toBe(true);
    expect(child2Row?.periods['2026-09'].budget).toBe(250);

    // b-parent rollt b-child-1 (1000) + b-child-2 (250) = 1250 auf
    expect(parentRow?.effectiveBudget).toBe(1250);
    expect(parentRow?.isBudgetRollup).toBe(true);
    expect(parentRow?.periods['2026-09'].budget).toBe(1250);

    // b-manual-parent hat Kinder, darf keine eigenen Werte haben -> reines Rollup des Kindes (300)
    expect(manualParentRow?.effectiveBudget).toBe(300);
    expect(manualParentRow?.isBudgetRollup).toBe(true);
  });

  it('only includes selected categories in parent rollup (budget and transactions)', () => {
    const hierarchyCategories: Category[] = [
      {
        id: 'p1',
        name: 'Wohnen',
        parentId: null,
      },
      {
        id: 'c1',
        name: 'Miete',
        parentId: 'p1',
        targetBudget: { period: 'monthly', amount: 800 },
      },
      {
        id: 'c2',
        name: 'Strom',
        parentId: 'p1',
        targetBudget: { period: 'monthly', amount: 100 },
      },
    ];

    const txs: Transaction[] = [
      {
        id: 't1',
        accountId: 'acc1',
        bookingDate: '2026-09-05',
        valueDate: '2026-09-05',
        issuer: 'Me',
        receiver: 'Landlord',
        subject: 'Miete',
        type: 'outbound',
        iban: 'DE00',
        value: -800,
        categoryId: 'c1',
        assignmentSource: 'manual',
      },
      {
        id: 't2',
        accountId: 'acc1',
        bookingDate: '2026-09-10',
        valueDate: '2026-09-10',
        issuer: 'Me',
        receiver: 'Utility',
        subject: 'Strom',
        type: 'outbound',
        iban: 'DE00',
        value: -90,
        categoryId: 'c2',
        assignmentSource: 'manual',
      },
    ];

    // 1. Beide Kinder ausgewählt: Parent Rollup = 900 Budget, -890 Outbound
    const fullMatrix = calculateCashflowMatrix(hierarchyCategories, txs, 'monthly', undefined, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      selectedCategoryIds: ['p1', 'c1', 'c2'],
    });

    const fullParent = fullMatrix.rows.find((r) => r.category.id === 'p1');
    expect(fullParent?.effectiveBudget).toBe(900);
    expect(fullParent?.totalOutbound).toBe(-890);

    // 2. Nur c1 (Miete) ausgewählt, c2 (Strom) abgewählt: Parent Rollup = 800 Budget, -800 Outbound
    const filteredMatrix = calculateCashflowMatrix(hierarchyCategories, txs, 'monthly', undefined, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      selectedCategoryIds: ['p1', 'c1'],
    });

    const filteredParent = filteredMatrix.rows.find((r) => r.category.id === 'p1');
    expect(filteredParent?.effectiveBudget).toBe(800);
    expect(filteredParent?.totalOutbound).toBe(-800);
    expect(filteredMatrix.rows.find((r) => r.category.id === 'c2')).toBeUndefined();
  });

  it('correctly aggregates uncategorized transactions into uncategorizedRow', () => {
    const testCategories: Category[] = [
      {
        id: 'cat-1',
        name: 'Lebensmittel',
        parentId: null,
      },
    ];

    const testTxs: Transaction[] = [
      {
        id: 'tx-cat',
        accountId: 'acc-1',
        valueDate: '2026-09-05',
        bookingDate: '2026-09-05',
        issuer: 'Supermarkt',
        receiver: 'Me',
        subject: 'Einkauf',
        value: -50,
        categoryId: 'cat-1',
        assignmentSource: 'manual',
        iban: '',
      },
      {
        id: 'tx-uncat-1',
        accountId: 'acc-1',
        valueDate: '2026-09-10',
        bookingDate: '2026-09-10',
        issuer: 'Unbekannt',
        receiver: 'Me',
        subject: 'Keine Kategorie',
        value: -30,
        categoryId: null,
        assignmentSource: 'unassigned',
        iban: '',
      },
      {
        id: 'tx-uncat-2',
        accountId: 'acc-1',
        valueDate: '2026-09-15',
        bookingDate: '2026-09-15',
        issuer: 'Geschenk',
        receiver: 'Me',
        subject: 'Bargeld',
        value: 100,
        categoryId: null,
        assignmentSource: 'unassigned',
        iban: '',
      },
    ];

    const matrix = calculateCashflowMatrix(testCategories, testTxs, 'monthly', undefined, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(matrix.uncategorizedRow).toBeDefined();
    expect(matrix.uncategorizedRow.periods['2026-09'].inbound).toBe(100);
    expect(matrix.uncategorizedRow.periods['2026-09'].outbound).toBe(-30);
    expect(matrix.uncategorizedRow.periods['2026-09'].net).toBe(70);
    expect(matrix.uncategorizedRow.totalInbound).toBe(100);
    expect(matrix.uncategorizedRow.totalOutbound).toBe(-30);
    expect(matrix.uncategorizedRow.totalNet).toBe(70);

    // Gesamtsumme = Kategorisiert (-50) + Unkategorisiert (+70) = +20
    expect(matrix.totalRow.periods['2026-09'].net).toBe(20);
  });
});
