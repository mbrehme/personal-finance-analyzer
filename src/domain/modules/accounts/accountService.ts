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

  const counterAccount =
    primaryAccount && (normTxIban || tx.iban)
      ? accounts.find(
          (a) =>
            a.id !== primaryAccount.id &&
            a.accountType !== 'virtual' &&
            Boolean((a.iban && normalizeIban(a.iban) === normTxIban) || a.id === tx.iban)
        )
      : undefined;

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
 * Ermittelt den effektiven Betrag einer Transaktion aus Sicht eines bestimmten Kontos.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} targetAccount - Das Zielkonto
 * @param {Account[]} accounts - Alle Konten
 * @returns {number | null} Effektiver Betrag oder null
 */
export function getTransactionEffectiveValueForAccount(
  tx: Transaction,
  targetAccount: Account,
  accounts: Account[]
): number | null {
  const info = getTransactionAccountInfo(tx, accounts);

  if (targetAccount.accountType === 'virtual') {
    if (!info.virtualAccounts.some((v) => v.id === targetAccount.id)) {
      return null;
    }
    if (info.counterAccount && targetAccount.parentAccountId === info.counterAccount.id) {
      return -tx.value;
    }
    return tx.value;
  }

  if (info.primaryAccount && info.primaryAccount.id === targetAccount.id) {
    return tx.value;
  }

  return null;
}

/**
 * Prüft, ob eine Transaktion mit einem Konto-Filter übereinstimmt.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {string} accountId - Die Konto-ID oder 'all'
 * @param {Account[]} accounts - Alle Konten
 * @returns {boolean}
 */
export function isTransactionMatchingAccount(
  tx: Transaction,
  accountId: string,
  accounts: Account[]
): boolean {
  if (accountId === 'all') return true;
  const targetAcc = accounts.find((a) => a.id === accountId);
  if (!targetAcc) {
    const info = getTransactionAccountInfo(tx, accounts);
    return info.allAccounts.some((a) => a.id === accountId);
  }

  // 1. Direktes Matching über den effektiven Kontowert (deckt virtuelle Unterkonten und direkte Hauptkontobuchungen ab)
  if (getTransactionEffectiveValueForAccount(tx, targetAcc, accounts) !== null) {
    return true;
  }

  const info = getTransactionAccountInfo(tx, accounts);

  // 2. Gegenkonto bei Umbuchungen (Eingänge / Übertrag von anderem Konto)
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
