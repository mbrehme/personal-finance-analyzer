/**
 * @file accountService.ts
 * @description Reine Domänen-Logik und Berechnungen für Konten und Kontostände (Schicht 3).
 * Hängt ausschließlich von types/ ab.
 * @module domain/modules/accounts/accountService
 */

import { Account, Transaction } from '@/types';

/**
 * Normalisiert eine IBAN durch Entfernen von Leerzeichen und Konvertierung in Großbuchstaben.
 *
 * @param {string} [iban] - Zu normalisierende IBAN
 * @returns {string} Bereinigte IBAN (z. B. 'DE89370400440532013000')
 */
export function normalizeIban(iban?: string): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
}

export interface TransactionAccountInfo {
  primaryAccount?: Account;
  counterAccount?: Account;
  virtualAccounts: Account[];
  allAccounts: Account[];
}

/**
 * Ermittelt alle Konten, die einer Transaktion zugeordnet sind.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account[]} accounts - Alle Konten
 * @returns {TransactionAccountInfo}
 */
export function getTransactionAccountInfo(
  tx: Transaction,
  accounts: Account[]
): TransactionAccountInfo {
  const normSenderIban = normalizeIban(tx.senderIban);
  const normReceiverIban = normalizeIban(tx.receiverIban);
  const normAccountIban = normalizeIban(tx.accountIban);
  const normTxIban = normalizeIban(tx.iban);

  let primaryAccount: Account | undefined;
  let counterAccount: Account | undefined;

  // 1. Gerichtete Auflösung über senderIban und receiverIban
  if (normSenderIban || normReceiverIban) {
    const senderAcc = accounts.find(
      (a) =>
        a.accountType !== 'virtual' &&
        Boolean((a.iban && normalizeIban(a.iban) === normSenderIban) || a.id === tx.senderIban)
    );
    const receiverAcc = accounts.find(
      (a) =>
        a.accountType !== 'virtual' &&
        Boolean((a.iban && normalizeIban(a.iban) === normReceiverIban) || a.id === tx.receiverIban)
    );

    if (senderAcc && receiverAcc) {
      // Interne Umbuchung: primäres Konto ist Absender, Gegenkonto ist Empfänger
      primaryAccount = senderAcc;
      counterAccount = receiverAcc;
    } else if (senderAcc) {
      primaryAccount = senderAcc;
    } else if (receiverAcc) {
      primaryAccount = receiverAcc;
    }
  }

  // 2. Fallback für Legacy-Felder (accountIban / iban)
  if (!primaryAccount) {
    if (normAccountIban || tx.accountIban) {
      primaryAccount = accounts.find(
        (a) =>
          a.accountType !== 'virtual' &&
          Boolean((a.iban && normalizeIban(a.iban) === normAccountIban) || a.id === tx.accountIban)
      );
    }
    if (!primaryAccount && (normTxIban || tx.iban)) {
      primaryAccount = accounts.find(
        (a) =>
          a.accountType !== 'virtual' &&
          Boolean((a.iban && normalizeIban(a.iban) === normTxIban) || a.id === tx.iban)
      );
    }

    // Falls tx.accountIban die ID eines virtuellen Unterkontos ist, Hauptkonto über parentAccountId ermitteln
    if (!primaryAccount && (normAccountIban || tx.accountIban)) {
      const matchedVirtual = accounts.find(
        (a) =>
          a.accountType === 'virtual' &&
          Boolean(a.id === tx.accountIban || (a.iban && normalizeIban(a.iban) === normAccountIban))
      );
      if (matchedVirtual && matchedVirtual.parentAccountId) {
        primaryAccount = accounts.find((a) => a.id === matchedVirtual.parentAccountId);
      }
    }
  }

  if (!counterAccount && primaryAccount && (normTxIban || tx.iban)) {
    counterAccount = accounts.find(
      (a) =>
        a.id !== primaryAccount!.id &&
        a.accountType !== 'virtual' &&
        Boolean((a.iban && normalizeIban(a.iban) === normTxIban) || a.id === tx.iban)
    );
  }

  // Ergänzend: Gegenkonto anhand von Empfänger / Sender (tx.receiver / tx.issuer) zuordnen, falls IBAN fehlt
  if (!counterAccount && primaryAccount) {
    const normReceiver = (tx.receiver || '').trim().toLowerCase();
    const normIssuer = (tx.issuer || tx.sender || '').trim().toLowerCase();

    if (normReceiver || normIssuer) {
      counterAccount = accounts.find((a) => {
        if (a.id === primaryAccount!.id || a.accountType === 'virtual') return false;
        const normName = a.name.trim().toLowerCase();
        if (!normName) return false;
        return normName === normReceiver || normName === normIssuer;
      });
    }
  }

  const txCatId = tx.categoryId ?? null;
  const virtualAccounts = accounts.filter((a) => {
    if (a.accountType !== 'virtual') return false;
    const catIds = a.categoryIds || [];
    if (catIds.length > 0 && (!txCatId || !catIds.includes(txCatId))) return false;

    if (a.parentAccountId) {
      const isUnderPrimary = primaryAccount ? a.parentAccountId === primaryAccount.id : false;
      const isUnderCounter = counterAccount ? a.parentAccountId === counterAccount.id : false;
      return isUnderPrimary || isUnderCounter;
    }
    return false;
  });

  // Falls tx.accountIban direkt die ID eines virtuellen Unterkontos ist, dieses zu virtualAccounts ergänzen
  if (tx.accountIban) {
    const directVirtual = accounts.find(
      (a) => a.accountType === 'virtual' && a.id === tx.accountIban
    );
    if (directVirtual && !virtualAccounts.some((v) => v.id === directVirtual.id)) {
      virtualAccounts.push(directVirtual);
    }
  }

  const accountMap = new Map<string, Account>();
  if (primaryAccount) accountMap.set(primaryAccount.id, primaryAccount);
  if (counterAccount) accountMap.set(counterAccount.id, counterAccount);
  virtualAccounts.forEach((v) => accountMap.set(v.id, v));

  return {
    primaryAccount,
    counterAccount,
    virtualAccounts,
    allAccounts: Array.from(accountMap.values()),
  };
}

/**
 * Prüft, ob in der Transaktionsliste bereits eine eigenständige Gegenbuchung existiert.
 * Dies verhindert Doppelzählungen, wenn für beide an einer Umbuchung beteiligten Konten
 * eigene Kontoauszüge importiert wurden.
 *
 * @param {Transaction} tx - Die Ausgangsbuchung
 * @param {Account} primaryAccount - Das primäre Buchungskonto der Ausgangsbuchung
 * @param {Account} counterAccount - Das Gegenkonto
 * @param {Transaction[]} allTransactions - Alle Transaktionen
 * @param {Account[]} accounts - Alle Konten
 * @returns {boolean} true, wenn eine eigenständige Gegenbuchung existiert
 */
export function hasDirectCounterpart(
  tx: Transaction,
  primaryAccount: Account,
  counterAccount: Account,
  allTransactions: Transaction[],
  accounts: Account[]
): boolean {
  const txTime = new Date(tx.date).getTime();

  return allTransactions.some((other) => {
    if (other.id === tx.id) return false;
    if (other.value !== -tx.value) return false;

    // Datumstoleranz von bis zu 4 Tagen für bankübliche Wertstellungs-Laufzeiten
    const otherTime = new Date(other.date).getTime();
    if (!isNaN(txTime) && !isNaN(otherTime)) {
      if (Math.abs(otherTime - txTime) > 4 * 24 * 60 * 60 * 1000) return false;
    }

    const otherInfo = getTransactionAccountInfo(other, accounts);
    if (otherInfo.primaryAccount?.id !== counterAccount.id) return false;

    // 1. Explizite Gegenkonto-Zuordnung
    if (otherInfo.counterAccount?.id === primaryAccount.id) return true;

    // 2. IBAN-Übereinstimmung (Gegen-IBAN von other matcht primaryAccount, oder tx.iban matcht other.accountIban)
    if (
      (primaryAccount.iban && normalizeIban(other.iban) === normalizeIban(primaryAccount.iban)) ||
      (other.accountIban &&
        primaryAccount.iban &&
        normalizeIban(other.accountIban) === normalizeIban(primaryAccount.iban)) ||
      (counterAccount.iban &&
        tx.iban &&
        normalizeIban(tx.iban) === normalizeIban(counterAccount.iban)) ||
      (tx.accountIban &&
        counterAccount.iban &&
        normalizeIban(tx.accountIban) === normalizeIban(counterAccount.iban))
    ) {
      return true;
    }

    // 3. Verwendungszweck-Übereinstimmung bei identischem Gegenwert im Zeitfenster
    const normTxSubject = (tx.subject || '').trim().toLowerCase();
    const normOtherSubject = (other.subject || '').trim().toLowerCase();
    if (normTxSubject && normOtherSubject && normTxSubject === normOtherSubject) {
      return true;
    }

    // 4. Partner-Übereinstimmung
    const normTxPartner = (tx.receiver || tx.issuer || '').trim().toLowerCase();
    const normOtherPartner = (other.receiver || other.issuer || '').trim().toLowerCase();
    if (normTxPartner && normOtherPartner && normTxPartner === normOtherPartner) {
      return true;
    }

    return false;
  });
}

/**
 * Prüft, ob eine Transaktion eine interne Umbuchung zwischen zwei bekannten Nutzerkonten darstellt.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {Account[]} accounts - Alle registrierten Konten des Nutzers
 * @returns {boolean} true, falls sowohl Absender- als auch Empfängerkonto registrierte Nutzerkonten sind
 */
export function isInternalTransfer(tx: Transaction, accounts: Account[]): boolean {
  const normSenderIban = normalizeIban(tx.senderIban);
  const normReceiverIban = normalizeIban(tx.receiverIban);

  if (normSenderIban && normReceiverIban) {
    const hasSender = accounts.some(
      (a) =>
        a.accountType !== 'virtual' &&
        Boolean((a.iban && normalizeIban(a.iban) === normSenderIban) || a.id === tx.senderIban)
    );
    const hasReceiver = accounts.some(
      (a) =>
        a.accountType !== 'virtual' &&
        Boolean((a.iban && normalizeIban(a.iban) === normReceiverIban) || a.id === tx.receiverIban)
    );
    if (hasSender && hasReceiver) return true;
  }

  // Fallback über Account-Info
  const info = getTransactionAccountInfo(tx, accounts);
  return Boolean(info.primaryAccount && info.counterAccount);
}

/**
 * Liefert den effektiven Transaktionspartner (Name und ggf. IBAN) abhängig von
 * der Kontoperspektive oder für die Gesamtansicht.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} [currentAccount] - Das aktuell ausgewählte Konto (falls gefiltert)
 * @returns {{ name: string; iban?: string }} Partnerinformation
 */
export function getEffectiveTransactionPartner(
  tx: Transaction,
  currentAccount?: Account
): { name: string; iban?: string } {
  if (currentAccount) {
    const normAccIban = normalizeIban(currentAccount.iban);
    const isSender = Boolean(
      (normAccIban && tx.senderIban && normAccIban === normalizeIban(tx.senderIban)) ||
      currentAccount.id === tx.senderIban ||
      (currentAccount.iban &&
        tx.accountIban &&
        normalizeIban(currentAccount.iban) === normalizeIban(tx.accountIban) &&
        tx.value < 0)
    );

    if (isSender) {
      return {
        name: tx.receiver || tx.issuer || 'Unbekannter Empfänger',
        iban: tx.receiverIban || tx.iban,
      };
    } else {
      return {
        name: tx.sender || tx.issuer || 'Unbekannter Absender',
        iban: tx.senderIban || tx.iban,
      };
    }
  }

  // Gesamtsicht:
  if (tx.sender && tx.receiver && tx.sender !== tx.receiver) {
    return {
      name: `${tx.sender} → ${tx.receiver}`,
      iban: tx.receiverIban || tx.senderIban,
    };
  }

  return {
    name: tx.receiver || tx.issuer || tx.sender || 'Unbekannt',
    iban: tx.receiverIban || tx.senderIban || tx.iban,
  };
}

/**
 * Ermittelt den effektiven Betrag einer Transaktion aus Sicht eines bestimmten Kontos.
 *
 * Für echte Konten:
 * - Wenn das Konto Absender (senderIban) ist: `-amount` (bzw. `-tx.value`)
 * - Wenn das Konto Empfänger (receiverIban) ist: `+amount` (bzw. `+tx.value`)
 * - Legacy-Fallback: Direkte Buchung (`tx.value`) oder Gegenkonto (`-tx.value`).
 *
 * Für virtuelle Unterkonten:
 * - Auswertung anhand zugeordneter Kategorien unter dem übergeordneten Hauptkonto.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} targetAccount - Das Zielkonto
 * @param {Account[]} accounts - Alle Konten
 * @param {Transaction[]} [allTransactions] - Alle Transaktionen (zur Erkennung historischer Gegenbuchungen)
 * @returns {number | null} Effektiver Betrag oder null
 */
export function getTransactionEffectiveValueForAccount(
  tx: Transaction,
  targetAccount: Account,
  accounts: Account[],
  allTransactions?: Transaction[]
): number | null {
  const normTargetIban = normalizeIban(targetAccount.iban);
  const normSenderIban = normalizeIban(tx.senderIban);
  const normReceiverIban = normalizeIban(tx.receiverIban);
  const amount = tx.amount !== undefined ? tx.amount : Math.abs(tx.value);

  // 1. Virtuelle Unterkonten
  if (targetAccount.accountType === 'virtual') {
    const info = getTransactionAccountInfo(tx, accounts);
    if (!info.virtualAccounts.some((v) => v.id === targetAccount.id)) {
      return null;
    }
    if (info.counterAccount && targetAccount.parentAccountId === info.counterAccount.id) {
      if (allTransactions) {
        const hasDirectVirtualBooking = allTransactions.some((other) => {
          if (other.id === tx.id || other.value !== -tx.value) return false;
          const otherInfo = getTransactionAccountInfo(other, accounts);
          return (
            otherInfo.primaryAccount?.id === targetAccount.parentAccountId &&
            otherInfo.virtualAccounts.some((v) => v.id === targetAccount.id)
          );
        });
        if (hasDirectVirtualBooking) {
          return null;
        }
      }
      return -tx.value;
    }
    return tx.value;
  }

  // 2. Echtes Konto mit expliziter gerichteter Absender- oder Empfänger-IBAN
  const isSender = Boolean(
    (normTargetIban && normSenderIban && normTargetIban === normSenderIban) ||
    targetAccount.id === tx.senderIban
  );
  const isReceiver = Boolean(
    (normTargetIban && normReceiverIban && normTargetIban === normReceiverIban) ||
    targetAccount.id === tx.receiverIban
  );

  if (isSender && isReceiver) {
    // Umbuchung auf dasselbe Konto (Netto 0)
    return 0;
  }

  if (isSender) {
    return -amount;
  }

  if (isReceiver) {
    return amount;
  }

  // 3. Fallback für Transaktionen ohne explizite senderIban / receiverIban (Legacy-Modus)
  const info = getTransactionAccountInfo(tx, accounts);

  // Direktes Buchungskonto (Hauptkonto)
  if (info.primaryAccount && info.primaryAccount.id === targetAccount.id) {
    return tx.value;
  }

  // Gegenkonto (Hauptkonto war Sender oder Empfänger einer Umbuchung)
  if (info.counterAccount && info.counterAccount.id === targetAccount.id) {
    if (
      allTransactions &&
      info.primaryAccount &&
      hasDirectCounterpart(tx, info.primaryAccount, info.counterAccount, allTransactions, accounts)
    ) {
      return null;
    }
    return -tx.value;
  }

  return null;
}

/**
 * Prüft, ob eine Transaktion mit einem Konto-Filter übereinstimmt.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {string} accountId - Die Konto-ID oder 'all'
 * @param {Account[]} accounts - Alle Konten
 * @param {Transaction[]} [allTransactions] - Alle Transaktionen (zur Vermeidung von Gegenbuchungs-Duplikaten)
 * @returns {boolean}
 */
export function isTransactionMatchingAccount(
  tx: Transaction,
  accountId: string,
  accounts: Account[],
  allTransactions?: Transaction[]
): boolean {
  if (accountId === 'all') return true;
  const targetAcc = accounts.find((a) => a.id === accountId);
  if (!targetAcc) {
    const info = getTransactionAccountInfo(tx, accounts);
    return info.allAccounts.some((a) => a.id === accountId);
  }

  // 1. Direktes Matching über den effektiven Kontowert (deckt virtuelle Unterkonten und direkte Hauptkontobuchungen ab)
  if (getTransactionEffectiveValueForAccount(tx, targetAcc, accounts, allTransactions) !== null) {
    return true;
  }

  // Wenn allTransactions übergeben wurde und getTransactionEffectiveValueForAccount null liefert,
  // existiert für dieses Konto bereits eine eigenständige Buchung oder die Buchung betrifft das Konto nicht.
  if (allTransactions) {
    return false;
  }

  const info = getTransactionAccountInfo(tx, accounts);

  // 2. Gegenkonto bei Umbuchungen (Fallback wenn keine allTransactions Prüfung vorliegt)
  if (info.counterAccount) {
    if (info.counterAccount.id === targetAcc.id) {
      return true;
    }
    if (
      targetAcc.accountType !== 'virtual' &&
      info.counterAccount.parentAccountId === targetAcc.id
    ) {
      return true;
    }
  }

  // 3. Echtes Hauptkonto matcht auch alle Transaktionen, die seinen virtuellen Unterkonten zugeordnet sind
  if (targetAcc.accountType !== 'virtual') {
    return info.virtualAccounts.some((v) => v.parentAccountId === targetAcc.id);
  }

  return false;
}
