/**
 * @file finance.ts
 * @description Zentrale Domänen-Typen und Schnittstellen für die Personal Finance Analyzer Anwendung.
 * @module types/finance
 */

/**
 * Streng typisierter ISO-Datumsstring im Format YYYY-MM-DD (z. B. '2026-09-02').
 */
export type ISODateString = `${number}-${string}-${string}`;

/**
 * Typisierter Monats-String im Format YYYY-MM (z. B. '2026-09') für periodische Aggregationen.
 */
export type YearMonthString = `${number}-${string}`;

/**
 * Unterstützte Zeit-Granularitäten für Auswertungen und Budget-Zyklen.
 */
export type PeriodGranularity = 'monthly' | 'quarterly' | 'halfYearly' | 'yearly';

/**
 * Transaktionstyp: Einnahme (Inbound) oder Ausgabe (Outbound).
 */
export type TransactionType = 'inbound' | 'outbound';

/**
 * Herkunft der Bucket-Zuweisung einer Transaktion.
 */
export type BucketAssignmentSource = 'auto_regex' | 'manual' | 'unassigned';

/**
 * Soll-Budget für einen Bucket bezogen auf eine bestimmte Zeitperiode.
 */
export interface TargetBudget {
  /** Zeitintervall, für welches das Budget gilt */
  period: PeriodGranularity;
  /** Zielbetrag in Euro (positiver Wert) */
  amount: number;
}

/**
 * Basis-Schnittstelle für rein visuelle Metadaten (Titel, Farbe, Icon, Beschreibung).
 */
export interface EntityVisualMetadata {
  /** Anzeigename / Titel der Entität (z. B. 'Girokonto ING', 'Lebensmittel') */
  name: string;
  /** Optionale Farbe (Hex-Code wie '#10b981') für Badges, Diagramme & Icons */
  color?: string;
  /** Optionales Icon (Lucide Icon Name wie 'Wallet', 'ShoppingBag', 'Home', 'Landmark') */
  icon?: string;
  /** Optionale Beschreibung / Notiz */
  description?: string;
  /** Optionale Sortierreihenfolge / Position in Listen & Bäumen */
  order?: number;
}

/**
 * Hierarchischer Bucket zur Strukturierung und Zuordnung von Transaktionen.
 * Buckets besitzen keinen festen Typ (income/expense/transfer) – dies ergibt sich aus den zugeordneten Transaktionen.
 */
export interface Bucket extends EntityVisualMetadata {
  /** Eindeutige ID des Buckets */
  id: string;
  /** ID des übergeordneten Buckets oder null für Root-Buckets */
  parentId: string | null;
  /**
   * Regulärer Ausdruck zur automatischen Zuordnung von Buchungen (z. B. 'Rewe|Edeka|Aldi|Lidl').
   * Wichtig: Nur Blatt-/Kinder-Buckets dürfen ein Regex-Pattern besitzen!
   */
  regexPattern?: string;
  /** Optionales Soll-Budget für den Bucket */
  targetBudget?: TargetBudget;
  /**
   * IDs der Transaktionen, die diesem Bucket manuell zugewiesen wurden.
   * Ermöglicht die direkte Anzeige und Verwaltung aller manuellen Overrides in der Bucket-Konfiguration.
   */
  manualTransactionIds?: string[];
}

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
 * Repräsentiert ein Bankkonto, Depot oder eine Wallet des Benutzers.
 */
export interface Account extends EntityVisualMetadata {
  /** Eindeutige ID des Kontos */
  id: string;
  /** IDs der diesem Konto zugeordneten Buckets */
  bucketIds: string[];
  /** Historische Stichtags-Salden zur exakten Salden-Rekonstruktion */
  balanceEntries: BalanceEntry[];
}

/**
 * Eine einzelne Finanzbuchung / Transaktion.
 */
export interface Transaction {
  /** Eindeutige, deterministische ID (generiert aus Datum, Betrag, IBAN, Text) */
  id: string;
  /** ID des zugehörigen Kontos */
  accountId: string;
  /** Valuta- / Wertstellungsdatum */
  valueDate: ISODateString;
  /** Buchungsdatum */
  bookingDate: ISODateString;
  /** Auftraggeber / Absender der Zahlung */
  issuer: string;
  /** Empfänger der Zahlung */
  receiver: string;
  /** Verwendungszweck / Buchungstext */
  subject: string;
  /** Typ der Transaktion (Inbound = Einnahme, Outbound = Ausgabe) */
  type: TransactionType;
  /** Zugehörige IBAN des Kontos oder Gegenkontos */
  iban: string;
  /** Betrag der Transaktion (positiv für Inbound, negativ für Outbound) */
  value: number;
  /** ID des zugeordneten Buckets oder null */
  bucketId: string | null;
  /**
   * Zuweisungs-Herkunft:
   * - 'auto_regex': Automatisch via Regex zugewiesen (wird bei Regex-Update neu evaluiert)
   * - 'manual': Vom Nutzer manuell gesetzt (gesperrt gegen automatisches Überschreiben)
   * - 'unassigned': Noch keinem Bucket zugeordnet
   */
  assignmentSource: BucketAssignmentSource;
}

/**
 * Erzeugt das zusammengesetzte Suchfeld (Compound Search String) für eine Transaktion.
 * Wird sowohl für die Freitextsuche als auch für die Regex-Bucket-Zuordnung verwendet.
 *
 * @param {Transaction} tx - Die Transaktion
 * @returns {string} Zusammengesetzter Suchstring
 */
export function buildCompoundSearchField(tx: Transaction): string {
  return [
    tx.accountId,
    tx.issuer,
    tx.receiver,
    tx.subject,
    tx.type,
    tx.value.toString(),
    tx.iban,
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Filteroptionen für die Transaktionsansicht.
 */
export interface TransactionFilterOptions {
  accountId?: string;
  bucketId?: string | 'uncategorized';
  type?: TransactionType | 'all';
  startDate?: ISODateString;
  endDate?: ISODateString;
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
}

/**
 * Konfigurations-Export (leichtgewichtig & portabel – enthält Accounts und Buckets inkl. manualTransactionIds).
 */
export interface FinanceConfigExport {
  version: number;
  exportedAt: string;
  accounts: Account[];
  buckets: Bucket[];
}
