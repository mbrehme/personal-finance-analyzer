/**
 * @file category.types.ts
 * @description Typdefinitionen für Kategorien, Budgets und Zuweisungs-Herkunft.
 * @module types/category.types
 */

import { EntityVisualMetadata, ISODateString, PeriodGranularity } from './common.types';

/**
 * Herkunft der Kategorie-Zuweisung einer Transaktion.
 */
export type CategoryAssignmentSource = 'auto_regex' | 'manual' | 'unassigned';

/**
 * Soll-Budget für eine Kategorie bezogen auf eine bestimmte Zeitperiode.
 * Unterstützt optionale Gültigkeitszeiträume für vorausschauende Finanzplanung.
 */
export interface TargetBudget {
  /** Eindeutige ID des Budget-Eintrags */
  id?: string;
  /** Zeitintervall, für welches das Budget gilt */
  period: PeriodGranularity;
  /** Zielbetrag in Euro (positiver Wert) */
  amount: number;
  /**
   * Optionales Startdatum (ISO-String, z. B. '2026-01-01' oder '2027-01-01'),
   * ab welchem dieser Zielbetrag gilt.
   * Fehlt das Datum oder ist null, gilt es als Basisbudget ohne zeitliche Untergrenze.
   */
  validFrom?: ISODateString | null;
}

/**
 * Hierarchische Kategorie zur Strukturierung und Zuordnung von Transaktionen.
 * Kategorien besitzen keinen festen Typ (income/expense/transfer) – dies ergibt sich aus den zugeordneten Transaktionen.
 */
export interface Category extends EntityVisualMetadata {
  /** Eindeutige ID der Kategorie */
  id: string;
  /** ID der übergeordneten Kategorie oder null für Root-Kategorien */
  parentId: string | null;
  /**
   * Regulärer Ausdruck zur automatischen Zuordnung von Buchungen (z. B. 'Rewe|Edeka|Aldi|Lidl').
   * Wichtig: Nur Blatt-/Kinder-Kategorien dürfen ein Regex-Pattern besitzen!
   */
  regexPattern?: string;
  /**
   * Optionales primäres Soll-Budget für die Kategorie (Abwärtskompatibilität).
   */
  targetBudget?: TargetBudget;
  /**
   * Optionale Liste historisierter und zukünftiger Soll-Budgets mit Gültigkeitsdatum (validFrom).
   */
  targetBudgets?: TargetBudget[];
  /**
   * IDs der Transaktionen, die dieser Kategorie manuell zugewiesen wurden.
   * Ermöglicht die direkte Anzeige und Verwaltung aller manuellen Overrides in der Kategorie-Konfiguration.
   */
  manualTransactionIds?: string[];
}

/**
 * Gibt alle definierten Soll-Budgets einer Kategorie zurück.
 * Berücksichtigt sowohl das `targetBudgets`-Array als auch das abwärtskompatible Einzelfeld `targetBudget`.
 *
 * @param {Category} category - Die zu prüfende Kategorie
 * @returns {TargetBudget[]} Array aller hinterlegten Budgets
 */
export function getCategoryBudgets(category: Category): TargetBudget[] {
  if (category.targetBudgets && category.targetBudgets.length > 0) {
    return category.targetBudgets;
  }
  if (category.targetBudget) {
    return [category.targetBudget];
  }
  return [];
}

/**
 * Ermittelt das zum angegebenen Stichtag (oder Perioden-Enddatum) aktive Soll-Budget einer Kategorie.
 * Wählt aus allen Budgets, deren `validFrom` kleiner oder gleich dem Stichtag ist,
 * dasjenige mit dem spätesten `validFrom`. Fehlt `validFrom`, dient es als zeitlich unbegrenztes Basisbudget.
 * Gibt `undefined` zurück, falls der Stichtag vor allen definierten `validFrom`-Daten liegt und kein Basisbudget existiert.
 *
 * @param {Category} category - Die Kategorie
 * @param {string} targetDate - Stichtag im ISO-Format (z. B. '2026-09-30')
 * @returns {TargetBudget | undefined} Das zu diesem Zeitpunkt gültige Budget oder undefined
 */
export function getActiveCategoryBudgetForDate(
  category: Category,
  targetDate: string
): TargetBudget | undefined {
  const budgets = getCategoryBudgets(category);
  if (budgets.length === 0) return undefined;

  // Filtere alle Budgets, die zum Stichtag bereits begonnen haben:
  // - validFrom fehlt oder ist leer -> immer gültig (Basisbudget)
  // - validFrom <= targetDate -> gültig
  const eligible = budgets.filter((b) => !b.validFrom || b.validFrom <= targetDate);
  if (eligible.length === 0) {
    return undefined;
  }

  // Wähle das Budget mit dem neuesten validFrom (spezifischstes gültiges Datum gewinnt).
  eligible.sort((a, b) => {
    const dateA = a.validFrom || '';
    const dateB = b.validFrom || '';
    return dateA.localeCompare(dateB);
  });

  return eligible[eligible.length - 1];
}
