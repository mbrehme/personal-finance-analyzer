/**
 * @file useAccounts.ts
 * @description State-Management Hook für Konten, Salden und Konten-Sortierung.
 * Konsumiert ausschließlich die AccountRepository-Schnittstelle (Dependency Inversion).
 * @module domain/modules/accounts/useAccounts
 */

import { useState } from 'react';
import { Account, BalanceEntry } from '@/types';
import { AccountRepository } from '@/repository';

export interface UseAccountsResult {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  addAccount: (accountData: Omit<Account, 'id'> | Account) => Promise<Account>;
  updateAccount: (updatedAccount: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  reorderAccounts: (reorderedAccounts: Account[]) => Promise<void>;
  addBalanceEntry: (accountId: string, entryData: Omit<BalanceEntry, 'id'>) => Promise<void>;
  deleteBalanceEntry: (accountId: string, entryId: string) => Promise<void>;
}

export function useAccounts(accountRepo: AccountRepository): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);

  const addAccount = async (accountData: Omit<Account, 'id'> | Account): Promise<Account> => {
    const id =
      'id' in accountData && accountData.id
        ? accountData.id
        : `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newAccount: Account = {
      ...accountData,
      id,
      balanceEntries: accountData.balanceEntries || [],
    };

    await accountRepo.save(newAccount);
    setAccounts((prev) => [...prev, newAccount]);
    return newAccount;
  };

  const updateAccount = async (updatedAccount: Account): Promise<void> => {
    await accountRepo.save(updatedAccount);
    setAccounts((prev) => prev.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)));
  };

  const deleteAccount = async (id: string): Promise<void> => {
    await accountRepo.delete(id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const reorderAccounts = async (reorderedAccounts: Account[]): Promise<void> => {
    const indexed = reorderedAccounts.map((acc, index) => ({
      ...acc,
      order: index,
    }));
    await accountRepo.saveAll(indexed);
    setAccounts(indexed);
  };

  const addBalanceEntry = async (
    accountId: string,
    entryData: Omit<BalanceEntry, 'id'>
  ): Promise<void> => {
    const targetAccount = accounts.find((a) => a.id === accountId);
    if (!targetAccount) {
      throw new Error(`Konto mit ID ${accountId} nicht gefunden.`);
    }

    const newEntry: BalanceEntry = {
      ...entryData,
      id: `bal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    const updatedAccount: Account = {
      ...targetAccount,
      balanceEntries: [...targetAccount.balanceEntries, newEntry].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };

    await accountRepo.save(updatedAccount);
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? updatedAccount : a)));
  };

  const deleteBalanceEntry = async (accountId: string, entryId: string): Promise<void> => {
    const targetAccount = accounts.find((a) => a.id === accountId);
    if (!targetAccount) {
      throw new Error(`Konto mit ID ${accountId} nicht gefunden.`);
    }

    const updatedAccount: Account = {
      ...targetAccount,
      balanceEntries: targetAccount.balanceEntries.filter((e) => e.id !== entryId),
    };

    await accountRepo.save(updatedAccount);
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? updatedAccount : a)));
  };

  return {
    accounts,
    setAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    addBalanceEntry,
    deleteBalanceEntry,
  };
}
