/**
 * @file accountService.test.ts
 * @description Unit-Tests für reine Konto-Domänenlogik und -Berechnungen (Schicht 3).
 * @module domain/modules/accounts/accountService.test
 */

import { describe, it, expect } from 'vitest';
import { Account, Transaction } from '@/types';
import {
  normalizeIban,
  getTransactionAccountInfo,
  getTransactionEffectiveValueForAccount,
  isTransactionMatchingAccount,
} from './accountService';

describe('accountService', () => {
  const giroAccount: Account = {
    id: 'acc-giro',
    name: 'Girokonto',
    accountType: 'real',
    iban: 'DE44500105175407324900',
    color: '#3b82f6',
    icon: 'Landmark',
    categoryIds: [],
    balanceEntries: [],
  };

  const tagesgeldAccount: Account = {
    id: 'acc-tagesgeld',
    name: 'Tagesgeld',
    accountType: 'real',
    iban: 'DE44500105175407324995',
    color: '#10b981',
    icon: 'Landmark',
    categoryIds: [],
    balanceEntries: [],
  };

  const cashAccount: Account = {
    id: 'acc-cash',
    name: 'Bargeld',
    accountType: 'real',
    // Kein IBAN
    color: '#f59e0b',
    icon: 'Wallet',
    categoryIds: [],
    balanceEntries: [],
  };

  const virtualWohnen: Account = {
    id: 'acc-virt-wohnen',
    name: 'Wohnen Rücklage',
    accountType: 'virtual',
    parentAccountId: 'acc-giro',
    categoryIds: ['cat-miete', 'cat-strom'],
    color: '#8b5cf6',
    icon: 'FolderTree',
    balanceEntries: [],
  };

  const virtualBuffer: Account = {
    id: 'acc-virt-buffer',
    name: 'Buffer Rücklage',
    accountType: 'virtual',
    parentAccountId: 'acc-tagesgeld',
    categoryIds: ['cat-buffer'],
    color: '#38bdf8',
    icon: 'FolderTree',
    balanceEntries: [],
  };

  const allAccounts: Account[] = [
    giroAccount,
    tagesgeldAccount,
    cashAccount,
    virtualWohnen,
    virtualBuffer,
  ];

  describe('normalizeIban', () => {
    it('returns empty string for undefined or empty input', () => {
      expect(normalizeIban()).toBe('');
      expect(normalizeIban('')).toBe('');
    });

    it('removes spaces and converts to uppercase', () => {
      expect(normalizeIban('de44 5001 0517 5407 3249 00')).toBe('DE44500105175407324900');
      expect(normalizeIban('  DE12 3456  ')).toBe('DE123456');
    });
  });

  describe('getTransactionAccountInfo', () => {
    it('matches primary account by accountIban', () => {
      const tx: Transaction = {
        id: 'tx-1',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-01',
        issuer: 'Supermarkt',
        receiver: 'Martin',
        subject: 'Einkauf',
        iban: 'DE999999',
        value: -50,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.primaryAccount?.id).toBe('acc-giro');
      expect(info.counterAccount).toBeUndefined();
      expect(info.virtualAccounts).toHaveLength(0);
      expect(info.allAccounts).toHaveLength(1);
    });

    it('matches primary account by account id when account has no IBAN', () => {
      const tx: Transaction = {
        id: 'tx-cash',
        accountIban: 'acc-cash',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Bäcker',
        subject: 'Bargeld Einkauf',
        iban: '',
        value: -5,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.primaryAccount?.id).toBe('acc-cash');
      expect(info.allAccounts.some((a) => a.id === 'acc-cash')).toBe(true);
    });

    it('matches counterAccount for internal transfer between real accounts', () => {
      const tx: Transaction = {
        id: 'tx-transfer',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung',
        iban: 'DE44500105175407324995',
        value: -500,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.primaryAccount?.id).toBe('acc-giro');
      expect(info.counterAccount?.id).toBe('acc-tagesgeld');
      expect(info.allAccounts.map((a) => a.id)).toContain('acc-giro');
      expect(info.allAccounts.map((a) => a.id)).toContain('acc-tagesgeld');
    });

    it('associates virtual account if category matches and parent matches primaryAccount', () => {
      const tx: Transaction = {
        id: 'tx-rent',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
        iban: 'DE88888',
        value: -800,
        categoryId: 'cat-miete',
        assignmentSource: 'manual',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.primaryAccount?.id).toBe('acc-giro');
      expect(info.virtualAccounts.map((v) => v.id)).toContain('acc-virt-wohnen');
      expect(info.allAccounts.map((a) => a.id)).toContain('acc-virt-wohnen');
    });
  });

  describe('getTransactionEffectiveValueForAccount', () => {
    it('returns direct value for primary account', () => {
      const tx: Transaction = {
        id: 'tx-1',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-01',
        issuer: 'Supermarkt',
        receiver: 'Martin',
        subject: 'Einkauf',
        iban: 'DE999999',
        value: -50,
        assignmentSource: 'unassigned',
      };
      expect(getTransactionEffectiveValueForAccount(tx, giroAccount, allAccounts)).toBe(-50);
      expect(getTransactionEffectiveValueForAccount(tx, tagesgeldAccount, allAccounts)).toBeNull();
    });

    it('returns effective value for virtual account when category matches', () => {
      const tx: Transaction = {
        id: 'tx-rent',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
        iban: 'DE88888',
        value: -800,
        categoryId: 'cat-miete',
        assignmentSource: 'manual',
      };
      expect(getTransactionEffectiveValueForAccount(tx, virtualWohnen, allAccounts)).toBe(-800);
    });

    it('evaluates outbound payment from parent account as negative for virtual account even if tx.value is positive', () => {
      // Buchung stammt aus dem Giro-Kontoauszug (deshalb value: +960), ist aber ein Transfer von Tagesgeld nach Giro
      const txFromGiroStatement: Transaction = {
        id: 'tx-transfer-buffer',
        date: '2026-08-01',
        senderIban: tagesgeldAccount.iban,
        receiverIban: giroAccount.iban,
        accountIban: giroAccount.iban,
        iban: tagesgeldAccount.iban || '',
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 960,
        value: 960, // positiv im Giro-Auszug
        subject: 'Krankenkasse Martin',
        categoryId: 'cat-buffer', // gehört zu virtualBuffer unter acc-tagesgeld
        assignmentSource: 'auto_regex',
      };

      // Für das Unterkonto des Absenders (Tagesgeld) MUSS es ein Abgang (-960 €) sein!
      expect(
        getTransactionEffectiveValueForAccount(txFromGiroStatement, virtualBuffer, allAccounts)
      ).toBe(-960);

      // Für das Tagesgeldkonto selbst: -960 €
      expect(
        getTransactionEffectiveValueForAccount(txFromGiroStatement, tagesgeldAccount, allAccounts)
      ).toBe(-960);

      // Für das Empfängerkonto Giro: +960 €
      expect(
        getTransactionEffectiveValueForAccount(txFromGiroStatement, giroAccount, allAccounts)
      ).toBe(960);
    });

    it('evaluates inbound payment to parent account as positive for virtual account', () => {
      // Transfer von Giro nach Tagesgeld (Aufbau Buffer)
      const savingTx: Transaction = {
        id: 'tx-save-buffer',
        date: '2026-08-01',
        senderIban: giroAccount.iban,
        receiverIban: tagesgeldAccount.iban,
        accountIban: giroAccount.iban,
        iban: tagesgeldAccount.iban || '',
        issuer: 'Martin',
        receiver: 'Denise',
        amount: 250,
        value: -250,
        subject: 'Buffer Sparen',
        categoryId: 'cat-buffer',
        assignmentSource: 'manual',
      };

      // Für das Unterkonto des Empfängers (Tagesgeld) MUSS es ein Eingang (+250 €) sein!
      expect(getTransactionEffectiveValueForAccount(savingTx, virtualBuffer, allAccounts)).toBe(
        250
      );
    });

    it('deduplicates directed counterpart transactions when both statements are in allTransactions', () => {
      const txFromTg: Transaction = {
        id: 'tx-tg-out',
        date: '2026-08-01',
        senderIban: tagesgeldAccount.iban,
        receiverIban: giroAccount.iban,
        accountIban: tagesgeldAccount.iban,
        iban: giroAccount.iban || '',
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 960,
        value: -960,
        subject: 'Krankenkasse Martin',
        categoryId: 'cat-buffer',
        assignmentSource: 'auto_regex',
      };

      const txFromGiro: Transaction = {
        id: 'tx-giro-in',
        date: '2026-08-01',
        senderIban: tagesgeldAccount.iban,
        receiverIban: giroAccount.iban,
        accountIban: giroAccount.iban,
        iban: tagesgeldAccount.iban || '',
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 960,
        value: 960,
        subject: 'Krankenkasse Martin',
        categoryId: 'cat-buffer',
        assignmentSource: 'auto_regex',
      };

      const bothTxs = [txFromTg, txFromGiro];

      // Für Tagesgeld: Nur die Buchung aus dem Tagesgeld-Auszug wird gewertet
      expect(
        getTransactionEffectiveValueForAccount(txFromTg, tagesgeldAccount, allAccounts, bothTxs)
      ).toBe(-960);
      expect(
        getTransactionEffectiveValueForAccount(txFromGiro, tagesgeldAccount, allAccounts, bothTxs)
      ).toBeNull();

      // Für Giro: Nur die Buchung aus dem Giro-Auszug wird gewertet
      expect(
        getTransactionEffectiveValueForAccount(txFromGiro, giroAccount, allAccounts, bothTxs)
      ).toBe(960);
      expect(
        getTransactionEffectiveValueForAccount(txFromTg, giroAccount, allAccounts, bothTxs)
      ).toBeNull();

      // Für das Unterkonto virtualBuffer (unter Tagesgeld):
      // txFromTg stammt direkt vom Tagesgeld-Auszug -> -960
      // txFromGiro stammt vom Giro-Auszug -> wird dedupliziert (null)
      expect(
        getTransactionEffectiveValueForAccount(txFromTg, virtualBuffer, allAccounts, bothTxs)
      ).toBe(-960);
      expect(
        getTransactionEffectiveValueForAccount(txFromGiro, virtualBuffer, allAccounts, bothTxs)
      ).toBeNull();
    });
  });

  describe('isTransactionMatchingAccount', () => {
    const tx: Transaction = {
      id: 'tx-1',
      accountIban: 'DE44500105175407324900',
      date: '2026-08-01',
      issuer: 'Supermarkt',
      receiver: 'Martin',
      subject: 'Einkauf',
      iban: 'DE999999',
      value: -50,
      assignmentSource: 'unassigned',
    };

    it('returns true for accountId "all"', () => {
      expect(isTransactionMatchingAccount(tx, 'all', allAccounts)).toBe(true);
    });

    it('returns true when accountId matches primary account', () => {
      expect(isTransactionMatchingAccount(tx, 'acc-giro', allAccounts)).toBe(true);
    });

    it('returns false when accountId does not match', () => {
      expect(isTransactionMatchingAccount(tx, 'acc-tagesgeld', allAccounts)).toBe(false);
      expect(isTransactionMatchingAccount(tx, 'acc-cash', allAccounts)).toBe(false);
    });

    it('returns true for virtual account when category matches', () => {
      const rentTx: Transaction = {
        ...tx,
        categoryId: 'cat-miete',
      };
      expect(isTransactionMatchingAccount(rentTx, 'acc-virt-wohnen', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(rentTx, 'acc-giro', allAccounts)).toBe(true);
    });

    it('matches transactions on accounts without IBAN when accountIban is account ID', () => {
      const cashTx: Transaction = {
        id: 'tx-c',
        accountIban: 'acc-cash',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Bäcker',
        subject: 'Brot',
        iban: '',
        value: -3.5,
        assignmentSource: 'unassigned',
      };
      expect(isTransactionMatchingAccount(cashTx, 'acc-cash', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(cashTx, 'acc-giro', allAccounts)).toBe(false);
    });

    it('matches Hauptkonto when transaction belongs to its virtual sub-account by category', () => {
      const rentTx: Transaction = {
        id: 'tx-rent',
        accountIban: 'DE44500105175407324900',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
        iban: 'DE88888',
        value: -800,
        categoryId: 'cat-miete',
        assignmentSource: 'manual',
      };
      // Sowohl das Unterkonto als auch das entsprechende Hauptkonto müssen matchen!
      expect(isTransactionMatchingAccount(rentTx, 'acc-virt-wohnen', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(rentTx, 'acc-giro', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(rentTx, 'acc-tagesgeld', allAccounts)).toBe(false);
    });

    it('matches both Unterkonto and Hauptkonto when accountIban is set to the sub-account ID', () => {
      const subTx: Transaction = {
        id: 'tx-sub',
        accountIban: 'acc-virt-wohnen',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Möbelhaus',
        subject: 'Sofa',
        iban: 'DE999',
        value: -400,
        assignmentSource: 'manual',
      };
      expect(isTransactionMatchingAccount(subTx, 'acc-virt-wohnen', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(subTx, 'acc-giro', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(subTx, 'acc-tagesgeld', allAccounts)).toBe(false);
    });

    it('matches target account when transaction is an incoming transfer / counter account', () => {
      const transferTx: Transaction = {
        id: 'tx-transfer',
        accountIban: 'DE44500105175407324900', // Girokonto
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung',
        iban: 'DE44500105175407324995', // Tagesgeld IBAN
        value: -500,
        assignmentSource: 'unassigned',
      };
      // Girokonto (Sender / Buchungskonto) matcht
      expect(isTransactionMatchingAccount(transferTx, 'acc-giro', allAccounts)).toBe(true);
      // Tagesgeld (Empfänger / Gegenkonto) matcht ebenfalls
      expect(isTransactionMatchingAccount(transferTx, 'acc-tagesgeld', allAccounts)).toBe(true);
      // Unbeteiligtes Konto matcht nicht
      expect(isTransactionMatchingAccount(transferTx, 'acc-cash', allAccounts)).toBe(false);
    });
  });

  describe('Directed Money Flow helpers', () => {
    const giroAccount: Account = {
      id: 'acc-giro',
      name: 'Girokonto',
      iban: 'DE11112222',
      accountType: 'real',
      balanceEntries: [],
    };

    const tgAccount: Account = {
      id: 'acc-tg',
      name: 'Tagesgeld',
      iban: 'DE33334444',
      accountType: 'real',
      balanceEntries: [],
    };

    const directedTx: Transaction = {
      id: 'tx-directed-1',
      date: '2026-09-01',
      amount: 960,
      senderIban: 'DE11112222',
      receiverIban: 'DE33334444',
      sender: 'Martin Brehme',
      receiver: 'Martin Brehme Tagesgeld',
      subject: 'Sparübertrag',
      assignmentSource: 'unassigned',
      issuer: 'Martin Brehme',
      iban: 'DE33334444',
      value: -960,
    };

    it('identifies internal transfers between user accounts correctly', async () => {
      const { isInternalTransfer } = await import('./accountService');
      expect(isInternalTransfer(directedTx, [giroAccount, tgAccount])).toBe(true);

      const externalTx: Transaction = {
        id: 'tx-ext',
        date: '2026-09-01',
        amount: 50,
        senderIban: 'DE11112222',
        receiverIban: 'DE99999999',
        sender: 'Martin',
        receiver: 'Rewe',
        subject: 'Einkauf',
        assignmentSource: 'unassigned',
        issuer: 'Martin',
        iban: 'DE99999999',
        value: -50,
      };
      expect(isInternalTransfer(externalTx, [giroAccount, tgAccount])).toBe(false);
    });

    it('derives correct perspective value (-amount for sender, +amount for receiver)', () => {
      // Girokonto ist Sender -> -960 €
      expect(
        getTransactionEffectiveValueForAccount(directedTx, giroAccount, [giroAccount, tgAccount])
      ).toBe(-960);

      // Tagesgeld ist Empfänger -> +960 €
      expect(
        getTransactionEffectiveValueForAccount(directedTx, tgAccount, [giroAccount, tgAccount])
      ).toBe(960);
    });

    it('provides effective partner name based on account perspective', async () => {
      const { getEffectiveTransactionPartner } = await import('./accountService');

      // Aus Sicht des Girokontos: Partner ist der Empfänger (Tagesgeld)
      const partnerGiro = getEffectiveTransactionPartner(directedTx, giroAccount);
      expect(partnerGiro.name).toBe('Martin Brehme Tagesgeld');
      expect(partnerGiro.iban).toBe('DE33334444');

      // Aus Sicht des Tagesgeldkontos: Partner ist der Absender (Girokonto)
      const partnerTg = getEffectiveTransactionPartner(directedTx, tgAccount);
      expect(partnerTg.name).toBe('Martin Brehme');
      expect(partnerTg.iban).toBe('DE11112222');

      // Gesamtansicht: Zeigt von -> zu
      const partnerAll = getEffectiveTransactionPartner(directedTx);
      expect(partnerAll.name).toBe('Martin Brehme → Martin Brehme Tagesgeld');
    });
  });
});
