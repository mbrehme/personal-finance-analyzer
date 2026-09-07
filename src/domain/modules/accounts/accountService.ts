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
  const normAccountIban = normalizeIban(tx.accountIban);
  const normTxIban = normalizeIban(tx.iban);

  let primaryAccount: Account | undefined;
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

  let counterAccount =
    primaryAccount && (normTxIban || tx.iban)
      ? accounts.find(
          (a) =>
            a.id !== primaryAccount!.id &&
            a.accountType !== 'virtual' &&
            Boolean((a.iban && normalizeIban(a.iban) === normTxIban) || a.id === tx.iban)
        )
      : undefined;

  // Ergänzend: Gegenkonto anhand von Empfänger / Sender (tx.receiver / tx.issuer) zuordnen, falls IBAN fehlt
  if (!counterAccount && primaryAccount) {
    const normReceiver = (tx.receiver || '').trim().toLowerCase();
    const normIssuer = (tx.issuer || '').trim().toLowerCase();

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
 * Ermittelt den effektiven Betrag einer Transaktion aus Sicht eines bestimmten Kontos.
 *
 * Für echte Konten:
 * - Wenn das Konto primäres Buchungskonto ist: direkter Betrag (`tx.value`)
 * - Wenn das Konto Gegenkonto (Empfänger / Sender einer Umbuchung) ist: invertierter Betrag (`-tx.value`),
 *   sofern nicht bereits ein eigener Kontoauszug mit der direkten Gegenbuchung existiert (Doppelzählungsvermeidung).
 *
 * Für virtuelle Unterkonten:
 * - Auswertung anhand zugeordneter Kategorien unter dem primären Konto (`tx.value`)
 *   oder als Ziel-Unterkonto einer Umbuchung auf das Gegenkonto (`-tx.value`),
 *   sofern nicht bereits eine direkte Gegenbuchung existiert.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} targetAccount - Das Zielkonto
 * @param {Account[]} accounts - Alle Konten
 * @param {Transaction[]} [allTransactions] - Alle Transaktionen (zur Erkennung von Gegenbuchungen)
 * @returns {number | null} Effektiver Betrag oder null
 */
export function getTransactionEffectiveValueForAccount(
  tx: Transaction,
  targetAccount: Account,
  accounts: Account[],
  allTransactions?: Transaction[]
): number | null {
  const info = getTransactionAccountInfo(tx, accounts);

  if (targetAccount.accountType === 'virtual') {
    if (!info.virtualAccounts.some((v) => v.id === targetAccount.id)) {
      return null;
    }
    if (info.counterAccount && targetAccount.parentAccountId === info.counterAccount.id) {
      // Wenn für die Gegenbuchung auf dem Zielkonto ebenfalls dieses virtuelle Unterkonto aktiv ist,
      // die Umkehrung ignorieren, um Doppelzählung zu vermeiden
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

  // 1. Direktes Buchungskonto (Hauptkonto)
  if (info.primaryAccount && info.primaryAccount.id === targetAccount.id) {
    return tx.value;
  }

  // 2. Gegenkonto (Hauptkonto war Sender oder Empfänger einer Umbuchung)
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
