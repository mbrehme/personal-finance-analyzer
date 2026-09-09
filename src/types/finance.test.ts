/**
 * @file finance.test.ts
 * @description Tests für Helferfunktionen in finance.ts.
 * @module types/finance.test
 */

import { describe, it, expect } from 'vitest';
import {
  buildCompoundSearchField,
  sortTransactionsDesc,
  getTransactionType,
  getTransactionAccountInfo,
  isTransactionMatchingAccount,
  getTransactionEffectiveValueForAccount,
  getTransactionOrigin,
  normalizeIban,
  Account,
  Transaction,
} from './finance';

describe('finance domain helpers', () => {
  it('builds a compound search field with format [Typ] Empfänger: Zweck (Iban)', () => {
    const tx: Transaction = {
      id: 'tx-123',
      date: '2026-09-02',
      issuer: 'Arbeitgeber GmbH',
      receiver: 'Max Mustermann',
      subject: 'Gehaltszahlung August',
      type: 'inbound',
      senderIban: 'DE1234567890',
      receiverIban: 'DE_MY_GIRO',
      value: 3500,
      assignmentSource: 'unassigned',
    };

    const compound = buildCompoundSearchField(tx);
    expect(compound).toBe('[Eingang] Max Mustermann: Gehaltszahlung August (DE1234567890)');

    const txOutbound: Transaction = {
      id: 'tx-124',
      date: '2026-09-02',
      issuer: 'Max Mustermann',
      receiver: 'REWE Markt GmbH',
      subject: 'Kartenzahlung',
      type: 'outbound',
      senderIban: 'DE_MY_GIRO',
      receiverIban: 'DE9876543210',
      value: -42.5,
      assignmentSource: 'unassigned',
    };

    const compoundOutbound = buildCompoundSearchField(txOutbound);
    expect(compoundOutbound).toBe('[Ausgang] REWE Markt GmbH: Kartenzahlung (DE9876543210)');
  });

  it('sorts transactions by date descending and preserves CSV dayIndex order for same date', () => {
    const tx1: Transaction = {
      id: 'tx-1',
      date: '2026-08-10',
      issuer: 'Rewe',
      receiver: 'Me',
      subject: 'Einkauf',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -20,
      assignmentSource: 'unassigned',
      dayIndex: 0,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const tx2: Transaction = {
      id: 'tx-2',
      date: '2026-08-10',
      issuer: 'Apotheke',
      receiver: 'Me',
      subject: 'Medikamente',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -15,
      assignmentSource: 'unassigned',
      dayIndex: 1,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const tx3: Transaction = {
      id: 'tx-3',
      date: '2026-08-20',
      issuer: 'Gehalt',
      receiver: 'Me',
      subject: 'Lohn',
      type: 'inbound',
      senderIban: '',
      receiverIban: '',
      value: 3000,
      assignmentSource: 'unassigned',
      dayIndex: 2,
      importFilename: 'statement.csv',
      importedAt: '2026-09-01T10:00:00.000Z',
    };

    const sorted = sortTransactionsDesc([tx2, tx1, tx3]);
    // Neuestes Datum zuerst
    expect(sorted[0].id).toBe('tx-3');
    // Am gleichen Tag: dayIndex 0 vor dayIndex 1
    expect(sorted[1].id).toBe('tx-1');
    expect(sorted[2].id).toBe('tx-2');
  });

  it('places split child transactions directly adjacent to their parent transaction', () => {
    const parentTx: Transaction = {
      id: 'tx-parent',
      date: '2026-07-20',
      issuer: 'Supermarkt',
      receiver: 'Me',
      subject: 'Einkauf Rest',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -36.29,
      assignmentSource: 'unassigned',
      dayIndex: 0,
    };

    const unrelatedTx1: Transaction = {
      id: 'tx-unrelated-1',
      date: '2026-07-20',
      issuer: 'Café',
      receiver: 'Me',
      subject: 'Kaffee',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -28.33,
      assignmentSource: 'unassigned',
      dayIndex: 1,
    };

    const unrelatedTx2: Transaction = {
      id: 'tx-unrelated-2',
      date: '2026-07-20',
      issuer: 'Strandcafé',
      receiver: 'Me',
      subject: 'Snack',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -14.0,
      assignmentSource: 'unassigned',
      dayIndex: 2,
    };

    const splitChildTx: Transaction = {
      id: 'tx-split-child',
      splitFromId: 'tx-parent',
      date: '2026-07-20',
      issuer: 'Supermarkt',
      receiver: 'Me',
      subject: 'Einkauf Teilbetrag',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -80.0,
      assignmentSource: 'unassigned',
    };

    const sorted = sortTransactionsDesc([unrelatedTx2, unrelatedTx1, parentTx, splitChildTx]);
    const ids = sorted.map((t) => t.id);

    // Parent and child must be directly consecutive: tx-parent immediately followed by tx-split-child
    expect(ids).toEqual(['tx-parent', 'tx-split-child', 'tx-unrelated-1', 'tx-unrelated-2']);
  });

  it('sorts orphaned split child chronologically when parent is missing/deleted', () => {
    const tx1: Transaction = {
      id: 'tx-1',
      date: '2026-09-03',
      issuer: 'A',
      receiver: 'B',
      subject: 'Newest',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -10,
      assignmentSource: 'unassigned',
    };
    const orphanChild: Transaction = {
      id: 'tx-orphan',
      splitFromId: 'tx-deleted-parent',
      date: '2026-09-02',
      issuer: 'A',
      receiver: 'B',
      subject: 'Middle',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -20,
      assignmentSource: 'unassigned',
    };
    const tx3: Transaction = {
      id: 'tx-3',
      date: '2026-09-01',
      issuer: 'A',
      receiver: 'B',
      subject: 'Oldest',
      type: 'outbound',
      senderIban: '',
      receiverIban: '',
      value: -30,
      assignmentSource: 'unassigned',
    };

    const sorted = sortTransactionsDesc([tx3, orphanChild, tx1]);
    expect(sorted.map((t) => t.id)).toEqual(['tx-1', 'tx-orphan', 'tx-3']);
  });

  it('determines virtual transaction type purely based on value sign', () => {
    // getTransactionType with numbers
    expect(getTransactionType(100)).toBe('inbound');
    expect(getTransactionType(0)).toBe('inbound');
    expect(getTransactionType(-0.01)).toBe('outbound');
    expect(getTransactionType(-500)).toBe('outbound');

    // getTransactionType with transaction objects without static type property
    const inboundTx: Partial<Transaction> = { value: 250 };
    const outboundTx: Partial<Transaction> = { value: -12.99 };

    expect(getTransactionType(inboundTx as Transaction)).toBe('inbound');
    expect(getTransactionType(outboundTx as Transaction)).toBe('outbound');

    // buildCompoundSearchField uses virtual getTransactionType
    const searchInbound = buildCompoundSearchField({
      value: 100,
      receiver: 'Max',
      subject: 'Bonus',
      senderIban: 'DE11',
      receiverIban: 'DE_MY_GIRO',
    } as Transaction);
    expect(searchInbound).toContain('[Eingang]');

    const searchOutbound = buildCompoundSearchField({
      value: -50,
      receiver: 'Rewe',
      subject: 'Einkauf',
      senderIban: 'DE_MY_GIRO',
      receiverIban: 'DE22',
    } as Transaction);
    expect(searchOutbound).toContain('[Ausgang]');
  });

  it('resets a modified transaction back to original bank values and unassigns category', async () => {
    const { resetTransactionToOriginal, isTransactionOverridden } = await import('./finance');

    const modifiedTx: Transaction = {
      id: 'tx-override-1',
      senderIban: 'DE2222',
      originalSenderIban: 'DE1111',
      receiverIban: 'DE9999',
      originalReceiverIban: 'DE1111',
      date: '2026-08-15',
      originalDate: '2026-08-10',
      issuer: 'Manuell Sender',
      originalIssuer: 'Bank Sender',
      receiver: 'Manuell Empfänger',
      originalReceiver: 'Bank Empfänger',
      subject: 'Manuell Verwendungszweck',
      originalSubject: 'Bank Verwendungszweck',
      value: -100,
      originalValue: -50,
      categoryId: 'cat-1',
      assignmentSource: 'manual',
      origin: 'imported',
      splitFromId: 'tx-parent',
      deletedAt: '2026-08-20T12:00:00.000Z',
    };

    expect(isTransactionOverridden(modifiedTx)).toBe(true);

    const restored = resetTransactionToOriginal(modifiedTx);

    expect(restored.id).toBe('tx-override-1');
    expect(restored.senderIban).toBe('DE1111');
    expect(restored.receiverIban).toBe('DE1111');
    expect(restored.date).toBe('2026-08-10');
    expect(restored.issuer).toBe('Bank Sender');
    expect(restored.receiver).toBe('Bank Empfänger');
    expect(restored.subject).toBe('Bank Verwendungszweck');
    expect(restored.value).toBe(-50);
    expect(restored.categoryId).toBeNull();
    expect(restored.assignmentSource).toBe('unassigned');
    expect(restored.splitFromId).toBeUndefined();
    expect(restored.deletedAt).toBeUndefined();
    expect(isTransactionOverridden(restored)).toBe(false);
  });

  it('normalizes IBAN by removing spaces and capitalizing', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
    expect(normalizeIban('DE12345')).toBe('DE12345');
    expect(normalizeIban('')).toBe('');
    expect(normalizeIban(undefined)).toBe('');
  });

  it('determines all accounts for a transaction (primary, counter-account and virtual subaccounts)', () => {
    const accounts = [
      {
        id: 'acc-giro',
        name: 'Girokonto',
        accountType: 'real' as const,
        iban: 'DE1111',
        balanceEntries: [],
      },
      {
        id: 'acc-tagesgeld',
        name: 'Tagesgeld',
        accountType: 'real' as const,
        iban: 'DE2222',
        balanceEntries: [],
      },
      {
        id: 'acc-sub-urlaub',
        name: 'Urlaubstopf',
        accountType: 'virtual' as const,
        parentAccountId: 'acc-giro',
        categoryIds: ['cat-urlaub'],
        balanceEntries: [],
      },
    ];

    // 1. Umbuchung von Girokonto auf Tagesgeld
    const transferTx: Transaction = {
      id: 'tx-transfer',
      senderIban: 'DE1111',
      receiverIban: 'DE2222',
      date: '2026-08-10',
      issuer: 'Martin',
      receiver: 'Tagesgeld',
      subject: 'Umbuchung Tagesgeld',
      value: -500,
      assignmentSource: 'unassigned',
    };

    const transferInfo = getTransactionAccountInfo(transferTx, accounts);
    expect(transferInfo.senderAccountId).toBe('acc-giro');
    expect(transferInfo.receiverAccountId).toBe('acc-tagesgeld');
    expect(transferInfo.includedAccountIds).toContain('acc-giro');
    expect(transferInfo.includedAccountIds).toContain('acc-tagesgeld');

    expect(isTransactionMatchingAccount(transferTx, 'acc-giro', accounts)).toBe(true);
    // Gegenkonto matcht auch (Eingänge / Übertrag aus Sicht des Zielkontos im Transaktions-Filter)
    expect(isTransactionMatchingAccount(transferTx, 'acc-tagesgeld', accounts)).toBe(true);
    expect(isTransactionMatchingAccount(transferTx, 'acc-sub-urlaub', accounts)).toBe(false);

    // 2. Buchung auf Girokonto, die zum virtuellen Unterkonto Urlaubstopf gehört
    const vacationTx: Transaction = {
      id: 'tx-vacation',
      senderIban: 'DE1111',
      receiverIban: 'DE9999',
      date: '2026-08-12',
      issuer: 'Martin',
      receiver: 'Lufthansa',
      subject: 'Flugticket',
      value: -300,
      categoryId: 'cat-urlaub',
      assignmentSource: 'unassigned',
    };

    const vacationInfo = getTransactionAccountInfo(vacationTx, accounts);
    expect(vacationInfo.senderAccountId).toBe('acc-sub-urlaub');
    expect(vacationInfo.receiverAccountId).toBeUndefined();
    expect(vacationInfo.includedAccountIds).toEqual(['acc-sub-urlaub']);

    expect(isTransactionMatchingAccount(vacationTx, 'acc-giro', accounts)).toBe(true);
    expect(isTransactionMatchingAccount(vacationTx, 'acc-sub-urlaub', accounts)).toBe(true);
    expect(isTransactionMatchingAccount(vacationTx, 'acc-tagesgeld', accounts)).toBe(false);

    // 3. Transaktion OHNE accountId, rein über accountIban und categoryId aufgelöst
    const purelyVirtualTx: Transaction = {
      id: 'tx-no-account-id',
      senderIban: 'DE1111',
      receiverIban: 'DE7777',
      date: '2026-08-15',
      issuer: 'Martin',
      receiver: 'Hotel Strandlust',
      subject: 'Urlaub Übernachtung',
      value: -150,
      categoryId: 'cat-urlaub',
      assignmentSource: 'unassigned',
    };

    const purelyVirtualInfo = getTransactionAccountInfo(purelyVirtualTx, accounts);
    expect(purelyVirtualInfo.senderAccountId).toBe('acc-sub-urlaub');
    expect(purelyVirtualInfo.receiverAccountId).toBeUndefined();
    expect(purelyVirtualInfo.includedAccountIds).toEqual(['acc-sub-urlaub']);

    expect(isTransactionMatchingAccount(purelyVirtualTx, 'acc-giro', accounts)).toBe(true);
    expect(isTransactionMatchingAccount(purelyVirtualTx, 'acc-sub-urlaub', accounts)).toBe(true);
    expect(isTransactionMatchingAccount(purelyVirtualTx, 'acc-tagesgeld', accounts)).toBe(false);
  });

  describe('getTransactionEffectiveValueForAccount', () => {
    const giroAcc: Account = {
      id: 'acc-giro',
      name: 'Girokonto',
      accountType: 'real',
      iban: 'DE1111',
      balanceEntries: [],
    };

    const tagesgeldAcc: Account = {
      id: 'acc-tg',
      name: 'Tagesgeld',
      accountType: 'real',
      iban: 'DE2222',
      balanceEntries: [],
    };

    const creditCardAcc: Account = {
      id: 'acc-cc',
      name: 'Kreditkarte',
      accountType: 'real',
      iban: 'DE3333',
      balanceEntries: [],
    };

    const savingsPot: Account = {
      id: 'acc-sub-savings',
      name: 'Sparen Topf',
      accountType: 'virtual',
      parentAccountId: 'acc-tg',
      categoryIds: ['cat-sparen'],
      balanceEntries: [],
    };

    const vacationPotOnGiro: Account = {
      id: 'acc-sub-urlaub-giro',
      name: 'Urlaub Giro',
      accountType: 'virtual',
      parentAccountId: 'acc-giro',
      categoryIds: ['cat-urlaub'],
      balanceEntries: [],
    };

    const allAccounts = [giroAcc, tagesgeldAcc, creditCardAcc, savingsPot, vacationPotOnGiro];

    it('inverts sign on transfer receipt for recipient real account and its virtual accounts, but avoids double-counting if direct statement exists', () => {
      // Überweisung von Girokonto auf Tagesgeld für Kategorie "Sparen"
      const transferTx: Transaction = {
        id: 'tx-transfer-savings',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeldkonto',
        subject: 'Monatliches Sparen',
        value: -500,
        categoryId: 'cat-sparen',
        assignmentSource: 'manual',
      };

      // 1. Für Girokonto (Sender/Primär): Abgang -500 €
      expect(getTransactionEffectiveValueForAccount(transferTx, giroAcc, allAccounts)).toBe(-500);

      // 2. Für Tagesgeld (Empfänger/Gegenkonto als echtes Bankkonto):
      // Erhält +500 €, wenn kein eigener Auszug mit direkter Buchung vorliegt
      expect(getTransactionEffectiveValueForAccount(transferTx, tagesgeldAcc, allAccounts)).toBe(
        500
      );

      // Falls ein eigener Tagesgeld-Auszug vorliegt: Doppelzählung verhindern
      const directTgTx: Transaction = {
        id: 'tx-tg-direct',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeldkonto',
        subject: 'Monatliches Sparen',
        value: 500,
        assignmentSource: 'unassigned',
      };
      expect(
        getTransactionEffectiveValueForAccount(transferTx, tagesgeldAcc, allAccounts, [
          transferTx,
          directTgTx,
        ])
      ).toBeNull();

      // 3. Für Virtuelles Konto "Sparen Topf" unter Tagesgeld: Positiver Eingang +500 €
      expect(getTransactionEffectiveValueForAccount(transferTx, savingsPot, allAccounts)).toBe(500);

      // 4. Für anderes virtuelles Konto "Urlaub Giro": Betrifft es nicht (Kategorie falsch + falsches Elternkonto)
      expect(
        getTransactionEffectiveValueForAccount(transferTx, vacationPotOnGiro, allAccounts)
      ).toBeNull();

      // 5. Für unbeteiligte Kreditkarte: Betrifft sie nicht
      expect(
        getTransactionEffectiveValueForAccount(transferTx, creditCardAcc, allAccounts)
      ).toBeNull();
    });

    it('excludes transactions from virtual account if category was used on an unrelated account', () => {
      // Buchung auf Kreditkarte mit Kategorie 'cat-urlaub'
      const ccVacationTx: Transaction = {
        id: 'tx-cc-vacation',
        senderIban: 'DE3333',
        receiverIban: 'DE9999',
        date: '2026-08-11',
        issuer: 'Martin',
        receiver: 'Hotel Roma',
        subject: 'Hotel',
        value: -200,
        categoryId: 'cat-urlaub',
        assignmentSource: 'manual',
      };

      // Kreditkarte ist das primäre Konto: -200
      expect(getTransactionEffectiveValueForAccount(ccVacationTx, creditCardAcc, allAccounts)).toBe(
        -200
      );

      // Virtuelles Konto "Urlaub Giro" gehört zu Girokonto (DE1111), NICHT zur Kreditkarte (DE3333)!
      // Darf NICHT einbezogen werden:
      expect(
        getTransactionEffectiveValueForAccount(ccVacationTx, vacationPotOnGiro, allAccounts)
      ).toBeNull();

      // Girokonto selbst wird ebenfalls nicht berührt:
      expect(getTransactionEffectiveValueForAccount(ccVacationTx, giroAcc, allAccounts)).toBeNull();
    });

    it('returns null for virtual account without parentAccountId', () => {
      const orphanVirtual: Account = {
        id: 'acc-orphan',
        name: 'Verwaist',
        accountType: 'virtual',
        parentAccountId: null,
        categoryIds: ['cat-sparen'],
        balanceEntries: [],
      };

      const tx: Transaction = {
        id: 'tx-orphan-test',
        senderIban: 'DE1111',
        receiverIban: 'DE2222',
        date: '2026-08-10',
        issuer: 'Martin',
        receiver: 'Tagesgeld',
        subject: 'Sparen',
        value: -500,
        categoryId: 'cat-sparen',
        assignmentSource: 'manual',
      };

      expect(
        getTransactionEffectiveValueForAccount(tx, orphanVirtual, [...allAccounts, orphanVirtual])
      ).toBeNull();
    });
  });

  describe('getTransactionOrigin', () => {
    it('returns "split" when transaction is derived from a split (splitFromId present)', () => {
      const splitChildTx: Transaction = {
        id: 'tx-split-1',
        splitFromId: 'tx-parent',
        value: -20,
      } as any;

      expect(getTransactionOrigin(splitChildTx)).toBe('split');
    });

    it('returns "override" when transaction is manually overridden or has legacy manual origin', () => {
      const overriddenTx: Transaction = {
        id: 'tx-overridden',
        value: -50,
        subject: 'Neuer Zweck',
        originalSubject: 'Alter Bank-Zweck',
        origin: 'imported',
      } as any;

      expect(getTransactionOrigin(overriddenTx)).toBe('override');

      const legacyManualTx: Transaction = {
        id: 'tx-legacy-man',
        value: -30,
        origin: 'override',
      } as any;

      expect(getTransactionOrigin(legacyManualTx)).toBe('override');

      const explicitOverrideTx: Transaction = {
        id: 'tx-override-explicit',
        value: -30,
        origin: 'override',
      } as any;

      expect(getTransactionOrigin(explicitOverrideTx)).toBe('override');
    });

    it('returns "imported" for unaltered bank transactions', () => {
      const importedTx: Transaction = {
        id: 'tx-imported',
        value: -100,
        subject: 'REWE Markt',
        origin: 'imported',
      } as any;

      expect(getTransactionOrigin(importedTx)).toBe('imported');
    });
  });

  describe('sortTransactionsDesc with dayIndex', () => {
    it('sorts primarily by date descending, then dayIndex ascending for same date', () => {
      const txDay0: Transaction = {
        id: 'tx-d0',
        date: '2026-08-10',
        value: -10,
        dayIndex: 0,
      } as any;

      const txDay1: Transaction = {
        id: 'tx-d1',
        date: '2026-08-10',
        value: -20,
        dayIndex: 1,
      } as any;

      const txDay2: Transaction = {
        id: 'tx-d2',
        date: '2026-08-10',
        value: -30,
        dayIndex: 2,
      } as any;

      const txYesterday: Transaction = {
        id: 'tx-yesterday',
        date: '2026-08-09',
        value: -50,
        dayIndex: 0,
      } as any;

      // Pass in mixed order
      const sorted = sortTransactionsDesc([txDay2, txYesterday, txDay0, txDay1]);

      expect(sorted.map((t) => t.id)).toEqual(['tx-d0', 'tx-d1', 'tx-d2', 'tx-yesterday']);
    });
  });
});
