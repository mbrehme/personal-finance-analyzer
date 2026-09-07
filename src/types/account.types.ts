/**
 * @file account.types.ts
 * @description Typdefinitionen für Konten, Salden und Kontotypen.
 * @module types/account.types
 */

import { ISODateString, EntityVisualMetadata } from './common.types';

/**
 * Art des Kontos:
 * - 'real': Echtes Bankkonto (Girokonto, Tagesgeld, Sparkonto etc.) mit IBAN, ohne manuelle Kategorien
 * - 'virtual': Virtuelles Unterkonto (Urlaubstopf, Rücklagen etc.) unter einem echten Konto, gesteuert über Filter-Kategorien
 */
export type AccountType = 'real' | 'virtual';

/**
 * Historischer Kontostand-Eintrag (Stichtags-Saldo) zu einem bestimmten Datum.
 */
export interface BalanceEntry {
  /** Eindeutige ID des Salden-Eintrags */
  id: string;
  /** Stichtagsdatum im Format YYYY-MM-DD */
  date: ISODateString;
  /** Kontostand zum Stichtag in Euro */
  amount: number;
  /** Optionale Notiz / Anmerkung */
  note?: string;
}

/**
 * Repräsentiert ein Bankkonto, Depot oder ein virtuelles Unterkonto des Benutzers.
 */
export interface Account extends EntityVisualMetadata {
  /** Eindeutige ID des Kontos */
  id: string;
  /**
   * Kontotyp:
   * - 'real': Echtes Bankkonto mit IBAN, ohne manuelle Kategorien
   * - 'virtual': Virtuelles Unterkonto unter einem echten Konto mit Filter-Kategorien
   */
  accountType?: AccountType;
  /** IBAN bei echten Konten (z. B. 'DE89370400440532013000') */
  iban?: string;
  /** ID des übergeordneten echten Kontos (nur bei accountType === 'virtual') */
  parentAccountId?: string | null;
  /** IDs der diesem Konto zugeordneten Kategorien (relevant für virtuelle Unterkonten) */
  categoryIds?: string[];
  /** Historische Stichtags-Salden zur exakten Salden-Rekonstruktion */
  balanceEntries: BalanceEntry[];
}
