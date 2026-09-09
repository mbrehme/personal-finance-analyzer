/**
 * @file categoryService.ts
 * @description Reine Domänen-Logik für Kategorien, Hierarchien und Regex-Sanitizing.
 * @module domain/modules/categories/categoryService
 */

import { Category, Transaction } from '@/types';

/**
 * Bereinigt die übergeordnete Kategorie bei Anlage/Änderung einer Subkategorie.
 * Entfernt `regexPattern` bei Elternkategorien, da nur Blatt-Kategorien Regeln besitzen dürfen.
 */
export function sanitizeParentCategoryRules(
  categories: Category[],
  parentId: string | null
): { categories: Category[]; hasChanges: boolean } {
  if (!parentId) {
    return { categories, hasChanges: false };
  }

  let hasChanges = false;
  const updated = categories.map((cat) => {
    if (cat.id === parentId && cat.regexPattern) {
      hasChanges = true;
      const { regexPattern: _discard, ...rest } = cat;
      return rest as Category;
    }
    return cat;
  });

  return { categories: updated, hasChanges };
}

/**
 * Erzeugt das zusammengesetzte Suchfeld (Compound Search String / Searchable Key).
 * Format: `[Typ] Empfänger: Zweck (Iban)`
 */
export function buildCompoundSearchField(tx: Transaction): string {
  const isOutbound = typeof tx.value === 'number' ? tx.value < 0 : true;
  const type = isOutbound ? 'Ausgang' : 'Eingang';
  const receiver = (tx.receiver || tx.issuer || '').trim();
  const subject = (tx.subject || '').trim();
  const partnerIban = (
    (isOutbound ? tx.receiverIban : tx.senderIban) ||
    tx.receiverIban ||
    tx.senderIban ||
    ''
  ).trim();

  return `[${type}] ${receiver}: ${subject} (${partnerIban})`;
}

export interface CategoryMatchResult {
  categoryId: string | null;
  assignmentSource: 'auto_regex' | 'unassigned';
}

/**
 * Führt das automatische Matching einer Transaktion gegen aktive Kategorien-Regeln durch.
 */
export function matchTransaction(tx: Transaction, categories: Category[]): CategoryMatchResult {
  const compound = buildCompoundSearchField(tx);

  for (const cat of categories) {
    if (!cat.regexPattern || !cat.regexPattern.trim()) continue;

    try {
      const regex = new RegExp(cat.regexPattern.trim(), 'i');
      if (regex.test(compound)) {
        return {
          categoryId: cat.id,
          assignmentSource: 'auto_regex',
        };
      }
    } catch {
      // Ignoriere invalide Regex-Patterns defensiv
    }
  }

  return {
    categoryId: null,
    assignmentSource: 'unassigned',
  };
}

/**
 * Matchet alle Transaktionen neu gegen gegebene Kategorien, unter Erhalt manueller Zuweisungen.
 */
export function reMatchAllTransactions(
  transactions: Transaction[],
  categories: Category[]
): Transaction[] {
  return transactions.map((tx) => {
    if (tx.assignmentSource === 'manual') {
      return tx;
    }
    const match = matchTransaction(tx, categories);
    return {
      ...tx,
      categoryId: match.categoryId,
      bucketId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };
  });
}
