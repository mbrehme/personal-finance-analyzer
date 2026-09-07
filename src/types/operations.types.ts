/**
 * @file operations.types.ts
 * @description Typdefinitionen für Workspace-Operationen (Export, Reset, Re-Matching).
 * @module types/operations.types
 */

import { Account } from './account.types';
import { Category } from './category.types';
import { Transaction } from './transaction.types';

/**
 * Status des Neu-Matching-Prozesses für Transaktionen:
 * - 'needs_reprogress': Relevante Änderungen (z. B. Konfiguration/Kategorien) müssen neu angewendet werden
 * - 'is_reprogressing': Das Re-Matching wird aktuell im Hintergrund ausgeführt
 * - 'has_progressed': Alle Transaktionen sind aktuell und vollständig synchronisiert
 */
export type ReMatchStatus = 'needs_reprogress' | 'is_reprogressing' | 'has_progressed';

/**
 * Optionen für den Export von Finanzdaten.
 */
export interface ExportOptions {
  /** Konten inklusive Saldenverläufen exportieren */
  includeAccounts: boolean;
  /** Kategorien inklusive Regeln, Soll-Budgets und Hierarchien exportieren */
  includeCategories: boolean;
  /** Manuelle Overrides und manuell angelegte Buchungen exportieren */
  includeManualTransactions: boolean;
  /** Sämtliche Transaktionen / Buchungen exportieren */
  includeTransactions: boolean;
  /** Gelöschte Buchungen (Papierkorb) exportieren */
  includeDeletedTransactions: boolean;
}

/**
 * Standard-Optionen für den Export (standardmäßig alles ausgewählt).
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeAccounts: true,
  includeCategories: true,
  includeManualTransactions: true,
  includeTransactions: true,
  includeDeletedTransactions: true,
};

/**
 * Modus für das Zurücksetzen des Workspace:
 * - 'seed': Auf Beispieldaten / Standardkonfiguration zurücksetzen
 * - 'empty': Vollständig leeren / löschen (leerer Zustand)
 */
export type ResetTarget = 'seed' | 'empty';

/**
 * Optionen für das selektive Zurücksetzen des Workspace.
 */
export interface ResetOptions {
  /** Ziel: 'seed' (auf Beispieldaten zurücksetzen) oder 'empty' (vollständig leeren / löschen) */
  target?: ResetTarget;
  /** Konten auf Standard-Konto zurücksetzen oder leeren */
  resetAccounts?: boolean;
  /** Kategorien auf Standard-Kategorien zurücksetzen oder leeren */
  resetCategories?: boolean;
  /** Importierte Transaktionen / Buchungen löschen (oder im Seed-Modus Beispieldaten laden) */
  resetTransactions?: boolean;
  /**
   * Setzt manuelle Überschreibungen auf die Bank-Originaldaten zurück und matchet die Kategorien neu.
   */
  resetOverrides?: boolean;
  /**
   * Löst Split-Buchungen auf (entfernt Split-Kinder und stellt den vollen Betrag der Ursprungsbuchung wieder her).
   */
  resetSplits?: boolean;
  /** Gelöschte Transaktionen (Papierkorb) leeren */
  resetDeletedTransactions?: boolean;
  /** Bei target === 'seed': Ob zusätzlich realistische Beispieldaten für Buchungen geladen werden sollen */
  includeSampleTransactions?: boolean;
}

/**
 * Standard-Optionen für den Reset (standardmäßig Beispieldaten & alles vorausgewählt).
 */
export const DEFAULT_RESET_OPTIONS: ResetOptions = {
  target: 'seed',
  resetAccounts: true,
  resetCategories: true,
  resetTransactions: true,
  resetOverrides: false,
  resetSplits: false,
  resetDeletedTransactions: true,
};

/**
 * Konfigurations- und Daten-Export (leichtgewichtig oder vollständiges Backup).
 */
export interface FinanceConfigExport {
  version: number;
  exportedAt: string;
  accounts?: Account[];
  categories?: Category[];
  /** Manuell erstellte Buchungen, Splits und modifizierte Overrides */
  manualTransactions?: Transaction[];
  /** Vollständiger Buchungsbestand aller Transaktionen */
  transactions?: Transaction[];
  /** Gelöschte Buchungen (damit sie beim Re-Import oder Gerätewechsel gelöscht bleiben) */
  deletedTransactions?: Transaction[];
}
