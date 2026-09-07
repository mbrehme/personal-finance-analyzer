/**
 * @file transactionService.ts
 * @description Reine Domänen-Logik für Buchungen, Splits, Betragserhaltung und Overrides.
 * @module domain/modules/transactions/transactionService
 */

import { Transaction, TransactionType } from '@/types';

export function getTransactionType(txOrValue: { value: number } | number): TransactionType {
  const val = typeof txOrValue === 'number' ? txOrValue : txOrValue.value;
  return val >= 0 ? 'inbound' : 'outbound';
}

export function isTransactionOverridden(tx: Transaction): boolean {
  const currentPartner = (tx.receiver || tx.issuer || '').trim();
  const origPartner = (tx.originalReceiver || tx.originalIssuer || '').trim();
  const hasOrigPartner = tx.originalReceiver !== undefined || tx.originalIssuer !== undefined;
  const isPartnerOverridden =
    hasOrigPartner && origPartner !== '' && currentPartner !== origPartner;

  const originalDate = tx.originalDate ?? tx.originalValueDate;
  const currentDate = tx.date ?? tx.valueDate;
  const isDateOverridden = originalDate !== undefined && currentDate !== originalDate;

  return (
    (tx.originalValue !== undefined && tx.value !== tx.originalValue) ||
    (tx.originalSubject !== undefined && tx.subject !== tx.originalSubject) ||
    isPartnerOverridden ||
    isDateOverridden ||
    (tx.originalAccountIban !== undefined && tx.accountIban !== tx.originalAccountIban) ||
    (tx.originalAccountId !== undefined && tx.accountId !== tx.originalAccountId) ||
    (tx.originalIban !== undefined && tx.iban !== tx.originalIban) ||
    Boolean(tx.splitFromId)
  );
}

export function isManualTransaction(tx: Transaction): boolean {
  return (
    tx.origin === 'manual' ||
    tx.origin === 'override' ||
    Boolean(tx.splitFromId) ||
    isTransactionOverridden(tx)
  );
}

/**
 * Ermittelt die virtuelle Herkunft einer Transaktion:
 * - 'split': Teilbuchung aus einem Split (`tx.splitFromId` vorhanden)
 * - 'override': Manuell editiert / überschrieben (`isTransactionOverridden(tx)`) oder als override markiert
 * - 'imported': Unveränderte Original-Bankbuchung
 */
export function getTransactionOrigin(tx: Transaction): 'imported' | 'split' | 'override' {
  if (tx.splitFromId) {
    return 'split';
  }
  if (isTransactionOverridden(tx) || tx.origin === 'override' || tx.origin === 'manual') {
    return 'override';
  }
  return 'imported';
}

export function resetTransactionToOriginal(tx: Transaction): Transaction {
  const { splitFromId: _splitFromId, deletedAt: _deletedAt, ...rest } = tx;
  const restoredDate = tx.originalDate ?? tx.originalValueDate ?? tx.date ?? tx.valueDate;
  return {
    ...rest,
    value: tx.originalValue ?? tx.value,
    subject: tx.originalSubject ?? tx.subject,
    receiver: tx.originalReceiver ?? tx.receiver,
    issuer: tx.originalIssuer ?? tx.issuer,
    date: restoredDate,
    valueDate: restoredDate,
    bookingDate: tx.originalBookingDate ?? restoredDate,
    originalDate: tx.originalDate ?? tx.originalValueDate,
    accountId: tx.originalAccountId ?? tx.accountId,
    accountIban: tx.originalAccountIban ?? tx.accountIban,
    iban: tx.originalIban ?? tx.iban,
    categoryId: null,
    bucketId: null,
    assignmentSource: 'unassigned',
    origin: 'imported',
  };
}

export function sortTransactionsDesc(txList: Transaction[]): Transaction[] {
  const idsInList = new Set(txList.map((t) => t.id));
  const childrenByParent = new Map<string, Transaction[]>();
  const rootTransactions: Transaction[] = [];

  for (const tx of txList) {
    if (tx.splitFromId && idsInList.has(tx.splitFromId)) {
      const list = childrenByParent.get(tx.splitFromId) || [];
      list.push(tx);
      childrenByParent.set(tx.splitFromId, list);
    } else {
      rootTransactions.push(tx);
    }
  }

  const compareBase = (a: Transaction, b: Transaction) => {
    const dateA = a.date || a.valueDate || '';
    const dateB = b.date || b.valueDate || '';
    const dateComp = dateB.localeCompare(dateA);
    if (dateComp !== 0) return dateComp;

    // Am gleichen Tag primär nach dem tagesbezogenen Import-Index (dayIndex) sortieren
    if (a.dayIndex !== undefined && b.dayIndex !== undefined) {
      return a.dayIndex - b.dayIndex;
    }

    if (a.importedAt && b.importedAt && a.importedAt !== b.importedAt) {
      return b.importedAt.localeCompare(a.importedAt);
    }
    // Fallback auf den dateiweiten importIndex für Bestandsdaten
    if (a.importIndex !== undefined && b.importIndex !== undefined) {
      return a.importIndex - b.importIndex;
    }
    if (b.value !== a.value) return b.value - a.value;
    return b.id.localeCompare(a.id);
  };

  rootTransactions.sort(compareBase);
  for (const list of childrenByParent.values()) {
    list.sort(compareBase);
  }

  const result: Transaction[] = [];
  for (const root of rootTransactions) {
    result.push(root);
    const children = childrenByParent.get(root.id);
    if (children) {
      for (const child of children) {
        result.push(child);
      }
    }
  }
  return result;
}

export interface SplitInput {
  amount: number;
  subject: string;
  receiver: string;
  categoryId: string | null;
}

export interface CalculatedSplitResult {
  updatedRootTx: Transaction;
  newSplitTx: Transaction;
}

export function calculateSingleSplit(
  originalTx: Transaction,
  splitAmount: number,
  splitData: { subject: string; receiver: string; categoryId: string | null }
): CalculatedSplitResult {
  const origAbs = Math.abs(originalTx.value);
  if (splitAmount <= 0) {
    throw new Error('Der Teilbetrag muss größer als 0 sein.');
  }
  if (splitAmount >= origAbs) {
    throw new Error(
      'Der Teilbetrag muss kleiner als der Originalbetrag sein. Der Restbetrag darf nicht unter 0,00 € fallen.'
    );
  }

  const sign = originalTx.value < 0 ? -1 : 1;
  const remainingAbs = origAbs - splitAmount;
  const updatedOriginalValue = (sign * Math.round(remainingAbs * 100)) / 100;
  const originalTxDate = originalTx.date ?? originalTx.valueDate;

  const updatedRootTx: Transaction = {
    ...originalTx,
    value: updatedOriginalValue,
    originalValue: originalTx.originalValue ?? originalTx.value,
    originalSubject: originalTx.originalSubject ?? originalTx.subject,
    originalReceiver: originalTx.originalReceiver ?? originalTx.receiver,
    originalAccountId: originalTx.originalAccountId ?? originalTx.accountId,
    originalAccountIban: originalTx.originalAccountIban ?? originalTx.accountIban,
    originalDate: originalTx.originalDate ?? originalTx.originalValueDate ?? originalTxDate,
    originalValueDate: originalTx.originalValueDate ?? originalTx.valueDate,
    originalIban: originalTx.originalIban ?? originalTx.iban,
  };

  const splitId = `tx-split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const splitValue = (sign * Math.round(splitAmount * 100)) / 100;

  const newSplitTx: Transaction = {
    id: splitId,
    accountId: originalTx.accountId,
    accountIban: originalTx.accountIban,
    date: originalTxDate,
    valueDate: originalTxDate,
    bookingDate: originalTxDate,
    issuer: originalTx.issuer,
    receiver: splitData.receiver.trim() || originalTx.receiver,
    subject: splitData.subject.trim() || `${originalTx.subject} (Split)`,
    iban: originalTx.iban,
    value: splitValue,
    categoryId: splitData.categoryId || null,
    bucketId: splitData.categoryId || null,
    assignmentSource: splitData.categoryId ? 'manual' : 'unassigned',
    origin: 'manual',
    splitFromId: originalTx.id,
  };

  return { updatedRootTx, newSplitTx };
}
