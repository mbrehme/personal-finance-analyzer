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
  getSubAccountIds,
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
    it('matches primary account by accountIban/senderIban', () => {
      const tx: Transaction = {
        id: 'tx-1',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE999999',
        date: '2026-08-01',
        issuer: 'Supermarkt',
        receiver: 'Martin',
        subject: 'Einkauf',
        value: -50,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.senderAccountId).toBe('acc-giro');
      expect(info.receiverAccountId).toBeUndefined();
      expect(info.includedAccountIds).toEqual(['acc-giro']);
    });

    it('matches primary account by account id when account has no IBAN', () => {
      const tx: Transaction = {
        id: 'tx-cash',
        senderIban: 'acc-cash',
        receiverIban: '',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Bäcker',
        subject: 'Bargeld Einkauf',
        value: -5,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.senderAccountId).toBe('acc-cash');
      expect(info.receiverAccountId).toBeUndefined();
      expect(info.includedAccountIds).toEqual(['acc-cash']);
    });

    it('matches counterAccount for internal transfer between real accounts', () => {
      const tx: Transaction = {
        id: 'tx-transfer',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE44500105175407324995',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung',
        value: -500,
        assignmentSource: 'unassigned',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.senderAccountId).toBe('acc-giro');
      expect(info.receiverAccountId).toBe('acc-tagesgeld');
      expect(info.includedAccountIds).toContain('acc-giro');
      expect(info.includedAccountIds).toContain('acc-tagesgeld');
    });

    it('associates virtual account if category matches and parent matches primaryAccount', () => {
      const tx: Transaction = {
        id: 'tx-rent',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE88888',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
        value: -800,
        categoryId: 'cat-miete',
        assignmentSource: 'manual',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      // Tiefstes Konto für Sender ist das virtuelle Unterkonto 'acc-virt-wohnen'
      expect(info.senderAccountId).toBe('acc-virt-wohnen');
      expect(info.receiverAccountId).toBeUndefined();
      expect(info.includedAccountIds).toEqual(['acc-virt-wohnen']);
    });

    it('correctly identifies senderAccountId and receiverAccountId when booking is on receiver account', () => {
      const tx: Transaction = {
        id: 'tx-incoming-transfer',
        date: '2026-09-07',
        senderIban: giroAccount.iban, // Hauptkonto ist Absender
        receiverIban: tagesgeldAccount.iban, // Tagesgeld ist Empfänger
        issuer: 'Martin Brehme',
        receiver: 'Martin Brehme',
        subject: 'Rücklage Bildung',
        value: 250,
        categoryId: 'cat-buffer',
        assignmentSource: 'auto_regex',
      };

      const info = getTransactionAccountInfo(tx, allAccounts);
      expect(info.senderAccountId).toBe('acc-giro');
      expect(info.receiverAccountId).toBe('acc-virt-buffer');
      expect(info.includedAccountIds).toEqual(['acc-giro', 'acc-virt-buffer']);
    });
  });

  describe('getSubAccountIds', () => {
    it('returns empty array when account has no subaccounts', () => {
      expect(getSubAccountIds(cashAccount, allAccounts)).toEqual([]);
    });

    it('returns subaccount ids for real account with subaccounts', () => {
      expect(getSubAccountIds(giroAccount, allAccounts)).toEqual(['acc-virt-wohnen']);
      expect(getSubAccountIds(tagesgeldAccount, allAccounts)).toEqual(['acc-virt-buffer']);
    });

    it('returns empty array for a virtual account itself', () => {
      expect(getSubAccountIds(virtualWohnen, allAccounts)).toEqual([]);
    });
  });

  describe('getTransactionEffectiveValueForAccount', () => {
    it('returns direct value for primary account', () => {
      const tx: Transaction = {
        id: 'tx-1',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE999999',
        date: '2026-08-01',
        issuer: 'Supermarkt',
        receiver: 'Martin',
        subject: 'Einkauf',
        value: -50,
        assignmentSource: 'unassigned',
      };
      expect(getTransactionEffectiveValueForAccount(tx, giroAccount, allAccounts)).toBe(-50);
      expect(getTransactionEffectiveValueForAccount(tx, tagesgeldAccount, allAccounts)).toBeNull();
    });

    it('returns effective value for virtual account when category matches', () => {
      const tx: Transaction = {
        id: 'tx-rent',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE88888',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
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

    it('does not suppress distinct transactions with the same amount and same sign within the counterpart window', () => {
      const txUrlaub: Transaction = {
        id: 'tx-urlaub-1',
        date: '2026-09-07',
        senderIban: giroAccount.iban,
        receiverIban: tagesgeldAccount.iban,
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 250,
        value: 250,
        subject: 'Rücklage: Urlaub',
        categoryId: null,
        assignmentSource: 'unassigned',
      };

      const txGeschenke: Transaction = {
        id: 'tx-geschenke-2',
        date: '2026-09-07',
        senderIban: giroAccount.iban,
        receiverIban: tagesgeldAccount.iban,
        issuer: 'Denise',
        receiver: 'Martin',
        amount: 250,
        value: 250,
        subject: 'Geschenke',
        categoryId: null,
        assignmentSource: 'unassigned',
      };

      const allTxs = [txUrlaub, txGeschenke];

      expect(
        getTransactionEffectiveValueForAccount(txUrlaub, tagesgeldAccount, allAccounts, allTxs)
      ).toBe(250);
      expect(
        getTransactionEffectiveValueForAccount(txGeschenke, tagesgeldAccount, allAccounts, allTxs)
      ).toBe(250);
    });
  });

  describe('isTransactionMatchingAccount', () => {
    const tx: Transaction = {
      id: 'tx-1',
      senderIban: 'DE44500105175407324900',
      receiverIban: 'DE999999',
      date: '2026-08-01',
      issuer: 'Supermarkt',
      receiver: 'Martin',
      subject: 'Einkauf',
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

    it('matches transactions on accounts without IBAN when senderIban is account ID', () => {
      const cashTx: Transaction = {
        id: 'tx-c',
        senderIban: 'acc-cash',
        receiverIban: '',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Bäcker',
        subject: 'Brot',
        value: -3.5,
        assignmentSource: 'unassigned',
      };
      expect(isTransactionMatchingAccount(cashTx, 'acc-cash', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(cashTx, 'acc-giro', allAccounts)).toBe(false);
    });

    it('matches Hauptkonto when transaction belongs to its virtual sub-account by category', () => {
      const rentTx: Transaction = {
        id: 'tx-rent',
        senderIban: 'DE44500105175407324900',
        receiverIban: 'DE88888',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Vermieter',
        subject: 'Miete',
        value: -800,
        categoryId: 'cat-miete',
        assignmentSource: 'manual',
      };
      // Sowohl das Unterkonto als auch das entsprechende Hauptkonto müssen matchen!
      expect(isTransactionMatchingAccount(rentTx, 'acc-virt-wohnen', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(rentTx, 'acc-giro', allAccounts)).toBe(true);
      expect(isTransactionMatchingAccount(rentTx, 'acc-tagesgeld', allAccounts)).toBe(false);
    });

    it('matches both Unterkonto and Hauptkonto when senderIban is set to the sub-account ID', () => {
      const subTx: Transaction = {
        id: 'tx-sub',
        senderIban: 'acc-virt-wohnen',
        receiverIban: 'DE999',
        date: '2026-08-01',
        issuer: 'Martin',
        receiver: 'Möbelhaus',
        subject: 'Sofa',
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
        senderIban: 'DE44500105175407324900', // Girokonto
        receiverIban: 'DE44500105175407324995', // Tagesgeld IBAN
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung',
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

    it('matches real parent account when transaction is an internal transfer to its virtual sub-account', () => {
      const bufferTransferTx: Transaction = {
        id: 'tx-buffer-transfer',
        senderIban: 'DE44500105175407324900', // Girokonto
        receiverIban: 'DE44500105175407324995', // Tagesgeld IBAN
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Umbuchung Rücklage',
        value: -250,
        categoryId: 'cat-buffer', // gehört zu virtualBuffer unter acc-tagesgeld
        assignmentSource: 'manual',
      };

      // Virtuelles Unterkonto matcht
      expect(isTransactionMatchingAccount(bufferTransferTx, 'acc-virt-buffer', allAccounts)).toBe(
        true
      );
      // Reales Hauptkonto des Unterkontos (Tagesgeld) matcht ebenfalls
      expect(isTransactionMatchingAccount(bufferTransferTx, 'acc-tagesgeld', allAccounts)).toBe(
        true
      );
      // Auch wenn allTransactions übergeben wird, matcht das Hauptkonto
      expect(
        isTransactionMatchingAccount(bufferTransferTx, 'acc-tagesgeld', allAccounts, [
          bufferTransferTx,
        ])
      ).toBe(true);
      // Girokonto matcht
      expect(isTransactionMatchingAccount(bufferTransferTx, 'acc-giro', allAccounts)).toBe(true);

      // Effektiver Wert aus Sicht von Tagesgeld (reales Hauptkonto) muss positiv (+250) sein
      expect(
        getTransactionEffectiveValueForAccount(bufferTransferTx, tagesgeldAccount, allAccounts)
      ).toBe(250);
      // Effektiver Wert aus Sicht des Unterkontos muss positiv (+250) sein
      expect(
        getTransactionEffectiveValueForAccount(bufferTransferTx, virtualBuffer, allAccounts)
      ).toBe(250);
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
