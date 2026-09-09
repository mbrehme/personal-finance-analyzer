/**
 * @file regexMatcher.test.ts
 * @description Unit-Tests für die Regex-Matching Engine.
 * @module domain/modules/matcher/regexMatcher.test
 */

import { describe, it, expect } from 'vitest';
import { matchTransaction, reMatchAllTransactions, getLeafCategories } from './regexMatcher';
import { Category, Transaction } from '@/types/finance';

describe('regexMatcher Engine', () => {
  const categories: Category[] = [
    {
      id: 'b-living',
      name: 'Wohnen',
      parentId: null,
      // Parent hat kein Regex
    },
    {
      id: 'b-rent',
      name: 'Miete',
      parentId: 'b-living',
      regexPattern: 'Miete|Vermieter Immobilien GmbH',
    },
    {
      id: 'b-groceries',
      name: 'Lebensmittel',
      parentId: null,
      regexPattern: 'Rewe|Edeka|Aldi|Lidl|Bio-Markt',
    },
    {
      id: 'b-salary',
      name: 'Gehalt',
      parentId: null,
      regexPattern: 'Eingang.+Gehalt|Tech Corp',
    },
    {
      id: 'b-special',
      name: 'Sonderkategorie',
      parentId: null,
      manualTransactionIds: ['tx-manual-special'],
    },
  ];

  it('correctly filters leaf categories only', () => {
    const leafCategories = getLeafCategories(categories);
    const leafIds = leafCategories.map((c) => c.id);
    expect(leafIds).not.toContain('b-living'); // Parent
    expect(leafIds).toContain('b-rent'); // Child
    expect(leafIds).toContain('b-groceries'); // Leaf
  });

  it('matches transaction based on subject/receiver via regex', () => {
    const tx: Transaction = {
      id: 'tx-1',
      date: '2026-09-01',
      issuer: 'Me',
      receiver: 'Rewe Filiale 1234',
      subject: 'Kartenzahlung',
      type: 'outbound',
      receiverIban: 'DE00',
      value: -45.5,
      categoryId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, categories);
    expect(match.categoryId).toBe('b-groceries');
    expect(match.assignmentSource).toBe('auto_regex');
  });

  it('matches compound field with [Eingang] and subject', () => {
    const tx: Transaction = {
      id: 'tx-2',
      date: '2026-09-01',
      issuer: 'Tech Corp',
      receiver: 'Me',
      subject: 'Gehaltsabrechnung',
      type: 'inbound',
      senderIban: 'DE00',
      value: 4200,
      categoryId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, categories);
    expect(match.categoryId).toBe('b-salary');
    expect(match.assignmentSource).toBe('auto_regex');
  });

  it('prioritizes manual assignment via category.manualTransactionIds', () => {
    const tx: Transaction = {
      id: 'tx-manual-special',
      date: '2026-09-01',
      issuer: 'Rewe', // Wäre eigentlich b-groceries
      receiver: 'Me',
      subject: 'Einkauf',
      type: 'outbound',
      receiverIban: 'DE00',
      value: -10,
      categoryId: null,
      assignmentSource: 'unassigned',
    };

    const match = matchTransaction(tx, categories);
    expect(match.categoryId).toBe('b-special');
    expect(match.assignmentSource).toBe('manual');
  });

  it('does not overwrite existing manual assignment during reMatchAllTransactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-manual-locked',
        date: '2026-09-01',
        issuer: 'Me',
        receiver: 'Rewe',
        subject: 'Einkauf',
        type: 'outbound',
        receiverIban: 'DE00',
        value: -20,
        categoryId: 'b-rent', // Manuell auf Miete gesetzt
        assignmentSource: 'manual',
      },
      {
        id: 'tx-auto',
        date: '2026-09-01',
        issuer: 'Me',
        receiver: 'Edeka',
        subject: 'Einkauf',
        type: 'outbound',
        receiverIban: 'DE00',
        value: -30,
        categoryId: null,
        assignmentSource: 'unassigned',
      },
    ];

    const reMatched = reMatchAllTransactions(transactions, categories);
    expect(reMatched[0].categoryId).toBe('b-rent'); // Unverändert
    expect(reMatched[0].assignmentSource).toBe('manual');
    expect(reMatched[1].categoryId).toBe('b-groceries'); // Neu zugewiesen
    expect(reMatched[1].assignmentSource).toBe('auto_regex');
  });

  it('matches against compound format [Typ] Empfänger: Zweck (Iban)', () => {
    const testCategories: Category[] = [
      {
        id: 'b-gifts',
        name: 'Geschenke',
        parentId: null,
        regexPattern: 'Ausgang.+Geschenke',
      },
      {
        id: 'b-partner-pocket',
        name: 'Taschengeld Partner',
        parentId: null,
        regexPattern: 'Denise.+Taschengeld',
      },
    ];

    const giftTx: Transaction = {
      id: 'tx-gift',
      date: '2026-09-01',
      issuer: 'Me',
      receiver: 'Amazon',
      subject: 'Geschenke Geburtstag',
      type: 'outbound',
      receiverIban: 'DE112233',
      value: -50,
      categoryId: null,
      assignmentSource: 'unassigned',
    };

    const pocketTx: Transaction = {
      id: 'tx-pocket',
      date: '2026-09-01',
      issuer: 'Me',
      receiver: 'Denise Gül Brehme',
      subject: 'Monatliches Taschengeld',
      type: 'outbound',
      receiverIban: 'DE445566',
      value: -150,
      categoryId: null,
      assignmentSource: 'unassigned',
    };

    expect(matchTransaction(giftTx, testCategories).categoryId).toBe('b-gifts');
    expect(matchTransaction(pocketTx, testCategories).categoryId).toBe('b-partner-pocket');
  });
});
