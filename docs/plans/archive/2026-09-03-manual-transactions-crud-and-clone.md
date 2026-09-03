# Plan: Manuelle Transaktionen, Overrides & Buchungs-Split (Nebeneinander-Vergleich & Tag-gebundener Fingerprint)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Benutzer sollen Transaktionen manuell erfassen, bestehende Buchungen bearbeiten (überschreiben) und vorhandene Buchungen aufteilen (**Split**) können.

### Visuelles Side-by-Side Konzept im Modal:

Beim Bearbeiten von importierten Buchungen und beim Split werden die Felder **nebeneinander** dargestellt:

- **Linke Spalte (Originale Bankdaten):** Schreibgeschützt, dezent hervorgehoben (`bg-slate-50`), zeigt exakt die unveränderten Rohdaten der Bank (`originalValue`, `originalSubject`, `originalReceiver`, `originalValueDate`).
- **Rechte Spalte (Editierbare Anpassungen):** Interaktive Eingabefelder für deine Anpassungen (Datum, Betrag via `MoneyInput`, Empfänger, Verwendungszweck, Kategorie) mit visueller Markierung geänderter Werte.

---

## 2. Visuelles Side-by-Side Layout im `TransactionModal`

### 2.1 Modus `edit` (Buchung bearbeiten / überschreiben)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Buchung bearbeiten                                                [X] │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Original Bankdaten (Read-only)  │  Deine Anpassung (Editierbar)       │
│  ──────────────────────────────  │  ────────────────────────────       │
│  Datum:                          │  Datum:                             │
│  [ 2026-01-15 ]                  │  [ 2026-01-15             📅 ]      │
│                                  │                                     │
│  Betrag:                         │  Betrag & Typ:                      │
│  [ -100,00 € (Ausgabe) ]         │  [ (-) Ausgabe ] [ 100,00 € ]       │
│                                  │                                     │
│  Empfänger:                      │  Empfänger:                         │
│  [ REWE MARKT GMBH ]             │  [ REWE Markt ] (angepasst)         │
│                                  │                                     │
│  Verwendungszweck:               │  Verwendungszweck:                  │
│  [ REWE SAG DANKE FILIALE 12 ]   │  [ Wocheneinkauf ] (angepasst)      │
│                                  │                                     │
│  IBAN / Konto:                   │  Kategorie:                         │
│  [ DE89... / Girokonto ]         │  [ Lebensmittel               ▼ ]   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

- Weicht ein Feld vom Original ab, wird es visuell mit einem dezenten Indikator ("Geändert") hervorgehoben.
- Ein kleiner Reset-Button erlaubt das Zurücksetzen einzelner Felder auf den Originalwert der Bank.

### 2.2 Modus `split` (Buchung aufteilen)

- **Links (Originalbuchung):**
  - Originalbetrag: `100,00 €`
  - **Verbleibender Restbetrag nach Split:** `70,00 €` (wird live berechnet)
  - Zweck & Empfänger des Originals
- **Rechts (Neue Split-Teilbuchung):**
  - **Teilbetrag für neuen Split:** `MoneyInput` (z. B. `30,00 €`)
  - Validierung: Sperrt Speichern bei Teilbetrag $\ge$ Originalbetrag (Restbetrag kann nicht unter 0 fallen).
  - Neuer Zweck & neue Kategorie für den Split-Teil.

### 2.3 Modus `create` (Neue manuelle Buchung von Grund auf)

- Zeigt das aufgeräumte, fokussierte Formular ohne Original-Spalte.

---

## 3. Datenmodell (`src/types/finance.ts`)

```ts
export type TransactionOrigin = 'imported' | 'manual';

export interface Transaction {
  id: string;
  accountId: string;
  valueDate: ISODateString;
  bookingDate: ISODateString;
  issuer: string;
  receiver: string;
  subject: string;
  type: TransactionType;
  iban: string;
  value: number;
  categoryId?: string | null;
  bucketId?: string | null;
  assignmentSource: CategoryAssignmentSource;
  importFilename?: string;
  importIndex?: number;
  importedAt?: string;

  /** Herkunft: 'imported' (Default) oder 'manual' */
  origin?: TransactionOrigin;
  /** Unveränderlicher Fingerabdruck der Bank-Rohdaten */
  rawFingerprint?: string;
  /** ID der Ursprungsbuchung bei Split */
  splitFromId?: string;

  /** Flache Originalfelder der Bank-Rohdaten (unveränderlich aus CSV) */
  originalAccountId?: string;
  originalValueDate?: ISODateString;
  originalBookingDate?: ISODateString;
  originalValue?: number;
  originalSubject?: string;
  originalReceiver?: string;
  originalIssuer?: string;
  originalIban?: string;
}

export interface FinanceConfigExport {
  version: number;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  buckets?: Category[];
  /** Nur manuelle Buchungen und modifizierte Buchungen (Overrides) */
  manualTransactions?: Transaction[];
}

/** Hilfsfunktion zur Ermittlung, ob eine Buchung überschrieben wurde */
export function isTransactionOverridden(tx: Transaction): boolean {
  if (!tx.rawFingerprint) return false;
  return (
    (tx.originalValue !== undefined && tx.value !== tx.originalValue) ||
    (tx.originalSubject !== undefined && tx.subject !== tx.originalSubject) ||
    (tx.originalReceiver !== undefined && tx.receiver !== tx.originalReceiver) ||
    (tx.originalValueDate !== undefined && tx.valueDate !== tx.originalValueDate) ||
    (tx.categoryId != null && tx.assignmentSource === 'manual')
  );
}
```

---

## 4. Tag-gebundener `rawFingerprint`

```ts
export function computeRawFingerprint(
  accountId: string,
  valueDate: string,
  value: number,
  subject: string,
  partner: string = '',
  iban: string = '',
  occurrenceIndex: number = 0
): string {
  const normSubject = (subject || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normPartner = (partner || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normIban = (iban || '').trim().toUpperCase().replace(/\s+/g, '');
  const rawKey = `${accountId}|${valueDate}|${value.toFixed(2)}|${normSubject}|${normPartner}|${normIban}|${occurrenceIndex}`;

  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(36)}`;
}
```

---

## 5. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen in `src/types/finance.ts` & Fingerprint in `src/services/csv/csvParser.ts`**
   - Flache `original*`-Felder auf `Transaction`, `isTransactionOverridden(tx)` Helper.
   - Tag-gebundenes Occurrence-Tracking (`dayKey`) in `csvParser.ts`.
2. [x] **Schritt 2: Storage & Context in `FinanceContext.tsx` & `db.ts`**
   - `addTransaction`, `updateTransaction`, `splitTransaction`.
   - Re-Applying von Overrides bei CSV-Import anhand `rawFingerprint`.
   - Schlanker Export von `manualTransactions` (`origin === 'manual'` oder `isTransactionOverridden(t)`).
3. [x] **Schritt 3: `TransactionModal.tsx` mit Side-by-Side Layout & Tests**
   - Side-by-Side Anzeige (Original Bankdaten vs. anpassbare Werte).
   - Modi `create`, `edit` und `split`.
   - Validierung gegen negative Restbeträge, Vorbelegung, `MoneyInput`.
4. [x] **Schritt 4: Buchungsansicht `Transactions.tsx` & Tests**
   - "+ Neue Buchung", Zeilenaktionen "Bearbeiten" und "Aufteilen", Badges und Herkunftsfilter.
5. [x] **Schritt 5: Test-Suite & Build verifizieren**
   - `pnpm test`, `pnpm build`, `pnpm format:check`.

---

## 6. Verifikationsplan

- [x] `pnpm test` (Unit-Tests für Side-by-Side Modal, Split, Overrides, Re-Import von Jahresexport)
- [x] `pnpm build` & `pnpm format:check`
- [x] Manuelle Prüfung des Side-by-Side Modals im Browser.
