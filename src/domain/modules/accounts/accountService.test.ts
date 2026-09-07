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

  const allAccounts: Account[] = [giroAccount, tagesgeldAccount, cashAccount, virtualWohnen];

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
});
