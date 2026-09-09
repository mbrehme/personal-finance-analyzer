/**
 * @file useTransactions.test.ts
 * @description Unit-Tests für den useTransactions Hook und Import-Deduplizierung.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactions } from './useTransactions';
import { Account, Category, Transaction } from '@/types';
import { TransactionRepository, CategoryRepository } from '@/repository';

describe('useTransactions', () => {
  const mockTxRepo: TransactionRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    findDeleted: vi.fn().mockResolvedValue([]),
    saveDeleted: vi.fn().mockResolvedValue(undefined),
    deleteFromTrash: vi.fn().mockResolvedValue(undefined),
    clearDeleted: vi.fn().mockResolvedValue(undefined),
  };

  const mockCatRepo: CategoryRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
  };

  const categories: Category[] = [
    {
      id: 'cat-groceries',
      name: 'Lebensmittel',
      color: '#10B981',
      icon: 'ShoppingCart',
      parentId: null,
      regexPattern: 'rewe|edeka',
    },
    {
      id: 'cat-family',
      name: 'Familie',
      color: '#3B82F6',
      icon: 'Users',
      parentId: null,
    },
  ];

  const accounts: Account[] = [
    {
      id: 'acc-giro',
      name: 'Girokonto',
      iban: 'DE89120300001083850147',
      accountType: 'real',
      color: '#3B82F6',
      icon: 'Landmark',
      balanceEntries: [],
    },
    {
      id: 'acc-tg',
      name: 'Tagesgeld',
      iban: 'DE80120300001027106861',
      accountType: 'real',
      color: '#10B981',
      icon: 'PiggyBank',
      balanceEntries: [],
    },
  ];

  it('deduplicates when counterpart is imported and preserves existing manual category', async () => {
    const setCategories = vi.fn();
    const { result } = renderHook(() =>
      useTransactions(mockTxRepo, mockCatRepo, categories, setCategories)
    );

    // 1. Initiale Buchung auf Girokonto mit manueller Kategorie
    const initialTx: Transaction = {
      id: 'tx-1',
      date: '2024-01-30',
      amount: 2500,
      value: 2500,
      type: 'inbound',
      senderIban: 'DE80120300001027106861',
      receiverIban: 'DE89120300001083850147',
      sender: 'Denise',
      receiver: 'Denise',
      issuer: '',
      subject: 'Elternzeit Ausgleichsbudget',
      categoryId: 'cat-family',
      assignmentSource: 'manual',
      origin: 'imported',
    };

    act(() => {
      result.current.setTransactions([initialTx]);
    });

    // 2. Gegenbuchung vom Tagesgeldkonto importieren (-2.500 €)
    let inserted = 0;
    await act(async () => {
      inserted = await result.current.importTransactions(
        [
          {
            id: 'tx-2',
            date: '2024-01-30',
            amount: 2500,
            value: -2500,
            type: 'outbound',
            senderIban: 'DE80120300001027106861',
            receiverIban: 'DE89120300001083850147',
            sender: 'Denise',
            receiver: 'Denise',
            issuer: '',
            subject: 'Elternzeit Ausgleichsbudget',
            categoryId: null,
            assignmentSource: 'unassigned',
            origin: 'imported',
          },
        ],
        categories,
        accounts
      );
    });

    // Keine neue Zeile eingefügt
    expect(inserted).toBe(0);
    expect(result.current.transactions).toHaveLength(1);

    // Bestehende Kategorie bleibt unberührt
    const tx = result.current.transactions[0];
    expect(tx.id).toBe('tx-1');
    expect(tx.categoryId).toBe('cat-family');
    expect(tx.assignmentSource).toBe('manual');
    expect(mockTxRepo.saveAll).toHaveBeenCalled();
  });
});
