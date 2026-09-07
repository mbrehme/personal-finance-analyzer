/**
 * @file transactionDeduplication.test.ts
 * @description Unit-Tests für semantische Duplikaterkennung, Gegenbuchungs-Matching und Kategorienschutz.
 */

import { describe, it, expect } from 'vitest';
import { Account, Transaction } from '@/types';
import { findMatchingTransaction, mergeTransactions } from './transactionDeduplication';

describe('transactionDeduplication', () => {
  const giroAccount: Account = {
    id: 'acc-giro',
    name: 'Haupt-Girokonto',
    iban: 'DE89120300001083850147',
    color: '#3B82F6',
    icon: 'Landmark',
    accountType: 'real',
    balanceEntries: [],
  };

  const ruecklagenAccount: Account = {
    id: 'acc-ruecklagen',
    name: 'Rücklagen',
    iban: 'DE80120300001027106861',
    color: '#10B981',
    icon: 'PiggyBank',
    accountType: 'real',
    balanceEntries: [],
  };

  const accounts: Account[] = [giroAccount, ruecklagenAccount];

  describe('findMatchingTransaction', () => {
    it('matches exact transactions by ID or rawFingerprint', () => {
      const existing: Transaction = {
        id: 'tx-1',
        date: '2024-01-30',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        subject: 'Elternzeit Ausgleichsbudget',
        accountIban: 'DE80120300001027106861',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme',
        issuer: 'Denise Gül Brehme',
        iban: '',
        categoryId: 'cat-parenting',
        assignmentSource: 'manual',
        origin: 'imported',
        rawFingerprint: 'fp-12345',
      };

      const incomingById: Transaction = {
        ...existing,
        id: 'tx-1',
        rawFingerprint: 'fp-other',
      };

      const matchById = findMatchingTransaction(incomingById, [existing], accounts);
      expect(matchById?.matchedTx.id).toBe('tx-1');
      expect(matchById?.matchType).toBe('exact');

      const incomingByFp: Transaction = {
        ...existing,
        id: 'tx-new',
        rawFingerprint: 'fp-12345',
      };

      const matchByFp = findMatchingTransaction(incomingByFp, [existing], accounts);
      expect(matchByFp?.matchedTx.id).toBe('tx-1');
      expect(matchByFp?.matchType).toBe('exact');
    });

    it('matches same transfer with missing receiverIban on existing transaction (user screenshot bug)', () => {
      // Vorherige Buchung auf Rücklagenkonto ohne Gegen-IBAN
      const existing: Transaction = {
        id: 'tx-existing',
        date: '2024-01-30',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        accountIban: 'DE80120300001027106861',
        senderIban: 'DE80120300001027106861',
        receiverIban: '', // Im ersten Export fehlte Gegen-IBAN
        subject: 'Elternzeit Ausgleichsbudget',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme',
        issuer: 'Denise Gül Brehme',
        iban: '',
        categoryId: 'cat-family',
        assignmentSource: 'manual',
        origin: 'imported',
        rawFingerprint: 'fp-old',
      };

      // Neu importierte Zeile aus Tagesgeld-CSV mit erkannter Gegen-IBAN
      const incoming: Transaction = {
        id: 'tx-incoming-directed',
        date: '2024-01-30',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        accountIban: 'DE80120300001027106861',
        senderIban: 'DE80120300001027106861',
        receiverIban: 'DE89120300001083850147', // Jetzt mit Gegen-IBAN
        subject: 'Elternzeit Ausgleichsbudget',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme',
        issuer: 'Denise Gül Brehme',
        iban: 'DE89120300001083850147',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
        rawFingerprint: 'fp-new',
      };

      const result = findMatchingTransaction(incoming, [existing], accounts);
      expect(result).not.toBeNull();
      expect(result?.matchedTx.id).toBe('tx-existing');
      expect(result?.matchType).toBe('same_transfer');
    });

    it('matches counterpart transfer between two accounts with opposite signs and 1-day clearing delay', () => {
      // Ausgang auf Rücklagenkonto am 29.01.2024
      const existingOutflow: Transaction = {
        id: 'tx-outflow',
        date: '2024-01-29',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        accountIban: 'DE80120300001027106861',
        senderIban: 'DE80120300001027106861',
        receiverIban: 'DE89120300001083850147',
        subject: 'Elternzeit Ausgleichsbudget',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme',
        issuer: 'Denise Gül Brehme',
        iban: 'DE89120300001083850147',
        categoryId: 'cat-savings',
        assignmentSource: 'manual',
        origin: 'imported',
      };

      // Eingang auf Haupt-Girokonto am 30.01.2024 (+1 Tag)
      const incomingInflow: Transaction = {
        id: 'tx-inflow',
        date: '2024-01-30',
        amount: 2500,
        value: 2500,
        type: 'inbound',
        accountIban: 'DE89120300001083850147',
        senderIban: 'DE80120300001027106861',
        receiverIban: 'DE89120300001083850147',
        subject: 'Elternzeit Ausgleichsbudget',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme und Martin Brehme',
        issuer: '',
        iban: 'DE80120300001027106861',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
      };

      const result = findMatchingTransaction(incomingInflow, [existingOutflow], accounts);
      expect(result).not.toBeNull();
      expect(result?.matchedTx.id).toBe('tx-outflow');
      expect(result?.matchType).toBe('same_transfer'); // Da beide directed sender/receiver haben
    });

    it('matches counterpart transfer via cross-IBAN matching when signs are opposite', () => {
      // Buchung 1: Ausgang auf Girokonto, iban = Rücklagen
      const giroTx: Transaction = {
        id: 'tx-giro',
        date: '2024-02-15',
        amount: 500,
        value: -500,
        type: 'outbound',
        accountIban: 'DE89120300001083850147',
        iban: 'DE80120300001027106861',
        subject: 'Urlaub Rücklage',
        sender: 'Martin Brehme',
        receiver: 'Rücklagen',
        issuer: 'Martin Brehme',
        categoryId: 'cat-vacation',
        assignmentSource: 'manual',
        origin: 'imported',
      };

      // Buchung 2: Eingang auf Rücklagenkonto, iban = Girokonto
      const ruecklagenTx: Transaction = {
        id: 'tx-ruecklagen',
        date: '2024-02-16',
        amount: 500,
        value: 500,
        type: 'inbound',
        accountIban: 'DE80120300001027106861',
        iban: 'DE89120300001083850147',
        subject: 'Urlaub Rücklage',
        sender: 'Martin Brehme',
        receiver: 'Rücklagen',
        issuer: '',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
      };

      const result = findMatchingTransaction(ruecklagenTx, [giroTx], accounts);
      expect(result).not.toBeNull();
      expect(result?.matchedTx.id).toBe('tx-giro');
      expect(result?.matchType).toBe('counterpart');
    });

    it('respects matchedIds set and prevents double-matching multiple bookings of same amount on same day', () => {
      const txA: Transaction = {
        id: 'tx-a',
        date: '2024-03-01',
        amount: 50,
        value: -50,
        type: 'outbound',
        accountIban: 'DE89120300001083850147',
        senderIban: 'DE89120300001083850147',
        subject: 'Bäcker',
        sender: 'Martin',
        receiver: 'Bäckerei',
        issuer: '',
        iban: '',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
      };

      const txB: Transaction = {
        ...txA,
        id: 'tx-b',
        subject: 'Supermarkt',
        receiver: 'REWE',
      };

      const incomingA: Transaction = { ...txA, id: 'tx-incoming-a' };
      const incomingB: Transaction = { ...txB, id: 'tx-incoming-b' };

      const matchedIds = new Set<string>();

      // 1. Match für A
      const matchA = findMatchingTransaction(incomingA, [txA, txB], accounts, matchedIds);
      expect(matchA?.matchedTx.id).toBe('tx-a');
      matchedIds.add(matchA!.matchedTx.id);

      // 2. Match für B darf nicht mehr tx-a matchen
      const matchB = findMatchingTransaction(incomingB, [txA, txB], accounts, matchedIds);
      expect(matchB?.matchedTx.id).toBe('tx-b');
    });

    it('does not match transactions exceeding 4 days date difference', () => {
      const existing: Transaction = {
        id: 'tx-jan',
        date: '2024-01-01',
        amount: 100,
        value: -100,
        type: 'outbound',
        accountIban: 'DE89120300001083850147',
        subject: 'Test',
        sender: 'A',
        receiver: 'B',
        issuer: '',
        iban: '',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
      };

      const incoming: Transaction = {
        ...existing,
        id: 'tx-jan-late',
        date: '2024-01-08', // 7 Tage später
      };

      const match = findMatchingTransaction(incoming, [existing], accounts);
      expect(match).toBeNull();
    });
  });

  describe('mergeTransactions', () => {
    it('strictly preserves existing category and assignmentSource when already assigned', () => {
      const existing: Transaction = {
        id: 'tx-1',
        date: '2024-01-30',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        subject: 'Elternzeit Ausgleichsbudget',
        accountIban: 'DE80120300001027106861',
        senderIban: 'DE80120300001027106861',
        receiverIban: '',
        sender: 'Denise Gül Brehme',
        receiver: 'Denise Gül Brehme',
        issuer: 'Denise Gül Brehme',
        iban: '',
        categoryId: 'cat-my-manual-category',
        assignmentSource: 'manual',
        origin: 'override',
      };

      const incoming: Transaction = {
        id: 'tx-2',
        date: '2024-01-30',
        amount: 2500,
        value: -2500,
        type: 'outbound',
        subject: 'Elternzeit Ausgleichsbudget (vollständig)',
        accountIban: 'DE80120300001027106861',
        senderIban: 'DE80120300001027106861',
        receiverIban: 'DE89120300001083850147',
        sender: 'Denise Gül Brehme',
        receiver: 'Haupt-Girokonto',
        issuer: 'Denise Gül Brehme',
        iban: 'DE89120300001083850147',
        categoryId: 'cat-auto-assigned',
        assignmentSource: 'auto_regex',
        origin: 'imported',
      };

      const merged = mergeTransactions(existing, incoming);

      // ID und bestehende Zuweisung bleiben erhalten
      expect(merged.id).toBe('tx-1');
      expect(merged.categoryId).toBe('cat-my-manual-category');
      expect(merged.assignmentSource).toBe('manual');
      expect(merged.origin).toBe('override');

      // Fehlende Metadaten wurden angereichert
      expect(merged.receiverIban).toBe('DE89120300001083850147');
      expect(merged.iban).toBe('DE89120300001083850147');
      expect(merged.subject).toBe('Elternzeit Ausgleichsbudget (vollständig)');
    });

    it('adopts incoming category if existing category is null', () => {
      const existing: Transaction = {
        id: 'tx-1',
        date: '2024-01-30',
        amount: 100,
        value: -100,
        type: 'outbound',
        subject: 'Miete',
        accountIban: 'DE80120300001027106861',
        sender: '',
        receiver: 'Vermieter',
        issuer: '',
        iban: '',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
      };

      const incoming: Transaction = {
        ...existing,
        id: 'tx-2',
        categoryId: 'cat-rent',
        assignmentSource: 'auto_regex',
      };

      const merged = mergeTransactions(existing, incoming);
      expect(merged.categoryId).toBe('cat-rent');
      expect(merged.assignmentSource).toBe('auto_regex');
    });

    it('preserves dayIndex of existing transaction', () => {
      const existing: Transaction = {
        id: 'tx-1',
        date: '2024-01-30',
        amount: 100,
        value: -100,
        type: 'outbound',
        subject: 'Test',
        accountIban: 'DE80120300001027106861',
        sender: '',
        receiver: '',
        issuer: '',
        iban: '',
        categoryId: null,
        assignmentSource: 'unassigned',
        origin: 'imported',
        dayIndex: 3,
      };

      const incoming: Transaction = {
        ...existing,
        id: 'tx-2',
        dayIndex: 0,
      };

      const merged = mergeTransactions(existing, incoming);
      expect(merged.dayIndex).toBe(3);
    });
  });
});
