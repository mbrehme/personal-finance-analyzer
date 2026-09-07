# Plan: Directed Money Flow Refactoring (Sender- & Receiver-IBAN)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Bearbeiter:** Antigravity Agent

---

## 1. Ziel & Übersicht

Bisher sind Transaktionen im System aus der isolierten Sicht eines einzelnen Kontoauszugs modelliert (`accountIban`, vorzeichenbehafteter `value`, Gegenkonto `iban`). Bei Umbuchungen zwischen zwei eigenen Konten (z. B. Girokonto -> Tagesgeld) führt dies beim Import beider Kontoauszüge zu zwei separaten Buchungen (z. B. Girokonto `-960 €` und Tagesgeld `+960 €`). Dies verdoppelt den Cashflow und erfordert komplexe Heuristiken zur Duplikats- und Gegenbuchungserkennung.

**Lösung: Gerichtetes Geldfluss-Modell (Directed Money Flow):**
Jede Transaktion repräsentiert einen gerichteten Fluss von einem Absender zu einem Empfänger:

- `sender` / `senderIban`: Wer zahlt das Geld?
- `receiver` / `receiverIban`: Wer erhält das Geld?
- `amount`: Vorzeichenloser Betrag (`amount >= 0`).
- Symmetrischer Fingerabdruck & deterministische ID: Sowohl der Auszug von Konto A als auch von Konto B erzeugen für dieselbe Umbuchung exakt denselben Fingerabdruck.
- Automatische Neutralisierung interner Umbuchungen im Gesamtcashflow (Netto 0,00 €).
- Saubere Ableitung der Kontoperspektive (`sender` = Ausgang / `-amount`, `receiver` = Eingang / `+amount`).

---

## 2. Anforderungen & User Stories

- [x] **R1: Gerichtetes Transaktionsmodell in `src/types/transaction.types.ts`:**
  - Neue Primärfelder: `senderIban`, `receiverIban`, `sender`, `receiver`, `amount` (`number >= 0`).
  - Abwärtskompatibilitäts-Brücke (`value`, `issuer`, `accountIban`, `iban` optional bzw. als abgeleitete Getter).
- [x] **R2: CSV-Parser (`src/domain/modules/csv/csvParser.ts`):**
  - Debit-Buchungen (`value < 0`): `senderIban = importAccountIban`, `receiverIban = partnerIban`, `amount = Math.abs(value)`.
  - Credit-Buchungen (`value > 0`): `senderIban = partnerIban`, `receiverIban = importAccountIban`, `amount = Math.abs(value)`.
  - Symmetrische Fingerabdruck- und ID-Generierung aus `(date, amount, senderIban, receiverIban, subject)`.
  - Erkennung von bestehenden Gegenstücken bei minimaler Valuta-Differenz (Toleranzfenster bei bankinternen Überträgen).
- [x] **R3: Datenbank-Migration & Deduplizierung (`src/repository/indexeddb/db.ts`):**
  - Automatische Migration bestehender Datensätze beim Start: Berechnung von `senderIban`, `receiverIban`, `sender`, `receiver`, `amount`.
  - Zusammenführung (Deduplizierung) bereits doppelt importierter Gegenbuchungen zu einer einzigen kanonischen Buchung.
  - Hinzufügen von Indizes für `senderIban` und `receiverIban`.
- [x] **R4: Domain-Services (`accountService.ts`, `cashflowCalculator.ts`, `balanceCalculator.ts`):**
  - Direkte Bestimmung von Ein-/Ausgang und effektivem Wert anhand von `senderIban` und `receiverIban`.
  - Kennzeichnung interner Umbuchungen (`isInternalTransfer`), wenn sowohl Absender als auch Empfänger bekannte Nutzerkonten sind.
  - Gesamtcashflow neutralisiert interne Umbuchungen automatisch.
- [x] **R5: UI-Anpassung (`Transactions.tsx`, `TransactionDetailModal.tsx`, `TransactionModal.tsx`):**
  - Klare Darstellung des Geldflusses (Absender -> Empfänger).
  - Kontospezifische Darstellung (Eingang grün / Ausgang rot) oder neutrale Transfer-Kennzeichnung in der Gesamtsicht.
  - Abwärtskompatibilität aller Filter- und Kategorisierungsfunktionen.

---

## 3. Technische Konzeption & Betroffene Komponenten

### Typen (`src/types/`)

- `src/types/transaction.types.ts`:
  - Erweiterung von `Transaction` um `senderIban?: string`, `receiverIban?: string`, `sender: string`, `receiver: string`, `amount: number`.
  - Hilfstypen für `TransactionDirection`: `'inbound' | 'outbound' | 'internal'`.

### Repository (`src/repository/`)

- `src/repository/indexeddb/db.ts`:
  - Migrationsschritt beim Laden / Schema-Update auf DB_VERSION 2.
  - Bereinigung doppelter historischer Gegenbuchungen.
  - Persistenz von gerichteten Transaktionen.

### Domain & State (`src/domain/`)

- `src/domain/modules/csv/csvParser.ts`:
  - Symmetrische Transformation von CSV-Zeilen in gerichtete Buchungen.
  - Symmetrische Hash- & Fingerprint-Funktionen (`computeDirectedFingerprint`, `generateDirectedTransactionId`).
- `src/domain/modules/accounts/accountService.ts`:
  - `getTransactionEffectiveValueForAccount(tx, account)`:
    - Wenn `account.iban === tx.senderIban` -> `-tx.amount`
    - Wenn `account.iban === tx.receiverIban` -> `+tx.amount`
  - `isInternalTransfer(tx, accounts)`:
    - `true`, wenn `tx.senderIban` und `tx.receiverIban` beiden bekannten Nutzerkonten entsprechen.
- `src/domain/modules/analytics/cashflowCalculator.ts`:
  - Automatische Berücksichtigung von internen Transfers ohne Doppelerfassung.
- `src/domain/modules/analytics/balanceCalculator.ts`:
  - Saldenberechnung basierend auf gerichteten Flüssen (`sender` = Minderung, `receiver` = Erhöhung).

### UI & Pages (`src/ui/`)

- `src/ui/pages/Transactions.tsx`:
  - Anzeige von Absender -> Empfänger in der Tabelle.
  - Korrekte Anzeige von Vorzeichen und Betrag je nach aktiver Kontofilterung.
- `src/ui/components/modals/TransactionDetailModal.tsx`:
  - Anzeige beider Beteiligter (`Absender` und `Empfänger`) und Umbuchungs-Badge.
- `src/ui/components/modals/TransactionModal.tsx`:
  - Eingabe bzw. Bearbeitung von Absender- und Empfänger-IBAN.

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen erweitern & Hilfsfunktionen bereitstellen**
   - Datei: `src/types/transaction.types.ts`
   - Definition von `amount`, `sender`, `senderIban`, `receiver`, `receiverIban`.
   - Bereitstellung von Brücken-Gettern / Hilfsfunktionen zur Erhaltung der Kompatibilität.

2. [x] **Schritt 2: CSV-Parser auf gerichteten Geldfluss umstellen**
   - Datei: `src/domain/modules/csv/csvParser.ts` & `src/domain/modules/csv/csvParser.test.ts`
   - Symmetrischer Fingerabdruck & deterministische ID.
   - Zuordnung von Soll/Haben auf Absender/Empfänger.

3. [x] **Schritt 3: Domain-Logik in Account- und Analytics-Services anpassen**
   - Datei: `src/domain/modules/accounts/accountService.ts`
   - Datei: `src/domain/modules/analytics/cashflowCalculator.ts`
   - Datei: `src/domain/modules/analytics/balanceCalculator.ts`
   - Ablösung fehleranfälliger Heuristiken durch exakte gerichtete Prüfungen.

4. [x] **Schritt 4: DB-Migration & Deduplizierung im IndexedDB-Layer**
   - Datei: `src/repository/indexeddb/db.ts` & `src/repository/indexeddb/db.test.ts`
   - Migrationsroutine für Altdaten und automatische Verschmelzung bestehender Duplikate.

5. [x] **Schritt 5: UI-Komponenten aktualisieren**
   - Datei: `src/ui/pages/Transactions.tsx`
   - Datei: `src/ui/components/modals/TransactionDetailModal.tsx`
   - Datei: `src/ui/components/modals/TransactionModal.tsx`

6. [x] **Schritt 6: Test-Suite aktualisieren & verifizieren**
   - Tests in `accountService.test.ts`, `cashflowCalculator.test.ts`, `csvParser.test.ts`, `balanceCalculator.test.ts` anpassen und ergänzen.

---

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`: 34 Testdateien, 241 Tests bestanden)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Code-Formatierung geprüft (`pnpm format:check`)
- [x] Manuelle Prüfung von Importen beider Konten (Giro + Tagesgeld) und Überprüfung der Neutralität im Cashflow
