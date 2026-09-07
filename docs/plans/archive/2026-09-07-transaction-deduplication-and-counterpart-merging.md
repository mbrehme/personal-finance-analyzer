# Plan: Robuste Duplikats- und Gegenbuchungszusammenführung (Import & Startup)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Bearbeiter:** Antigravity Agent

---

## 1. Ziel & Übersicht

Beim Import von Kontoauszügen eines weiteren Kontos (z. B. Tagesgeld/Rücklagen nach dem Haupt-Girokonto) oder beim Re-Import darf eine bestehende Transaktion weder durch eine doppelte Zeile dupliziert noch dürfen bestehende Kategorien, Splits oder manuelle Overrides überschrieben werden.

### Problemursache:

1. Bisher prüfte `importTransactions` ausschließlich auf exakte Übereinstimmung von `id` und `rawFingerprint`. Wenn ein früherer Import eine abweichende Gegen-IBAN, einen leicht abweichenden Partner-String oder ein legacy-Format hatte, entstand ein neuer Datensatz (zweite Zeile in der Tabelle).
2. Der Startup-Deduplizierer in `FinanceProvider.tsx` (`loadData`) setzte voraus, dass beide Transaktionen exakt dieselben gerichteten IBANs oder gegenteilige Vorzeichen mit voller IBAN-Übereinstimmung besaßen. Wenn ein Auszug keine Gegen-IBAN auswies, schlug die Erkennung fehl.

### Lösung:

- Einführung eines dedizierten Domänen-Deduplikationsmoduls (`transactionDeduplication.ts`) mit semantischem Matching (Betragstoleranz < 0,01 €, Valuta-Toleranz bis 4 Tage, Kreuz-IBAN-/Kontovergleich, Textähnlichkeit für Verwendungszweck und Partner).
- Intelligente Zusammenführung (`mergeTransactions`):
  - **Kategorienschutz:** Bestehende Zuweisungen (`categoryId`) und `assignmentSource` bleiben immer geschützt und werden niemals überschrieben.
  - **Metadaten-Anreicherung:** Fehlende Absender-/Empfänger-IBANs aus dem neuen Import werden in die bestehende Buchung übernommen.
  - **Overrides & Splits:** Manuelle Änderungen und Splits bleiben unangetastet.
- Automatische Bereinigung historischer Duplikate beim Start in `FinanceProvider.tsx` (`loadData`).

---

## 2. Anforderungen & User Stories

- [x] **R1: Semantischer Transaktions-Matcher (`transactionDeduplication.ts`):**
  - Erkennt Gegenbuchungen (Umbuchung von Konto A nach Konto B aus Sicht beider Konten) und Duplikate (gleicher Transfer, z. B. bei unvollständiger IBAN im ersten Export).
  - Berücksichtigt Valuta-Laufzeiten bis 4 Tage und identische Absolutbeträge.
  - Verhindert Mehrfachzuordnungen bei Mehrfachbuchungen gleichen Betrags am selben Tag (`occurrenceIndex`).
- [x] **R2: Kategorienerhalt & Metadaten-Merge (`mergeTransactions`):**
  - Behält bestehende Kategorisierung der Transaktion strikt bei.
  - Übernimmt zusätzliche Metadaten (z. B. `receiverIban`, falls vorher leer) für saubere `[Konto A] -> [Konto B]` Darstellung.
- [x] **R3: Import-Deduplizierung (`importTransactions` in `FinanceProvider.tsx` und `useTransactions.ts`):**
  - Erzeugt keine Duplikate bei Imports der Gegenseite oder Re-Imports.
  - Aktualisiert bestehende Buchungen, wenn neue Metadaten vorliegen.
- [x] **R4: Startup-Bereinigung (`FinanceProvider.tsx` `loadData`):**
  - Führt bereits in IndexedDB vorhandene Doppelbuchungen (wie im Screenshot des Nutzers) beim Laden automatisch zu einer sauberen Umbuchung zusammen.
- [x] **R5: UI-Konsistenz (`Transactions.tsx`):**
  - Stellt sicher, dass gerichtete interne Umbuchungen immer konsistent `[Absender] -> [Empfänger]` anzeigen.

---

## 3. Technische Konzeption & Betroffene Komponenten

- **Domain & State (`src/domain/modules/transactions/`):**
  - [NEU] `transactionDeduplication.ts`: Reine Geschäftslogik für semantisches Matching und merging.
  - [NEU] `transactionDeduplication.test.ts`: Co-located Unit-Tests.
  - `useTransactions.ts`: Integration in `importTransactions`.
- **Provider (`src/domain/modules/finance/`):**
  - `FinanceProvider.tsx`: Bereinigung in `loadData` und Anpassung von `importTransactions`.
- **UI (`src/ui/pages/`):**
  - `Transactions.tsx`: Konsistente Absender-zu-Empfänger-Pfeildarstellung bei internen Transfers.

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1:** `transactionDeduplication.ts` mit TSDoc und umfassenden Algorithmen implementieren.
2. [x] **Schritt 2:** Co-located Unit-Tests in `transactionDeduplication.test.ts` schreiben.
3. [x] **Schritt 3:** `importTransactions` in `useTransactions.ts` und `FinanceProvider.tsx` anpassen.
4. [x] **Schritt 4:** `loadData` Startup-Deduplizierung in `FinanceProvider.tsx` anbinden.
5. [x] **Schritt 5:** Darstellung in `Transactions.tsx` optimieren.
6. [x] **Schritt 6:** Gesamte Testsuite (`pnpm test`), Typecheck & Build (`pnpm build`) und Formatierung (`pnpm format:check`) verifizieren.

---

## 5. Verifikationsplan

- [x] Unit-Tests für Deduplizierung, Kategorienschutz und Re-Import (`pnpm test`)
- [x] TypeScript Check & Build (`pnpm build`)
- [x] Formatierung (`pnpm format:check`)
