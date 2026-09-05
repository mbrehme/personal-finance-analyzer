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
  if (normAccountIban) {
    primaryAccount = accounts.find(
      (a) => a.accountType !== 'virtual' && a.iban && normalizeIban(a.iban) === normAccountIban
    );
  }
  if (!primaryAccount && tx.accountId) {
    primaryAccount = accounts.find((a) => a.id === tx.accountId);
  }
  if (!primaryAccount && normTxIban) {
    primaryAccount = accounts.find(
      (a) => a.accountType !== 'virtual' && a.iban && normalizeIban(a.iban) === normTxIban
    );
  }

  const counterAccount =
    normTxIban && primaryAccount
      ? accounts.find(
          (a) =>
            a.id !== primaryAccount.id &&
            a.accountType !== 'virtual' &&
            Boolean(a.iban && normalizeIban(a.iban) === normTxIban)
        )
      : undefined;

  const txCatId = tx.categoryId ?? tx.bucketId ?? null;
  const virtualAccounts = accounts.filter((a) => {
    if (a.accountType !== 'virtual') return false;
    const catIds = a.categoryIds || a.bucketIds || [];
    if (catIds.length > 0 && (!txCatId || !catIds.includes(txCatId))) return false;

    if (a.parentAccountId) {
      const isUnderPrimary = primaryAccount ? a.parentAccountId === primaryAccount.id : false;
      const isUnderCounter = counterAccount ? a.parentAccountId === counterAccount.id : false;
      return isUnderPrimary || isUnderCounter;
    }
    return false;
  });

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
  if (targetAcc) {
    return getTransactionEffectiveValueForAccount(tx, targetAcc, accounts) !== null;
  }
  const info = getTransactionAccountInfo(tx, accounts);
  return info.allAccounts.some((a) => a.id === accountId);
}
