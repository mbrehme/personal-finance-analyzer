# Plan: Dynamische Kontozuordnung bei Transaktionen (Entfernung von `accountId`)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Bislang besaß jede Finanzbuchung (`Transaction`) ein statisch persistiertes Feld `accountId: string`. Gemäß Benutzeranforderung soll `accountId` nicht mehr als persistiertes Feld in Transaktionen existieren. Stattdessen wird die Kontozuordnung **vollständig dynamisch / virtuell** zur Laufzeit aufgelöst:

1. **Reale Bankkonten:** Werden über einen **IBAN-Match** zugeordnet (`accountIban` bzw. Gegenkonto-IBAN `iban` stimmt mit `account.iban` überein).
2. **Virtuelle Unterkonten:** Werden über einen **Category-Match** zugeordnet (`categoryId` gehört zu `virtualAccount.categoryIds`).

---

## 2. Anforderungen & User Stories

- [x] `accountId` wird aus dem Interface `Transaction` entfernt (bzw. als deprecated markiert für sanfte Migration bestehender Daten).
- [x] Echtes Buchungskonto wird über `accountIban?: string` auf Transaktionsebene referenziert (beim CSV-Import oder manueller Erfassung befüllt).
- [x] Gegenkonto bei Umbuchungen wird dynamisch erkannt, wenn `iban` mit einem anderen echten Bankkonto übereinstimmt.
- [x] Virtuelle Unterkonten werden rein dynamisch anhand von `categoryId` gematcht.
- [x] Alle Berechnungen (`balanceCalculator`, `cashflowCalculator`) und Filterungen (`Transactions.tsx`, `Balances.tsx`) nutzen die dynamische Kontozuordnung.
- [x] Beispieldaten (`seedTransactions.ts`) und CSV-Parser werden auf `accountIban` umgestellt.

---

## 3. Technische Konzeption & Betroffene Komponenten

- **Typen & Matching (`src/types/finance.ts`):**
  - `Transaction`: `accountIban?: string` hinzufügen, `accountId` deprecaten/entfernen.
  - `getTransactionAccountInfo(tx, accounts)`: Löst Primärkonto über `accountIban` (oder `iban`), Gegenkonto über `iban` und virtuelle Unterkonten über `categoryId` auf.
  - `isTransactionMatchingAccount(tx, accountId, accounts)`: Dynamische Prüfung für Filter.
- **CSV-Import & Parser (`src/services/csv/csvParser.ts`, `CsvImportModal.tsx`):**
  - `convertRowsToTransactions` nimmt die `accountIban` entgegen.
  - Fingerprint- und ID-Generierung basieren auf `accountIban`.
- **UI & Modals (`src/components/modals/TransactionModal.tsx`, `Transactions.tsx`):**
  - Manuelle Buchungen speichern `accountIban` des gewählten Kontos.
  - Kontospalte und Filter laufen über die dynamischen Resolver.
- **Analytics (`src/services/analytics/`):**
  - `balanceCalculator.ts` und `cashflowCalculator.ts` stellen die Kontenzuordnung auf IBAN- und Category-Match um.
- **Persistenz & Migration (`src/services/storage/FinanceContext.tsx`):**
  - Migration alter Transaktionen mit `accountId` in IndexedDB.

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen & dynamische Auflösungslogik anpassen**
   - Datei: `src/types/finance.ts`
   - Co-Located Test: `src/types/finance.test.ts`
2. [x] **Schritt 2: CSV-Parser und Beispieldaten anpassen**
   - Dateien: `src/services/csv/csvParser.ts`, `src/data/seedTransactions.ts`
   - Co-Located Test: `src/services/csv/csvParser.test.ts`
3. [x] **Schritt 3: Analytics und Berechnungen umstellen**
   - Dateien: `src/services/analytics/balanceCalculator.ts`, `src/services/analytics/cashflowCalculator.ts`
   - Co-Located Tests: `balanceCalculator.test.ts`, `cashflowCalculator.test.ts`
4. [x] **Schritt 4: UI, Modals & FinanceContext anpassen**
   - Dateien: `src/components/modals/TransactionModal.tsx`, `src/components/modals/CsvImportModal.tsx`, `src/pages/Transactions.tsx`, `src/services/storage/FinanceContext.tsx`
   - Co-Located Tests: `TransactionModal.test.tsx`, `CsvImportModal.test.tsx`, `Transactions.test.tsx`
5. [x] **Schritt 5: Gesamtverifikation & Build**
   - Tests und Build ausführen.

---

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Formatierung intakt (`pnpm format:check`)
- [x] Manuelle Prüfung im Browser (`pnpm dev`)
