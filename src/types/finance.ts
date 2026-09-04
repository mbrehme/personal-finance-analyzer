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
 * Ermittelt den virtuellen Transaktionstyp (inbound/outbound) rein anhand des Vorzeichens des Betrags:
 * - value >= 0 => 'inbound' (Einnahme)
 * - value < 0 => 'outbound' (Ausgabe)
 *
 * @param {Transaction | { value: number } | number} txOrValue - Transaktion oder Betrag
 * @returns {TransactionType} 'inbound' (Einnahme) oder 'outbound' (Ausgabe)
 * @example
 * const type = getTransactionType({ value: 1200 }); // 'inbound'
 * const typeNegative = getTransactionType(-45.5); // 'outbound'
 */
export function getTransactionType(txOrValue: { value: number } | number): TransactionType {
  const val = typeof txOrValue === 'number' ? txOrValue : txOrValue.value;
  return val >= 0 ? 'inbound' : 'outbound';
}

/**
 * Herkunft der Kategorie-Zuweisung einer Transaktion.
 */
export type CategoryAssignmentSource = 'auto_regex' | 'manual' | 'unassigned';

/** @deprecated Verwende CategoryAssignmentSource */
export type BucketAssignmentSource = CategoryAssignmentSource;

/**
 * Status des Neu-Matching-Prozesses für Transaktionen:
 * - 'needs_reprogress': Relevante Änderungen (z. B. Konfiguration/Kategorien) müssen neu angewendet werden
 * - 'is_reprogressing': Das Re-Matching wird aktuell im Hintergrund ausgeführt
 * - 'has_progressed': Alle Transaktionen sind aktuell und vollständig synchronisiert
 */
export type ReMatchStatus = 'needs_reprogress' | 'is_reprogressing' | 'has_progressed';

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
 * Art des Kontos:
 * - 'real': Echtes Bankkonto (Girokonto, Tagesgeld, Sparkonto etc.) mit IBAN, ohne manuelle Kategorien
 * - 'virtual': Virtuelles Unterkonto (Urlaubstopf, Rücklagen etc.) unter einem echten Konto, gesteuert über Filter-Kategorien
 */
export type AccountType = 'real' | 'virtual';

/**
 * Normalisiert eine IBAN durch Entfernen von Leerzeichen und Konvertierung in Großbuchstaben.
 *
 * @param {string} [iban] - Zu normalisierende IBAN
 * @returns {string} Bereinigte IBAN (z. B. 'DE89370400440532013000')
 * @example
 * normalizeIban('DE89 3704 0044') // 'DE8937040044'
 */
export function normalizeIban(iban?: string): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
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
  /** @deprecated Verwende categoryIds */
  bucketIds?: string[];
  /** Historische Stichtags-Salden zur exakten Salden-Rekonstruktion */
  balanceEntries: BalanceEntry[];
}

/**
 * Eine einzelne Finanzbuchung / Transaktion.
 */
export interface Transaction {
  /** Eindeutige, deterministische ID (generiert aus Datum, Betrag, IBAN, Text) */
  id: string;
  /**
   * @deprecated Nicht mehr statisch persistieren. Kontozugehörigkeit wird dynamisch via accountIban / IBAN oder CategoryId ermittelt.
   */
  accountId?: string;
  /** Eigene Bank-IBAN des Kontos, auf dem die Buchung gebucht wurde */
  accountIban?: string;
  /** Wertstellungsdatum (Valutadatum) der Buchung */
  date: ISODateString;
  /** @deprecated Bitte nur noch `date` verwenden */
  valueDate?: ISODateString;
  /** @deprecated Bitte nur noch `date` verwenden */
  bookingDate?: ISODateString;
  /** Auftraggeber / Absender der Zahlung */
  issuer: string;
  /** Empfänger der Zahlung */
  receiver: string;
  /** Verwendungszweck / Buchungstext */
  subject: string;
  /**
   * Virtueller Typ der Transaktion (Inbound = Einnahme bei value >= 0, Outbound = Ausgabe bei value < 0).
   * Wird nicht in der Datenbank persistiert, sondern dynamisch aus dem Vorzeichen von `value` abgeleitet.
   */
  type?: TransactionType;
  /** Zugehörige IBAN des Kontos oder Gegenkontos */
  iban: string;
  /** Betrag der Transaktion (positiv für Inbound, negativ für Outbound) */
  value: number;
  /** ID der zugeordneten Kategorie oder null */
  categoryId?: string | null;
  /** @deprecated Verwende categoryId */
  bucketId?: string | null;
  /**
   * Zuweisungs-Herkunft:
   * - 'auto_regex': Automatisch via Regex zugewiesen (wird bei Regex-Update neu evaluiert)
   * - 'manual': Vom Nutzer manuell gesetzt (gesperrt gegen automatisches Überschreiben)
   * - 'unassigned': Noch keiner Kategorie zugeordnet
   */
  assignmentSource: CategoryAssignmentSource;
  /** Dateiname der ursprünglichen CSV-Importdatei */
  importFilename?: string;
  /** Zeilenindex der Transaktion in der Importdatei zur Erhaltung der CSV-Reihenfolge */
  importIndex?: number;
  /** Import-Zeitpunkt als ISO-String */
  importedAt?: string;
  /** Herkunft der Transaktion: 'imported' (Default) oder 'manual' */
  origin?: TransactionOrigin;
  /** Unveränderlicher Fingerabdruck der ursprünglichen Bank-Rohdaten (nur bei importierten Buchungen) */
  rawFingerprint?: string;
  /** ID der Ursprungsbuchung, falls diese Buchung aus einem Split hervorging */
  splitFromId?: string;

  /* Flache Original-Felder der Bank-Rohdaten (nur bei importierten Buchungen vorhanden) */
  /** @deprecated Verwende originalAccountIban */
  originalAccountId?: string;
  originalAccountIban?: string;
  /** Ursprüngliches Wertstellungsdatum (Valutadatum) aus den Bank-Rohdaten */
  originalDate?: ISODateString;
  /** @deprecated Bitte originalDate verwenden */
  originalValueDate?: ISODateString;
  /** @deprecated Bitte originalDate verwenden */
  originalBookingDate?: ISODateString;
  originalValue?: number;
  originalSubject?: string;
  originalReceiver?: string;
  originalIssuer?: string;
  originalIban?: string;
  /** Zeitstempel der Löschung als ISO-String (falls gelöscht / im Papierkorb) */
  deletedAt?: string;
}

/**
 * Herkunft einer Transaktion.
 */
export type TransactionOrigin = 'imported' | 'manual';

/**
 * Ermittelt, ob eine importierte Transaktion manuell überschrieben oder angepasst wurde.
 * Prüft auf Feldebene, ob aktuelle Werte von den ursprünglichen Bankwerten abweichen.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @returns {boolean} true, wenn Felder vom ursprünglichen Bank-Rohstand abweichen
 */
export function isTransactionOverridden(tx: Transaction): boolean {
  const currentPartner = (tx.receiver || tx.issuer || '').trim();
  const origPartner = (tx.originalReceiver || tx.originalIssuer || '').trim();
  const hasOrigPartner = tx.originalReceiver !== undefined || tx.originalIssuer !== undefined;
  const isPartnerOverridden =
    hasOrigPartner && origPartner !== '' && currentPartner !== origPartner;

  const originalDate = tx.originalDate ?? tx.originalValueDate;
  const currentDate = tx.date ?? tx.valueDate;
  const isDateOverridden = originalDate !== undefined && currentDate !== originalDate;

  return (
    (tx.originalValue !== undefined && tx.value !== tx.originalValue) ||
    (tx.originalSubject !== undefined && tx.subject !== tx.originalSubject) ||
    isPartnerOverridden ||
    isDateOverridden ||
    (tx.originalAccountIban !== undefined && tx.accountIban !== tx.originalAccountIban) ||
    (tx.originalAccountId !== undefined && tx.accountId !== tx.originalAccountId) ||
    (tx.originalIban !== undefined && tx.iban !== tx.originalIban) ||
    Boolean(tx.splitFromId)
  );
}

/**
 * Prüft, ob eine Transaktion manuell ist (manuell erfasst, gesplittet oder überschrieben).
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @returns {boolean} true, wenn die Buchung manuell angelegt, gesplittet oder überschrieben wurde
 */
export function isManualTransaction(tx: Transaction): boolean {
  return tx.origin === 'manual' || Boolean(tx.splitFromId) || isTransactionOverridden(tx);
}

/**
 * Setzt alle bearbeiteten Felder einer importierten Transaktion auf die ursprünglichen
 * Bank-Rohdaten zurück. Felder ohne gespeichertes Original bleiben unberührt.
 * Split-Zugehörigkeit (`splitFromId`) und `deletedAt` werden dabei ebenfalls entfernt.
 *
 * @param {Transaction} tx - Die zurückzusetzende Transaktion
 * @returns {Transaction} Neues Transaktionsobjekt mit wiederhergestellten Original-Feldern
 * @example
 * const restored = resetTransactionToOriginal(modifiedTx);
 */
export function resetTransactionToOriginal(tx: Transaction): Transaction {
  const { splitFromId: _splitFromId, deletedAt: _deletedAt, ...rest } = tx;
  const restoredDate = tx.originalDate ?? tx.originalValueDate ?? tx.date ?? tx.valueDate;
  return {
    ...rest,
    value: tx.originalValue ?? tx.value,
    subject: tx.originalSubject ?? tx.subject,
    receiver: tx.originalReceiver ?? tx.receiver,
    issuer: tx.originalIssuer ?? tx.issuer,
    date: restoredDate,
    valueDate: restoredDate,
    bookingDate: tx.originalBookingDate ?? restoredDate,
    originalDate: tx.originalDate ?? tx.originalValueDate,
    accountId: tx.originalAccountId ?? tx.accountId,
    accountIban: tx.originalAccountIban ?? tx.accountIban,
    iban: tx.originalIban ?? tx.iban,
    categoryId: null,
    bucketId: null,
    assignmentSource: 'unassigned',
  };
}

/**
 * Erzeugt das zusammengesetzte Suchfeld (Compound Search String / Searchable Key) für eine Transaktion.
 * Format: `[Typ] Empfänger: Zweck (Iban)`
 * (z. B. `[Ausgang] REWE Markt: Einkauf Lebensmittel (DE1234567890)`)
 *
 * Wird sowohl für die Freitextsuche als auch für die regelbasierte Regex-Bucket-Zuordnung verwendet.
 *
 * @param {Transaction} tx - Die zu verarbeitende Transaktion
 * @returns {string} Zusammengesetzter Suchstring nach dem Schema `[Typ] Empfänger: Zweck (Iban)`
 * @example
 * const key = buildCompoundSearchField(transaction);
 * // "[Ausgang] REWE Markt: Einkauf (DE1234567890)"
 */
export function buildCompoundSearchField(tx: Transaction): string {
  const type = getTransactionType(tx) === 'inbound' ? 'Eingang' : 'Ausgang';
  const receiver = (tx.receiver || tx.issuer || '').trim();
  const subject = (tx.subject || '').trim();
  const iban = (tx.iban || '').trim();

  return `[${type}] ${receiver}: ${subject} (${iban})`;
}

/**
 * Filteroptionen für die Transaktionsansicht.
 */
export interface TransactionFilterOptions {
  accountId?: string;
  categoryId?: string | 'uncategorized' | 'assigned' | 'manual';
  bucketId?: string | 'uncategorized';
  type?: TransactionType | 'all';
  origin?: 'all' | 'imported' | 'manual';
  startDate?: ISODateString;
  endDate?: ISODateString;
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
}

/**
 * Sortiert eine Liste von Transaktionen deterministisch und konsistent absteigend nach Datum (neueste zuerst),
 * wobei für Buchungen des gleichen Tages die Reihenfolge aus dem CSV-Import (importIndex) erhalten bleibt.
 *
 * @param {Transaction[]} txList - Die zu sortierenden Transaktionen
 * @returns {Transaction[]} Eine neue sortierte Liste von Transaktionen
 */
export function sortTransactionsDesc(txList: Transaction[]): Transaction[] {
  const idsInList = new Set(txList.map((t) => t.id));

  // Split-Kinder sammeln (nur wenn der zugehörige Parent ebenfalls in txList vorhanden ist)
  const childrenByParent = new Map<string, Transaction[]>();
  const rootTransactions: Transaction[] = [];

  for (const tx of txList) {
    if (tx.splitFromId && idsInList.has(tx.splitFromId)) {
      const list = childrenByParent.get(tx.splitFromId) || [];
      list.push(tx);
      childrenByParent.set(tx.splitFromId, list);
    } else {
      rootTransactions.push(tx);
    }
  }

  const compareBase = (a: Transaction, b: Transaction) => {
    // 1. Primär: Wertstellungsdatum (Valutadatum) absteigend (neueste Tage zuerst)
    const dateA = a.date || a.valueDate || '';
    const dateB = b.date || b.valueDate || '';
    const dateComp = dateB.localeCompare(dateA);
    if (dateComp !== 0) return dateComp;

    // 2. Sekundär: Import-Zeitpunkt (falls aus unterschiedlichen Import-Dateien)
    if (a.importedAt && b.importedAt && a.importedAt !== b.importedAt) {
      return b.importedAt.localeCompare(a.importedAt);
    }

    // 3. Tertiär: Zeilen-Reihenfolge innerhalb derselben CSV-Datei (importIndex)
    if (a.importIndex !== undefined && b.importIndex !== undefined) {
      return a.importIndex - b.importIndex;
    }

    // 4. Betrag (höhere Beträge zuerst)
    if (b.value !== a.value) return b.value - a.value;

    // 5. Deterministischer Tie-Breaker: Transaktions-ID
    return b.id.localeCompare(a.id);
  };

  rootTransactions.sort(compareBase);

  // Kinder untereinander sortieren
  for (const list of childrenByParent.values()) {
    list.sort(compareBase);
  }

  const result: Transaction[] = [];

  for (const root of rootTransactions) {
    result.push(root);
    const children = childrenByParent.get(root.id);
    if (children) {
      for (const child of children) {
        result.push(child);
      }
    }
  }
  return result;
}

/**
 * Detaillierte Kontozuordnung für eine Transaktion.
 * Berücksichtigt das primäre Buchungskonto, das Gegenkonto (bei Umbuchungen zwischen echten Konten)
 * sowie alle betroffenen virtuellen Unterkonten.
 */
export interface TransactionAccountInfo {
  /** Das primäre Buchungskonto der Transaktion */
  primaryAccount?: Account;
  /** Das Gegenkonto bei einer erkannten Umbuchung zwischen zwei echten Konten */
  counterAccount?: Account;
  /** Virtuelle Unterkonten, deren Filter-Kriterien auf diese Buchung zutreffen */
  virtualAccounts: Account[];
  /** Alle eindeutigen Konten (primär, Gegenkonto und virtuelle Unterkonten) */
  allAccounts: Account[];
}

/**
 * Ermittelt alle Konten, die einer Transaktion zugeordnet sind.
 * - Primäres Konto: Entspricht `tx.accountId` bzw. matching IBAN.
 * - Gegenkonto: Wenn `tx.iban` mit der IBAN eines anderen echten Kontos übereinstimmt (Umbuchung zwischen realen Konten).
 * - Virtuelle Unterkonten: Alle Unterkonten des primären Kontos (oder des Gegenkontos),
 *   deren Kategorie-Filter mit der Kategorie der Transaktion übereinstimmt.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {Account[]} accounts - Alle im Workspace konfigurierten Konten
 * @returns {TransactionAccountInfo} Vollständige Kontozuordnung der Transaktion
 * @example
 * const info = getTransactionAccountInfo(tx, accounts);
 * console.log(info.primaryAccount?.name, info.counterAccount?.name, info.virtualAccounts);
 */
export function getTransactionAccountInfo(
  tx: Transaction,
  accounts: Account[]
): TransactionAccountInfo {
  const normAccountIban = normalizeIban(tx.accountIban);
  const normTxIban = normalizeIban(tx.iban);

  // 1. Primäres Buchungskonto:
  // Vorrang 1: tx.accountIban matcht ein echtes Konto
  // Vorrang 2: tx.accountId (Abwärtskompatibilität für Altdaten)
  // Vorrang 3: tx.iban matcht ein echtes Konto (falls nur Gegenkonto/IBAN gesetzt)
  let primaryAccount: Account | undefined;
  if (normAccountIban) {
    primaryAccount = accounts.find(
      (a) => a.accountType !== 'virtual' && a.iban && normalizeIban(a.iban) === normAccountIban
    );
  }
  if (!primaryAccount && tx.accountId) {
    primaryAccount = accounts.find((a) => a.id === tx.accountId);
  }
  if (!primaryAccount && normTxIban) {
    primaryAccount = accounts.find(
      (a) => a.accountType !== 'virtual' && a.iban && normalizeIban(a.iban) === normTxIban
    );
  }

  // 2. Gegenkonto bei Umbuchung (Transfer zwischen echten Bankkonten via IBAN)
  const counterAccount =
    normTxIban && primaryAccount
      ? accounts.find(
          (a) =>
            a.id !== primaryAccount.id &&
            a.accountType !== 'virtual' &&
            Boolean(a.iban && normalizeIban(a.iban) === normTxIban)
        )
      : undefined;

  // 3. Virtuelle Unterkonten (Category Match)
  const txCatId = tx.categoryId ?? tx.bucketId ?? null;
  const virtualAccounts = accounts.filter((a) => {
    if (a.accountType !== 'virtual') return false;
    const catIds = a.categoryIds || a.bucketIds || [];
    if (catIds.length > 0 && (!txCatId || !catIds.includes(txCatId))) return false;

    if (a.parentAccountId) {
      const isUnderPrimary = primaryAccount ? a.parentAccountId === primaryAccount.id : false;
      const isUnderCounter = counterAccount ? a.parentAccountId === counterAccount.id : false;
      return isUnderPrimary || isUnderCounter;
    }
    return false;
  });

  // 4. Alle eindeutigen Konten
  const accountMap = new Map<string, Account>();
  if (primaryAccount) accountMap.set(primaryAccount.id, primaryAccount);
  if (counterAccount) accountMap.set(counterAccount.id, counterAccount);
  virtualAccounts.forEach((v) => accountMap.set(v.id, v));

  return {
    primaryAccount,
    counterAccount,
    virtualAccounts,
    allAccounts: Array.from(accountMap.values()),
  };
}

/**
 * Ermittelt den effektiven Betrag einer Transaktion aus der Perspektive eines bestimmten Kontos
 * (egal ob echtes Bankkonto oder virtuelles Unterkonto).
 *
 * Regeln:
 * 1. Virtuelles Unterkonto:
 *    - Muss ein übergeordnetes Hauptkonto besitzen (`parentAccountId`).
 *    - Die Transaktion muss das übergeordnete Hauptkonto tangieren (entweder als primäres Buchungskonto
 *      oder als Gegenkonto/Empfänger bei einer Umbuchung).
 *    - Die Transaktion muss der konfigurierten Kategorie des virtuellen Unterkontos entsprechen (`categoryIds`).
 *    - Falls die Kategorie auf einem fremden Konto gebucht wurde, wird sie NICHT einbezogen (`null`).
 * 2. Vorzeichen-Logik (Geldfluss-Richtung):
 *    - Wenn das Konto (bzw. dessen Hauptkonto) das primäre Buchungskonto ist:
 *      Der Betrag entspricht `tx.value` (z. B. -500 bei Ausgabe / Überweisung).
 *    - Wenn das Konto (bzw. dessen Hauptkonto) das Gegenkonto (Empfänger) ist:
 *      Eine negative Buchung auf dem sendenden Konto ist ein positiver Eingang auf dem empfangenden Konto!
 *      Der Betrag ist `-tx.value` (z. B. -(-500) = +500).
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {Account} targetAccount - Das Zielkonto (real oder virtual)
 * @param {Account[]} accounts - Alle im Workspace konfigurierten Konten zur Beziehungsauflösung
 * @returns {number | null} Effektiver Betrag aus Sicht des Kontos, oder null wenn die Buchung das Konto nicht betrifft
 * @example
 * const delta = getTransactionEffectiveValueForAccount(tx, targetAccount, accounts);
 * if (delta !== null) {
 *   console.log(`Effektiver Betrag für ${targetAccount.name}: ${delta} €`);
 * }
 */
export function getTransactionEffectiveValueForAccount(
  tx: Transaction,
  targetAccount: Account,
  accounts: Account[]
): number | null {
  const info = getTransactionAccountInfo(tx, accounts);

  if (targetAccount.accountType === 'virtual') {
    if (!info.virtualAccounts.some((v) => v.id === targetAccount.id)) {
      return null;
    }
    // Falls das übergeordnete Konto das Gegenkonto (Empfänger der Umbuchung) ist:
    // Eine negative Buchung auf dem Sendekonto ist ein positiver Eingang auf dem Zielkonto!
    if (info.counterAccount && targetAccount.parentAccountId === info.counterAccount.id) {
      return -tx.value;
    }
    return tx.value;
  }

  // Echtes Bankkonto: Rein transaktionsbasiert ohne Kategoriefilterung und ohne Gegenkonto-Projektion
  if (info.primaryAccount && info.primaryAccount.id === targetAccount.id) {
    return tx.value;
  }

  return null;
}

/**
 * Prüft, ob eine Transaktion mit einem ausgewählten Konto-Filter übereinstimmt.
 * Berücksichtigt primäre Konten, Gegenkonten (bei Umbuchungen) und virtuelle Unterkonten.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {string} accountId - Die ausgewählte Konto-ID oder 'all'
 * @param {Account[]} accounts - Alle verfügbaren Konten
 * @returns {boolean} True, wenn die Buchung zum Konto gehört
 * @example
 * if (isTransactionMatchingAccount(tx, 'acc-unterkonto', accounts)) {
 *   // Transaktion betrifft dieses Unterkonto
 * }
 */
export function isTransactionMatchingAccount(
  tx: Transaction,
  accountId: string,
  accounts: Account[]
): boolean {
  if (accountId === 'all') return true;
  const targetAcc = accounts.find((a) => a.id === accountId);
  if (targetAcc) {
    return getTransactionEffectiveValueForAccount(tx, targetAcc, accounts) !== null;
  }
  const info = getTransactionAccountInfo(tx, accounts);
  return info.allAccounts.some((a) => a.id === accountId);
}

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
 * Optionen für das selektive Zurücksetzen des Workspace.
 */
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
  /** Alle Transaktionen / Buchungen zurücksetzen oder leeren */
  resetTransactions?: boolean;
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
  /** @deprecated Abwärtskompatibilität für alte Exporte */
  buckets?: Category[];
  /** Manuell erstellte Buchungen, Splits und modifizierte Overrides */
  manualTransactions?: Transaction[];
  /** Vollständiger Buchungsbestand aller Transaktionen */
  transactions?: Transaction[];
  /** Gelöschte Buchungen (damit sie beim Re-Import oder Gerätewechsel gelöscht bleiben) */
  deletedTransactions?: Transaction[];
}
