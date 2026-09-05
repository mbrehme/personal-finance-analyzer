/**
 * @file regexMatcher.ts
 * @description Intelligente Matching-Engine zur automatischen Zuordnung von Transaktionen
 * zu Kategorien basierend auf manuellen Overrides und regulären Ausdrücken gegen das Compound Search Field.
 * @module services/matcher/regexMatcher
 */

import {
  Category,
  Transaction,
  buildCompoundSearchField,
  CategoryAssignmentSource,
} from '@/types/finance';

export interface MatchResult {
  categoryId: string | null;
  /** @deprecated Verwende categoryId */
  bucketId: string | null;
  assignmentSource: CategoryAssignmentSource;
}

/**
 * Ermittelt alle Blatt-Kategorien (Leaf Categories), die keine untergeordneten Kinder haben.
 * Nur Blatt-Kategorien dürfen Transaktionen matchen.
 */
export function getLeafCategories(categories: Category[]): Category[] {
  const parentIds = new Set<string>();
  categories.forEach((c) => {
    if (c.parentId) {
      parentIds.add(c.parentId);
    }
  });

  return categories.filter((c) => !parentIds.has(c.id));
}

/** @deprecated Verwende getLeafCategories */
export const getLeafBuckets = getLeafCategories;

/**
 * Matcht eine einzelne Transaktion gegen die definierten Kategorien.
 *
 * Prioritäten:
 * 1. Manuelle Zuweisung über `category.manualTransactionIds`
 * 2. Bestehende manuelle Sperre (`tx.assignmentSource === 'manual'`)
 * 3. Regex-Matching des `compoundSearchField` gegen `category.regexPattern`
 *
 * @param {Transaction} tx - Die zu kategorisierende Transaktion
 * @param {Category[]} categories - Liste aller verfügbaren Kategorien
 * @returns {MatchResult} Zugeordnete Kategorie-ID und Zuweisungs-Herkunft
 */
export function matchTransaction(tx: Transaction, categories: Category[]): MatchResult {
  // 1. Manuelle Zuordnungen auf Kategorie-Ebene prüfen
  for (const category of categories) {
    if (category.manualTransactionIds && category.manualTransactionIds.includes(tx.id)) {
      return {
        categoryId: category.id,
        bucketId: category.id,
        assignmentSource: 'manual',
      };
    }
  }

  // 2. Wenn Transaktion bereits manuell fixiert ist und noch eine gültige Kategorie existiert, beibehalten
  const currentCatId = tx.categoryId ?? tx.bucketId;
  if (tx.assignmentSource === 'manual' && currentCatId) {
    const categoryExists = categories.some((c) => c.id === currentCatId);
    if (categoryExists) {
      return {
        categoryId: currentCatId,
        bucketId: currentCatId,
        assignmentSource: 'manual',
      };
    }
  }

  // 3. Regex-Matching nur gegen Blatt-Kategorien ausführen
  const leafCategories = getLeafCategories(categories);
  const compoundField = buildCompoundSearchField(tx);

  for (const category of leafCategories) {
    if (!category.regexPattern || category.regexPattern.trim() === '') {
      continue;
    }

    try {
      const regex = new RegExp(category.regexPattern.trim(), 'i');
      if (regex.test(compoundField)) {
        return {
          categoryId: category.id,
          bucketId: category.id,
          assignmentSource: 'auto_regex',
        };
      }
    } catch {
      // Ungültiges Regex-Muster ignorieren
      console.warn(
        `Ungültiges Regex-Pattern in Kategorie ${category.name}: ${category.regexPattern}`
      );
    }
  }

  return {
    categoryId: null,
    bucketId: null,
    assignmentSource: 'unassigned',
  };
}

/**
 * Führt ein Re-Matching für eine Liste von Transaktionen durch.
 * Aktualisiert nur automatische Zuweisungen; manuelle Zuweisungen bleiben unverändert.
 *
 * @param {Transaction[]} transactions - Vorhandene Transaktionen
 * @param {Category[]} categories - Aktuelle Kategorie-Konfiguration
 * @returns {Transaction[]} Transaktionen mit aktualisierten Kategorie-Zuweisungen
 */
export function reMatchAllTransactions(
  transactions: Transaction[],
  categories: Category[]
): Transaction[] {
  return transactions.map((tx) => {
    const match = matchTransaction(tx, categories);
    return {
      ...tx,
      categoryId: match.categoryId,
      bucketId: match.categoryId,
      assignmentSource: match.assignmentSource,
    };
  });
}
