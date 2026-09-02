# Plan: Personal Finance Analyzer – Lokale Finanzverwaltung & Analyse

* **Status:** Entwurf
* **Erstellt am:** 2026-09-02
* **Bearbeiter:** Antigravity & Entwickler-Team

---

## 1. Ziel & Übersicht
Entwicklung einer 100% lokalen, datenschutzfreundlichen Frontend-Anwendung zur Verwaltung, Kategorisierung und Analyse von Finanzdaten.
Sämtliche Daten (Konten, Buchungen, Kategorien/Buckets) verbleiben ausschließlich im Browser des Nutzers (Local-First via IndexedDB/LocalStorage) und werden clientseitig verarbeitet.

Die Anwendung gliedert sich in vier Kernbereiche:
1. **Configuration (`/configuration`):** Verwaltung von hierarchischen Buckets (inkl. Regex-Matching, Soll-Budgets, JSON Import/Export) und Konten mit historischen Balance-Einträgen.
2. **Data / Transactions (`/transactions`):** CSV-Upload mit flexiblem Spalten-Mapper, automatisches Regex-Bucket-Matching und erweiterte Filter- und Tabellenansichten.
3. **Cashflow (`/cashflow`):** Einkommens- und Ausgabenmatrix auf Bucket- und Account-Ebene über frei wählbare Zeiträume und Granularitäten (Monat, Quartal, Halbjahr, Jahr) mit Soll-Ist-Vergleich.
4. **Balances (`/balances`):** Historische und prognostizierte Kontostand-Entwicklung basierend auf Stichtags-Salden und Transaktions-Cashflows.

---

## 2. Anforderungen & User Stories

### A. Datenschutz & Speicherung (Local-First)
- [ ] Alle Transaktionen, Buckets und Konten werden im Browser persistiert (IndexedDB).
- [ ] Vollständiger JSON-Export und -Import der gesamten Konfiguration und Transaktionsdaten.

### B. Configuration (Buckets & Accounts)
- [ ] **Hierarchische Buckets:** Baumstruktur (Parent- & Child-Buckets) mit auf-/zuklappbarer Tabellendarstellung.
- [ ] **Kein fester Bucket-Typ:** Buckets besitzen keinen festen Typ (`income/expense`), sondern dienen als flexible Cluster.
- [ ] **Regex-Kategorisierung:** Regex-Regeln können ausschließlich für Child-/Leaf-Buckets definiert werden (Verwendungszweck, Empfänger, IBAN).
- [ ] **Soll-Werte (Budgets):** Konfigurierbare Budgets pro Bucket für Monat, Quartal, Halbjahr oder Jahr.
- [ ] **Account und Bucket Import/Export:** Export und Import der Bucket- und Account-Konfiguration als JSON-Datei.
- [ ] **Accounts & Balance-Einträge:** Anlegen von Konten und Erfassen von Stichtags-Salden (Stand zu Datum X mit `ISODateString`).

### C. Data (Transactions & CSV Import)
- [ ] **CSV-Importer:** Intelligenter Import mit automatischer Erkennung und manuellem Spalten-Mapping (`valueDate`, `bookingDate`, `issuer`, `receiver`, `subject`, `type`, `iban`, `value`).
- [ ] **Uniqueness:** Sicherstellen, dass Transaktionen unique sind (eindeutige ID aus Hash/Kombination relevanter Spalten).
- [ ] **Auto-Bucket-Matching:** Automatische Zuordnung von Transaktionen zu Buckets bei Import sowie bei Änderung der Regex-Konfiguration.
- [ ] **Transaktionstabelle:** Filterung der einzelnen Spalten mit Bezugnahme zum Typ (Dropdown, Datepicker, Freitext, Betrag).
- [ ] **Manueller Eingriff:** Möglichkeit, Transaktionen manuell einem Bucket zuzuordnen (mit `manualBucketOverride`), was in der Konfiguration gespeichert und exportiert wird.

### D. Cashflow-Analyse
- [ ] **Matrix-Ansicht:** Zeilen = Buckets (collapsible, Kindersummen rollen zu Eltern hoch), Spalten = Zeitperioden (`YearMonthString` bzw. Periodenschlüssel).
- [ ] **Granularität:** Umschaltbar zwischen Monat, Quartal, Halbjahr und Jahr.
- [ ] **Soll-Ist-Abgleich:** Gegenüberstellung der tatsächlichen Ausgaben/Einnahmen mit den Bucket-Sollwerten.

### E. Balances (Kontostände)
- [ ] **Verlaufsanalyse:** Rekonstruktion und Darstellung des Kontostands über Zeitintervalle basierend auf hinterlegten Stichtagssalden und Cashflows.
- [ ] Umschaltbare Granularität und Filterung nach Konten.

---

## 3. Technische Konzeption & Betroffene Komponenten

### Datenmodell & Types (`src/types/finance.ts`)
```ts
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
 * Soll-Budget für einen Bucket bezogen auf eine bestimmte Zeitperiode.
 */
export interface TargetBudget {
  period: PeriodGranularity;
  amount: number;
}

/**
 * Basis-Schnittstelle für visuelle Metadaten (Titel, Farbe, Icon, Beschreibung).
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
}

/**
 * Hierarchischer Bucket zur Kategorisierung und Clusterung von Transaktionen.
 * Besitzt keinen festen Typ (Ausgabe/Einnahme) – dies ergibt sich aus den zugeordneten Transaktionen.
 */
export interface Bucket extends EntityVisualMetadata {
  /** Eindeutige ID des Buckets */
  id: string;
  /** ID des übergeordneten Buckets oder `null` für Root-Buckets */
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
   * Ermöglicht die direkte Anzeige aller manuellen Overrides in der Bucket-Konfiguration.
   */
  manualTransactionIds?: string[];
}

/**
 * Historischer Kontostand-Eintrag (Stichtags-Saldo) zu einem bestimmten Datum.
 */
export interface BalanceEntry {
  id: string;
  date: ISODateString; // Eindeutig als ISO YYYY-MM-DD typisiert
  amount: number;
  note?: string;
}

/**
 * Repräsentiert ein Bankkonto, Depot oder eine Wallet des Benutzers.
 */
export interface Account extends EntityVisualMetadata {
  /** Eindeutige ID des Kontos */
  id: string;
  /** Optionale IBAN */
  iban?: string;
  /** Währungscode (Standard 'EUR') */
  currency: string;
  /** IDs der diesem Konto zugeordneten Buckets */
  bucketIds: string[];
  /** Historische Stichtags-Salden zur exakten Salden-Rekonstruktion */
  balanceEntries: BalanceEntry[];
}

/**
 * Herkunft der Bucket-Zuweisung einer Transaktion.
 */
export type BucketAssignmentSource = 'auto_regex' | 'manual' | 'unassigned';

/**
 * Eine einzelne Finanzbuchung / Transaktion.
 */
export interface Transaction {
  /** Eindeutige, deterministische ID (generiert aus Datum, Betrag, IBAN, Text) */
  id: string;
  accountId: string;
  valueDate: ISODateString;   // Valuta-Datum
  bookingDate: ISODateString; // Buchungsdatum
  issuer: string;
  receiver: string;
  subject: string;
  type: TransactionType;
  iban: string;
  value: number;              // Positiver (Inbound) oder negativer (Outbound) Betrag
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
 * Erzeugt das zusammengesetzte Suchfeld (Compound Search String) für eine Transaktion.
 * Wird sowohl für die Freitextsuche als auch für die Regex-Bucket-Zuordnung verwendet.
 *
 * Format: `${accountId} | ${issuer} | ${receiver} | ${subject} | ${type} | ${value} | ${iban}`
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
 * Konfigurations-Export (leichtgewichtig & portabel – enthält Accounts, Buckets inkl. manualTransactionIds).
 */
export interface FinanceConfigExport {
  version: number;
  exportedAt: string;
  accounts: Account[];
  buckets: Bucket[];
}
```

### Date-Utilities (`src/utils/dateUtils.ts`)
- `isValidDateString(dateStr: string): dateStr is ISODateString`
- `toISODateString(dateInput: Date | string | number): ISODateString`
- `formatDate(dateStr: ISODateString): string`
- `getPeriodKey(dateStr: ISODateString, granularity: PeriodGranularity): string`
- `formatPeriodLabel(periodKey: string, granularity: PeriodGranularity): string`
- `normalizeBudgetToGranularity(amount: number, from: PeriodGranularity, to: PeriodGranularity): number`

### State- & Speicher-Layer (`src/services/storage/`)
- `db.ts`: IndexedDB-Wrapper zur schnellen und unbegrenzten lokalen Speicherung von Accounts, Buckets und Transaktionen.
- `matcher.ts`: Regex-Evaluator, der Transaktionen gegen Child-Buckets matcht.
- `csvParser.ts`: Robuster CSV-Parser mit Erkennung von Trennzeichen (Semikolon, Komma), Datumsformaten (`DD.MM.YYYY`, `YYYY-MM-DD`) und deutschen Zahlenformaten (`1.234,56`).
- `FinanceContext.tsx`: React Context State mit persistenten CRUD-Operationen für Accounts, Buckets und Transaktionen.

### Komponenten & Seiten
* **`src/components/`:**
  - `Header.tsx`: Navigation erweitert um `/configuration`, `/transactions`, `/cashflow`, `/balances`.
  - `TreeTable/`: Generische einklappbare Baumtabelle für Buckets und Cashflow.
  - `CsvImportModal/`: Dialog mit Datei-Upload, Spalten-Vorschau und Zuordnungs-Assistent.
  - `BucketModal/`: Dialog zum Erstellen/Bearbeiten von Buckets inkl. Regex und Soll-Budget.
  - `AccountModal/`: Dialog zum Verwalten von Konten und Kontostands-Stichtagen.
  - `PeriodSelector.tsx`: Dropdown/Tabs für Granularität (Monat, Quartal, Halbjahr, Jahr).
* **`src/pages/`:**
  - `Configuration.tsx`: Tabs für Buckets (Baumtabelle, Regex, Budgets) und Kontoverwaltung.
  - `Transactions.tsx`: Filterleiste, Upload-Trigger und Transaktionstabelle.
  - `Cashflow.tsx`: Matrix-Tabelle (Einnahmen/Ausgaben nach Buckets über Zeitachsen).
  - `Balances.tsx`: Kontostands-Matrix und Verlauf über Zeiträume.

---

## 4. Schrittweiser Umsetzungsplan

1. [ ] **Schritt 1: Domain-Modell & Local-First Storage Layer**
   - Datei: `src/types/finance.ts` & `src/utils/dateUtils.ts` (vollständige Interfaces & ISODateString-Helfer)
   - Datei: `src/services/storage/db.ts` & `src/services/storage/FinanceContext.tsx`
   - Datei: `src/services/storage/db.test.ts` (Unit-Tests für lokale Persistenz)

2. [ ] **Schritt 2: Regex-Matching Engine & CSV-Parser**
   - Datei: `src/services/matcher/regexMatcher.ts` & `regexMatcher.test.ts`
   - Datei: `src/services/csv/csvParser.ts` & `csvParser.test.ts`

3. [ ] **Schritt 3: Configuration Page (`/configuration`)**
   - Hierarchische Bucket-Baumtabelle (Collapsible, Regex-Validierung, Budgets)
   - Bucket Modal & JSON Import/Export
   - Account-Verwaltung & Stichtags-Salden (`BalanceEntry` mit `ISODateString`)
   - Tests für Bucket- und Account-Operationen

4. [ ] **Schritt 4: Transactions Page (`/transactions`)**
   - CSV-Import Wizard mit Mapping & Voransicht (Konvertierung in `ISODateString`)
   - Automatische Bucket-Zuweisung mit manueller Override-Möglichkeit
   - Leistungsfähige Filter- und Sortierleiste mit Datumsfiltern
   - Tests für Filter- und Transaktionsverwaltung

5. [ ] **Schritt 5: Cashflow Page (`/cashflow`)**
   - Aggregations-Engine für Zeitintervalle (Monat, Quartal, Halbjahr, Jahr)
   - Collapsible Matrix-Tabelle mit Soll-Ist-Vergleich
   - Tests für Cashflow-Berechnung und Aggregation

6. [ ] **Schritt 6: Balances Page (`/balances`)**
   - Salden-Berechnungs-Engine (Kombination aus Stichtagen und Cashflow-Deltas)
   - Kontostands-Tabelle über ausgewählte Zeiträume
   - Tests für Kontostand-Berechnung

7. [ ] **Schritt 7: Navigation, Design-Feinschliff & Dokumentation**
   - Anpassung der Hauptnavigation in `Header.tsx` und `App.tsx`
   - Aktualisierung von `README.md` und Archivierung des Plans

---

## 5. Verifikationsplan

### Automatisierte Tests
- [ ] Unit-Tests für Regex-Matching, CSV-Parsing und Aggregation (`pnpm test`)
- [ ] Testabdeckung prüfen (`pnpm test:coverage`)
- [ ] TypeScript Check & Production Build (`pnpm build`)

### Manuelle Verifikation im Browser (`pnpm dev`)
- [ ] Konten und verschachtelte Buckets mit Regex anlegen und als JSON exportieren/importieren.
- [ ] Beispiel-Bank-CSV importieren und automatische Zuweisung zu Buckets prüfen.
- [ ] Im Cashflow zwischen Monaten, Quartalen, Halbjahren und Jahren wechseln und aggregierte Summen auf Parent-Ebene verifizieren.
- [ ] In Balances prüfen, ob Stichtags-Salden mit den zwischenzeitlichen Transaktionen korrekt fortgeschrieben werden.
