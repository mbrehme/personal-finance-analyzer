/**
 * @file FinanceContext.test.tsx
 * @description Unit-Tests für FinanceContext State Management.
 * @module services/storage/FinanceContext.test
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FinanceProvider, useFinance } from './FinanceContext';
import { Transaction } from '@/types/finance';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FinanceProvider>{children}</FinanceProvider>
);

describe('FinanceContext', () => {
  it('initializes with seed accounts and categories', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.categories.length).toBeGreaterThan(0);
    expect(result.current.buckets.length).toBeGreaterThan(0);
  });

  it('adds and updates an account', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let createdAcc: any;
    await act(async () => {
      createdAcc = await result.current.addAccount({
        name: 'Neues Sparkonto',
        categoryIds: [],
        balanceEntries: [],
      });
    });

    expect(createdAcc.id).toBeDefined();
    expect(result.current.accounts.some((a) => a.id === createdAcc.id)).toBe(true);

    await act(async () => {
      await result.current.updateAccount({
        ...createdAcc,
        name: 'Sparkonto Umbenannt',
      });
    });

    const found = result.current.accounts.find((a) => a.id === createdAcc.id);
    expect(found?.name).toBe('Sparkonto Umbenannt');
  });

  it('manages manual category assignment and records manualTransactionIds', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Transaktion importieren
    await act(async () => {
      await result.current.importTransactions([
        {
          id: 'tx-test-assign',
          accountId: 'acc-giro-main',
          date: '2026-09-01',
          valueDate: '2026-09-01',
          bookingDate: '2026-09-01',
          issuer: 'Unbekannt',
          receiver: 'Me',
          subject: 'Sonstige Ausgabe',
          type: 'outbound',
          iban: 'DE00',
          value: -50,
          categoryId: null,
          assignmentSource: 'unassigned',
        },
      ]);
    });

    const targetCategory = result.current.categories[0];

    await act(async () => {
      await result.current.assignTransactionCategory('tx-test-assign', targetCategory.id);
    });

    const updatedTx = result.current.transactions.find((t) => t.id === 'tx-test-assign');
    expect(updatedTx?.categoryId).toBe(targetCategory.id);
    expect(updatedTx?.bucketId).toBe(targetCategory.id);
    expect(updatedTx?.assignmentSource).toBe('manual');

    const updatedCategory = result.current.categories.find((c) => c.id === targetCategory.id);
    expect(updatedCategory?.manualTransactionIds).toContain('tx-test-assign');
  });

  it('reorders categories and accounts successfully', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reorder Categories
    const initialCategories = [...result.current.categories];
    const reversedCategories = initialCategories.map((c, idx) => ({
      ...c,
      order: initialCategories.length - idx,
    }));

    await act(async () => {
      await result.current.reorderCategories(reversedCategories);
    });

    expect(result.current.categories[0].order).toBe(initialCategories.length);

    // Reorder Accounts
    const initialAccounts = [...result.current.accounts];
    const reorderedAccounts = initialAccounts.map((a, idx) => ({
      ...a,
      order: idx + 5,
    }));

    await act(async () => {
      await result.current.reorderAccounts(reorderedAccounts);
    });

    expect(result.current.accounts[0].order).toBe(5);
  });

  it('resets workspace to seed categories and accounts', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Delete a category to alter state
    const firstCat = result.current.categories[0];
    await act(async () => {
      await result.current.deleteCategory(firstCat.id);
    });

    // Reset workspace
    await act(async () => {
      await result.current.resetWorkspace();
    });

    expect(result.current.categories.length).toBeGreaterThan(0);
    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.transactions.length).toBe(0);
  });

  it('adds, updates and splits transactions with live remaining calculation and slim export', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 1. Manuelle Transaktion hinzufügen
    let newTx: any;
    await act(async () => {
      newTx = await result.current.addTransaction({
        accountId: result.current.accounts[0].id,
        date: '2026-09-01',
        valueDate: '2026-09-01',
        bookingDate: '2026-09-01',
        issuer: 'Bargeld',
        receiver: 'Supermarkt',
        subject: 'Wocheneinkauf',
        type: 'outbound',
        iban: '',
        value: -100,
        categoryId: null,
      });
    });

    expect(newTx.id).toBeDefined();
    expect(newTx.origin).toBe('manual');
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].value).toBe(-100);

    // 2. Transaktion bearbeiten (Überschreiben)
    await act(async () => {
      await result.current.updateTransaction({
        ...result.current.transactions[0],
        subject: 'Wocheneinkauf REWE',
      });
    });
    expect(result.current.transactions[0].subject).toBe('Wocheneinkauf REWE');

    // 3. Transaktion aufteilen (Split 30 € abspalten)
    await act(async () => {
      await result.current.splitTransaction(result.current.transactions[0].id, 30, {
        subject: 'Drogerieartikel',
        receiver: 'Supermarkt',
        categoryId: null,
      });
    });

    expect(result.current.transactions).toHaveLength(2);
    const origAfterSplit = result.current.transactions.find((t) => t.id === newTx.id);
    const splitPart = result.current.transactions.find((t) => t.splitFromId === newTx.id);

    expect(origAfterSplit?.value).toBe(-70);
    expect(splitPart?.value).toBe(-30);
    expect(splitPart?.subject).toBe('Drogerieartikel');
    expect(splitPart?.origin).toBe('manual');

    // 4. Split-Validierung: Split >= Originalbetrag muss Fehler werfen
    await expect(
      result.current.splitTransaction(origAfterSplit!.id, 75, {
        subject: 'Ungültig',
        receiver: 'Test',
        categoryId: null,
      })
    ).rejects.toThrow(/Der Teilbetrag muss kleiner als der Originalbetrag sein/);

    // 5. Schlanker Export: Exportiert nur manuelle Transaktionen und Overrides
    const jsonStr = await result.current.exportConfiguration();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.manualTransactions).toHaveLength(2);
  });

  it('strictly preserves amounts on split, deleting split child, resetting, and updateSplitGroup', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.clearTransactions();
    });

    // 1. Import transaction (-100 €)
    const mainTx: Transaction = {
      id: 'tx-split-root',
      accountId: result.current.accounts[0].id,
      date: '2026-09-01',
      valueDate: '2026-09-01',
      bookingDate: '2026-09-01',
      issuer: '',
      receiver: 'Supermarkt',
      subject: 'Einkauf 100 Euro',
      value: -100,
      originalValue: -100,
      originalSubject: 'Einkauf 100 Euro',
      originalReceiver: 'Supermarkt',
      iban: '',
      origin: 'imported',
      categoryId: null,
      assignmentSource: 'unassigned',
    };
    await act(async () => {
      await result.current.importTransactions([mainTx]);
    });

    // Initial split of 40 €
    await act(async () => {
      await result.current.splitTransaction(mainTx.id, 40, {
        subject: 'Split Teilbetrag',
        receiver: 'Drogerie',
        categoryId: null,
      });
    });

    expect(result.current.transactions).toHaveLength(2);
    const parentAfterSplit = result.current.transactions.find((t) => t.id === mainTx.id);
    expect(parentAfterSplit?.value).toBe(-60);
    const child = result.current.transactions.find((t) => t.splitFromId === mainTx.id)!;
    expect(child.value).toBe(-40);

    // 2. Delete split child -> amount must return to parent!
    await act(async () => {
      await result.current.deleteTransaction(child.id);
    });

    expect(result.current.transactions).toHaveLength(1);
    const parentAfterChildDelete = result.current.transactions.find((t) => t.id === mainTx.id);
    expect(parentAfterChildDelete?.value).toBe(-100);

    // 3. updateSplitGroup with multiple parts
    await act(async () => {
      await result.current.updateSplitGroup!(mainTx.id, [
        { amount: 30, subject: 'Teil 1', receiver: 'Partner 1', categoryId: null },
        { amount: 20, subject: 'Teil 2', receiver: 'Partner 2', categoryId: null },
      ]);
    });

    expect(result.current.transactions).toHaveLength(3);
    const parentAfterGroup = result.current.transactions.find((t) => t.id === mainTx.id);
    expect(parentAfterGroup?.value).toBe(-50); // 100 - (30 + 20) = 50
    const parts = result.current.transactions.filter((t) => t.splitFromId === mainTx.id);
    expect(parts).toHaveLength(2);
    expect(parts.reduce((sum, p) => sum + Math.abs(p.value), 0)).toBe(50);

    // 4. Reset parent -> deletes split children and restores original bank amount
    await act(async () => {
      await result.current.resetTransaction(mainTx.id);
    });

    expect(result.current.transactions).toHaveLength(1);
    const parentAfterReset = result.current.transactions.find((t) => t.id === mainTx.id);
    expect(parentAfterReset?.value).toBe(-100);

    // 5. Deleting parent -> deletes all split children too
    await act(async () => {
      await result.current.splitTransaction(mainTx.id, 35, {
        subject: 'Split erneut',
        receiver: 'Test',
        categoryId: null,
      });
    });
    expect(result.current.transactions).toHaveLength(2);

    await act(async () => {
      await result.current.deleteTransaction(mainTx.id);
    });
    // Transactions should be 0 because both parent and child are deleted
    expect(result.current.transactions).toHaveLength(0);
  });

  it('permanently deletes manual transactions without adding them to deleted pile', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let manualTx: any;
    await act(async () => {
      manualTx = await result.current.addTransaction({
        accountId: result.current.accounts[0].id,
        date: '2026-09-01',
        valueDate: '2026-09-01',
        bookingDate: '2026-09-01',
        issuer: 'Bar',
        receiver: 'Flohmarkt',
        subject: 'Bargeldkauf',
        value: -15,
        iban: '',
        categoryId: null,
      });
    });

    expect(manualTx.origin).toBe('manual');
    expect(result.current.transactions.some((t) => t.id === manualTx.id)).toBe(true);

    await act(async () => {
      await result.current.deleteTransaction(manualTx.id);
    });

    // Manuelle Buchung ist weg und landet NICHT im Papierkorb
    expect(result.current.transactions.some((t) => t.id === manualTx.id)).toBe(false);
    expect(result.current.deletedTransactions.some((t) => t.id === manualTx.id)).toBe(false);
  });

  it('automatically clears regexPattern from parent category when subcategory is added', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let parentCategory: any;
    await act(async () => {
      parentCategory = await result.current.addCategory({
        name: 'Parent mit Regex',
        parentId: null,
        regexPattern: 'TestRegex.*',
      });
    });

    expect(parentCategory.regexPattern).toBe('TestRegex.*');
    expect(result.current.categories.find((c) => c.id === parentCategory.id)?.regexPattern).toBe(
      'TestRegex.*'
    );

    // Unterkategorie unter diesem Parent anlegen
    await act(async () => {
      await result.current.addCategory({
        name: 'Neue Unterkategorie',
        parentId: parentCategory.id,
        regexPattern: 'ChildRegex.*',
      });
    });

    // Parent muss nun sein regexPattern verloren haben
    const updatedParent = result.current.categories.find((c) => c.id === parentCategory.id);
    expect(updatedParent?.regexPattern).toBeUndefined();
  });

  it('supports selective reset of workspace categories without deleting accounts or transactions', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Custom Category anlegen
    await act(async () => {
      await result.current.addCategory({
        name: 'Spezialkategorie',
        parentId: null,
      });
    });
    expect(result.current.categories.some((c) => c.name === 'Spezialkategorie')).toBe(true);

    // Selektiv nur Kategorien zurücksetzen
    await act(async () => {
      await result.current.resetWorkspace({
        resetAccounts: false,
        resetCategories: true,
        resetTransactions: false,
        resetDeletedTransactions: false,
      });
    });

    // Spezialkategorie ist weg, da Kategorien auf Seed zurückgesetzt wurden
    expect(result.current.categories.some((c) => c.name === 'Spezialkategorie')).toBe(false);
  });

  it('supports empty reset mode to completely wipe categories and transactions', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetWorkspace({
        target: 'empty',
        resetCategories: true,
        resetTransactions: true,
      });
    });

    expect(result.current.categories).toHaveLength(0);
    expect(result.current.transactions).toHaveLength(0);
  });

  it('loads sample transactions when resetWorkspace is called with includeSampleTransactions true', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetWorkspace({
        target: 'seed',
        resetTransactions: true,
        includeSampleTransactions: true,
      });
    });

    expect(result.current.transactions.length).toBeGreaterThan(0);
  });
});
