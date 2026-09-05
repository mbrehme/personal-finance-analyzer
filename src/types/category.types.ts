/**
 * @file category.types.ts
 * @description Typdefinitionen für Kategorien, Budgets und Zuweisungs-Herkunft.
 * @module types/category.types
 */

import { EntityVisualMetadata, PeriodGranularity } from './common.types';

/**
 * Herkunft der Kategorie-Zuweisung einer Transaktion.
 */
export type CategoryAssignmentSource = 'auto_regex' | 'manual' | 'unassigned';

/** @deprecated Verwende CategoryAssignmentSource */
export type BucketAssignmentSource = CategoryAssignmentSource;

/**
 * Soll-Budget für eine Kategorie bezogen auf eine bestimmte Zeitperiode.
 */
export interface TargetBudget {
  /** Zeitintervall, für welches das Budget gilt */
  period: PeriodGranularity;
  /** Zielbetrag in Euro (positiver Wert) */
  amount: number;
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
  /** Optionales Soll-Budget für die Kategorie */
  targetBudget?: TargetBudget;
  /**
   * IDs der Transaktionen, die dieser Kategorie manuell zugewiesen wurden.
   * Ermöglicht die direkte Anzeige und Verwaltung aller manuellen Overrides in der Kategorie-Konfiguration.
   */
  manualTransactionIds?: string[];
}

/** @deprecated Verwende Category */
export type Bucket = Category;
