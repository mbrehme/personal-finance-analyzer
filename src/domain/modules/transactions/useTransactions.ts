/**
 * @file useTransactions.ts
 * @description State-Management Hook für Transaktionen, Splits, Löschungen und Overrides.
 * Konsumiert ausschließlich die TransactionRepository- und CategoryRepository-Schnittstelle.
 * @module domain/modules/transactions/useTransactions
 */

import { useState } from 'react';
import { Account, Transaction, Category, CategoryAssignmentSource } from '@/types';
import { TransactionRepository, CategoryRepository } from '@/repository';
import {
  calculateSingleSplit,
  resetTransactionToOriginal,
  sortTransactionsDesc,
  SplitInput,
} from './transactionService';
import { findMatchingTransaction, mergeTransactions } from './transactionDeduplication';
import { matchTransaction } from '../categories/categoryService';

export interface UseTransactionsResult {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  deletedTransactions: Transaction[];
  setDeletedTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addTransaction: (
    txData:
      | (Omit<Transaction, 'id' | 'assignmentSource'> & {
          assignmentSource?: CategoryAssignmentSource;
        })
      | Transaction
  ) => Promise<Transaction>;
  updateTransaction: (updatedTx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  restoreTransaction: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  splitTransaction: (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ) => Promise<void>;
  updateSplitGroup: (rootTransactionId: string, splits: SplitInput[]) => Promise<void>;
  resetTransaction: (id: string) => Promise<void>;
  assignTransactionCategory: (
    transactionId: string,
    targetCategoryId: string | null
  ) => Promise<void>;
  assignTransactionCategoryBatch: (
    transactionIds: string[],
    targetCategoryId: string | null
  ) => Promise<void>;
  importTransactions: (
    newTransactions: Transaction[],
    categories: Category[],
    accounts?: Account[]
  ) => Promise<number>;
}

export function useTransactions(
  transactionRepo: TransactionRepository,
  categoryRepo: CategoryRepository,
  categories: Category[],
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);

  const addTransaction = async (
    txData:
      | (Omit<Transaction, 'id' | 'assignmentSource'> & {
          assignmentSource?: CategoryAssignmentSource;
        })
      | Transaction
  ): Promise<Transaction> => {
    const id =
      'id' in txData && txData.id
        ? txData.id
        : `tx-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newTx: Transaction = {
      ...txData,
      id,
      origin: 'override',
      assignmentSource: txData.categoryId ? 'manual' : 'unassigned',
      categoryId: txData.categoryId || null,
    };

    if (newTx.categoryId) {
      const updatedCats = categories.map((c) => {
        if (c.id === newTx.categoryId) {
          const list = c.manualTransactionIds || [];
          return {
            ...c,
            manualTransactionIds: list.includes(id) ? list : [...list, id],
          };
        }
        return c;
      });
      await categoryRepo.saveAll(updatedCats);
      setCategories(updatedCats);
    }

    await transactionRepo.save(newTx);
    setTransactions((prev) => sortTransactionsDesc([...prev, newTx]));
    return newTx;
  };

  const updateTransaction = async (updatedTx: Transaction): Promise<void> => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    const oldCatId = oldTx?.categoryId ?? null;
    const newCatId = updatedTx.categoryId ?? null;

    if (oldCatId !== newCatId) {
      let updatedCats = categories.map((c) => {
        if (c.id === oldCatId && c.manualTransactionIds) {
          return {
            ...c,
            manualTransactionIds: c.manualTransactionIds.filter((id) => id !== updatedTx.id),
          };
        }
        return c;
      });

      if (newCatId) {
        updatedCats = updatedCats.map((c) => {
          if (c.id === newCatId) {
            const list = c.manualTransactionIds || [];
            return {
              ...c,
              manualTransactionIds: list.includes(updatedTx.id) ? list : [...list, updatedTx.id],
            };
          }
          return c;
        });
      }

      await categoryRepo.saveAll(updatedCats);
      setCategories(updatedCats);
    }

    const isCategoryChanged = oldCatId !== newCatId;
    const preparedTx: Transaction = {
      ...updatedTx,
      categoryId: newCatId,
      assignmentSource: isCategoryChanged
        ? newCatId
          ? 'manual'
          : 'unassigned'
        : (updatedTx.assignmentSource ?? oldTx?.assignmentSource ?? 'unassigned'),
      originalValue: oldTx?.originalValue ?? oldTx?.value,
      originalSubject: oldTx?.originalSubject ?? oldTx?.subject,
      originalReceiver: oldTx?.originalReceiver ?? oldTx?.receiver,
      originalIssuer: oldTx?.originalIssuer ?? oldTx?.issuer,
      originalSenderIban: oldTx?.originalSenderIban ?? oldTx?.senderIban,
      originalReceiverIban: oldTx?.originalReceiverIban ?? oldTx?.receiverIban,
      originalDate: oldTx?.originalDate ?? oldTx?.date,
    };

    await transactionRepo.save(preparedTx);
    setTransactions((prev) =>
      sortTransactionsDesc(prev.map((t) => (t.id === preparedTx.id ? preparedTx : t)))
    );
  };

  const deleteTransaction = async (id: string): Promise<void> => {
    const txToDelete = transactions.find((t) => t.id === id);
    if (!txToDelete) return;

    if (txToDelete.origin === 'override' && !txToDelete.originalDate) {
      await transactionRepo.delete(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    const deletedTx: Transaction = {
      ...txToDelete,
      deletedAt: new Date().toISOString(),
    };

    await transactionRepo.delete(id);
    await transactionRepo.saveDeleted([deletedTx]);

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setDeletedTransactions((prev) => [deletedTx, ...prev]);
  };

  const restoreTransaction = async (id: string): Promise<void> => {
    const txToRestore = deletedTransactions.find((t) => t.id === id);
    if (!txToRestore) return;

    const { deletedAt: _deletedAt, ...restoredTx } = txToRestore;
    await transactionRepo.deleteFromTrash(id);
    await transactionRepo.save(restoredTx as Transaction);

    setDeletedTransactions((prev) => prev.filter((t) => t.id !== id));
    setTransactions((prev) => sortTransactionsDesc([...prev, restoredTx as Transaction]));
  };

  const emptyTrash = async (): Promise<void> => {
    await transactionRepo.clearDeleted();
    setDeletedTransactions([]);
  };

  const splitTransaction = async (
    originalId: string,
    splitAmount: number,
    splitData: { subject: string; receiver: string; categoryId: string | null }
  ): Promise<void> => {
    const originalTx = transactions.find((t) => t.id === originalId);
    if (!originalTx) throw new Error('Originalbuchung nicht gefunden.');

    const { updatedRootTx, newSplitTx } = calculateSingleSplit(originalTx, splitAmount, splitData);

    if (newSplitTx.categoryId) {
      const updatedCats = categories.map((c) => {
        if (c.id === newSplitTx.categoryId) {
          const list = c.manualTransactionIds || [];
          return {
            ...c,
            manualTransactionIds: list.includes(newSplitTx.id) ? list : [...list, newSplitTx.id],
          };
        }
        return c;
      });
      await categoryRepo.saveAll(updatedCats);
      setCategories(updatedCats);
    }

    await transactionRepo.save(updatedRootTx);
    await transactionRepo.save(newSplitTx);

    setTransactions((prev) =>
      sortTransactionsDesc([
        ...prev.map((t) => (t.id === originalId ? updatedRootTx : t)),
        newSplitTx,
      ])
    );
  };

  const updateSplitGroup = async (
    rootTransactionId: string,
    splits: SplitInput[]
  ): Promise<void> => {
    let rootTx = transactions.find((t) => t.id === rootTransactionId);
    if (!rootTx) {
      throw new Error('Root-Transaktion nicht gefunden.');
    }
    if (rootTx.splitFromId) {
      const parent = transactions.find((t) => t.id === rootTx!.splitFromId);
      if (parent) {
        rootTx = parent;
      }
    }

    const actualRootId = rootTx.id;
    const bankTotal = rootTx.originalValue !== undefined ? rootTx.originalValue : rootTx.value;
    const bankTotalAbs = Math.round(Math.abs(bankTotal) * 100) / 100;
    const sign = bankTotal < 0 ? -1 : 1;

    let totalSplitsAbs = 0;
    for (const split of splits) {
      if (split.amount <= 0) {
        throw new Error('Der Betrag jedes Split-Teils muss größer als 0,00 € sein.');
      }
      totalSplitsAbs = Math.round((totalSplitsAbs + split.amount) * 100) / 100;
    }

    if (totalSplitsAbs >= bankTotalAbs) {
      throw new Error(
        'Die Summe aller Split-Teile muss kleiner als der Gesamtbetrag der Buchung sein, damit ein Restbetrag verbleibt.'
      );
    }

    const remainingAbs = Math.round((bankTotalAbs - totalSplitsAbs) * 100) / 100;
    const updatedRootValue = (sign * Math.round(remainingAbs * 100)) / 100;
    const rootTxDate = rootTx.date;

    const updatedRootTx: Transaction = {
      ...rootTx,
      value: updatedRootValue,
      originalValue: rootTx.originalValue ?? rootTx.value,
      originalSubject: rootTx.originalSubject ?? rootTx.subject,
      originalReceiver: rootTx.originalReceiver ?? rootTx.receiver,
      originalSenderIban: rootTx.originalSenderIban ?? rootTx.senderIban,
      originalReceiverIban: rootTx.originalReceiverIban ?? rootTx.receiverIban,
      originalDate: rootTx.originalDate ?? rootTxDate,
    };

    const existingChildren = transactions.filter((t) => t.splitFromId === actualRootId);
    const retainedChildIds = new Set<string>();
    const childrenToSave: Transaction[] = [];
    let updatedCategories = [...categories];

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const splitValue = (sign * Math.round(split.amount * 100)) / 100;

      if (i < existingChildren.length) {
        const existingChild = existingChildren[i];
        retainedChildIds.add(existingChild.id);
        const updatedChild: Transaction = {
          ...existingChild,
          receiver: split.receiver.trim() || updatedRootTx.receiver,
          subject: split.subject.trim() || `${updatedRootTx.subject} (Split)`,
          value: splitValue,
          amount: split.amount,
          categoryId: split.categoryId || null,
          assignmentSource: split.categoryId ? 'manual' : 'unassigned',
        };
        childrenToSave.push(updatedChild);
      } else {
        const newChildId = `tx-split-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newChild: Transaction = {
          id: newChildId,
          date: rootTxDate,
          issuer: updatedRootTx.issuer,
          sender: updatedRootTx.sender,
          receiver: split.receiver.trim() || updatedRootTx.receiver,
          subject: split.subject.trim() || `${updatedRootTx.subject} (Split)`,
          senderIban: updatedRootTx.senderIban,
          receiverIban: updatedRootTx.receiverIban,
          amount: split.amount,
          value: splitValue,
          categoryId: split.categoryId || null,
          assignmentSource: split.categoryId ? 'manual' : 'unassigned',
          origin: 'split',
          splitFromId: actualRootId,
        };
        childrenToSave.push(newChild);
      }
    }

    const childrenToDelete = existingChildren.filter((c) => !retainedChildIds.has(c.id));
    for (const child of childrenToDelete) {
      await transactionRepo.delete(child.id);
      updatedCategories = updatedCategories.map((c) => ({
        ...c,
        manualTransactionIds: (c.manualTransactionIds || []).filter((id) => id !== child.id),
      }));
    }

    await transactionRepo.save(updatedRootTx);
    await transactionRepo.saveAll(childrenToSave);
    await categoryRepo.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const deletedIds = new Set(childrenToDelete.map((c) => c.id));
    const savedIds = new Set(childrenToSave.map((c) => c.id));

    setTransactions((prev) => {
      const filtered = prev.filter((t) => !deletedIds.has(t.id) && !savedIds.has(t.id));
      const updated = filtered.map((t) => (t.id === actualRootId ? updatedRootTx : t));
      return sortTransactionsDesc([...updated, ...childrenToSave]);
    });
  };

  const resetTransaction = async (id: string): Promise<void> => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    const restored = resetTransactionToOriginal(tx);
    const match = matchTransaction(restored, categories);
    const finalTx: Transaction = {
      ...restored,
      categoryId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };

    let updatedCats = categories.map((c) => {
      if (c.manualTransactionIds && c.manualTransactionIds.includes(id)) {
        return {
          ...c,
          manualTransactionIds: c.manualTransactionIds.filter((tid) => tid !== id),
        };
      }
      return c;
    });

    await categoryRepo.saveAll(updatedCats);
    setCategories(updatedCats);
    await transactionRepo.save(finalTx);

    setTransactions((prev) => sortTransactionsDesc(prev.map((t) => (t.id === id ? finalTx : t))));
  };

  const assignTransactionCategoryBatch = async (
    transactionIds: string[],
    targetCategoryId: string | null
  ): Promise<void> => {
    if (transactionIds.length === 0) return;
    const targetSet = new Set(transactionIds);

    // 1. Kategorien aktualisieren: aus alten manualTransactionIds entfernen
    let updatedCategories = categories.map((c) => {
      if (c.manualTransactionIds && c.manualTransactionIds.some((id) => targetSet.has(id))) {
        return {
          ...c,
          manualTransactionIds: c.manualTransactionIds.filter((id) => !targetSet.has(id)),
        };
      }
      return c;
    });

    // 2. Zur Zielkategorie hinzufügen
    if (targetCategoryId) {
      updatedCategories = updatedCategories.map((c) => {
        if (c.id === targetCategoryId) {
          const currentList = c.manualTransactionIds || [];
          const toAdd = transactionIds.filter((id) => !currentList.includes(id));
          return {
            ...c,
            manualTransactionIds: [...currentList, ...toAdd],
          };
        }
        return c;
      });
    }

    await categoryRepo.saveAll(updatedCategories);
    setCategories(updatedCategories);

    // 3. Transaktionen aktualisieren
    const updatedTxs = transactions.map((t) => {
      if (targetSet.has(t.id)) {
        return {
          ...t,
          categoryId: targetCategoryId,
          assignmentSource: targetCategoryId ? ('manual' as const) : ('unassigned' as const),
        };
      }
      return t;
    });

    await transactionRepo.saveAll(updatedTxs);
    setTransactions(sortTransactionsDesc(updatedTxs));
  };

  const assignTransactionCategory = async (
    transactionId: string,
    targetCategoryId: string | null
  ): Promise<void> => {
    await assignTransactionCategoryBatch([transactionId], targetCategoryId);
  };

  const importTransactions = async (
    newTransactions: Transaction[],
    currentCategories: Category[],
    accounts: Account[] = []
  ): Promise<number> => {
    const matchedActiveIds = new Set<string>();
    const toInsert: Transaction[] = [];
    const toUpdate: Transaction[] = [];

    for (const rawTx of newTransactions) {
      // 1. Prüfung gegen gelöschte Transaktionen (Tombstones)
      const deletedMatch = findMatchingTransaction(rawTx, deletedTransactions, accounts);
      if (deletedMatch) continue;

      // 2. Semantische Prüfung gegen bestehende aktive Transaktionen
      const activeMatch = findMatchingTransaction(rawTx, transactions, accounts, matchedActiveIds);
      if (activeMatch) {
        matchedActiveIds.add(activeMatch.matchedTx.id);
        const merged = mergeTransactions(activeMatch.matchedTx, rawTx);
        toUpdate.push(merged);
        continue;
      }

      // 3. Neu einzufügende Transaktion vorbereiten (Auto-Matching gegen Kategorien)
      const match = matchTransaction(rawTx, currentCategories);
      const preparedTx: Transaction = {
        ...rawTx,
        categoryId: match.categoryId,
        assignmentSource: match.assignmentSource,
      };

      toInsert.push(preparedTx);
    }

    if (toUpdate.length > 0) {
      await transactionRepo.saveAll(toUpdate);
    }

    if (toInsert.length > 0) {
      await transactionRepo.saveAll(toInsert);
    }

    if (toUpdate.length > 0 || toInsert.length > 0) {
      setTransactions((prev) => {
        const updateMap = new Map(toUpdate.map((t) => [t.id, t]));
        const updatedList = prev.map((t) => updateMap.get(t.id) || t);
        return sortTransactionsDesc([...updatedList, ...toInsert]);
      });
    }

    return toInsert.length;
  };

  return {
    transactions,
    setTransactions,
    deletedTransactions,
    setDeletedTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    emptyTrash,
    splitTransaction,
    updateSplitGroup,
    resetTransaction,
    assignTransactionCategory,
    assignTransactionCategoryBatch,
    importTransactions,
  };
}
