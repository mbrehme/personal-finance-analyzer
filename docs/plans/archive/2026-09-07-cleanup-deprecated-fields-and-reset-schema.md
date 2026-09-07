# Plan: Bereinigung veralteter Attribute & Schema-Reset (Clean Slate)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Bearbeiter:** Agent

---

## 1. Ziel & Übersicht

Die Anwendung befindet sich in der Vorentwicklungsphase und ist noch nicht produktiv deployed. Diese Gelegenheit nutzen wir für einen vollständigen Schnitt ("Clean Slate"):

1. Vollständiges Entfernen aller `@deprecated` Felder, Alias-Methoden, Legacy-Routen und Legacy-Komponenten ("Bucket" / "Buckets").
2. Konsistente Modellierung der `Transaction`- und `Account`-Entitäten:
   - `date` und `originalDate` als einheitliche Datumsfelder (vollständige Entfernung von `valueDate`, `bookingDate`, `originalValueDate`, `originalBookingDate`).
   - `dayIndex` als einziger Tagesindex (vollständige Entfernung von `importIndex`).
   - `origin` strikt auf `'imported' | 'split' | 'override'` (vollständige Entfernung von `'manual'`).
   - `accountIban` und `originalAccountIban` als IBAN-Referenz (vollständige Entfernung von `accountId` / `originalAccountId` auf der Transaktion).
   - Entfernen von `bucketIds` auf `Account` (nur noch `categoryIds`).
3. Zurücksetzen des IndexedDB-Schemas auf Version 1 (`DB_VERSION = 1`) mit sauberen Stores (`accounts`, `categories`, `transactions`, `deleted_transactions`) ohne Altlasten-Migrationen.

## 2. Anforderungen & User Stories

- [x] Sämtliche "Bucket"-Terminologie und Aliasse im Code entfernen (Typen, Services, Kontext, Storage).
- [x] Obsolete Alias-Komponenten löschen (`BucketModal.tsx`, `BucketsConfig.tsx`).
- [x] `Transaction`-Typ bereinigen: `date`, `originalDate`, `dayIndex`, `origin: 'imported' | 'split' | 'override'`, `accountIban`, `originalAccountIban`.
- [x] `Account`-Typ bereinigen: nur `categoryIds`.
- [x] IndexedDB auf Version 1 setzen mit schlanker Store- und Index-Struktur.
- [x] Domain-Services, Rechner und Kontexte von Fallback-Logiken befreien.
- [x] Alle Tests aktualisieren und verifizieren (`pnpm test`, `pnpm build`, `pnpm format:check`).

## 3. Technische Konzeption & Betroffene Komponenten

- **Typen (`src/types/`):**
  - `src/types/category.types.ts`: `Bucket`, `BucketAssignmentSource` entfernen.
  - `src/types/account.types.ts`: `bucketIds` aus `Account` entfernen.
  - `src/types/transaction.types.ts`: `accountId`, `valueDate`, `bookingDate`, `bucketId`, `importIndex`, `originalAccountId`, `originalValueDate`, `originalBookingDate` entfernen. `TransactionOrigin` ohne `'manual'`. `TransactionFilterOptions` ohne `bucketId`.
  - `src/types/operations.types.ts`: `resetTransactionOverrides` und `FinanceConfigExport.buckets` entfernen.
- **Repository (`src/repository/`):**
  - `src/repository/indexeddb/db.ts`: `DB_VERSION = 1`, Stores `accounts`, `categories`, `transactions` (Indexe: `date`, `categoryId`, `accountIban`), `deleted_transactions` (Index: `date`). Entfernen alter v1..v6 Migrationspfade.
  - `src/repository/local/storage.ts`: Bereinigen von In-Memory Mock Storage.
- **Domain & State (`src/domain/`):**
  - `src/domain/modules/finance/FinanceProvider.tsx` & `types.ts`: Bucket-Aliasse (`buckets`, `addBucket`, etc.) entfernen.
  - `src/domain/modules/transactions/transactionService.ts` & `useTransactions.ts`: Sortierung rein nach `dayIndex`, keine `valueDate`-Fallbacks.
  - `src/domain/modules/analytics/cashflowCalculator.ts` & `balanceCalculator.ts`: Transaktionen nur noch über `date` abfragen.
  - `src/domain/modules/csv/csvParser.ts`: Nur `date`, `originalDate`, `dayIndex`, `accountIban`, `originalAccountIban` ausgeben.
- **UI & Pages (`src/ui/`):**
  - Entfernen: `src/ui/components/modals/BucketModal.tsx`, `BucketModal.test.tsx`, `src/ui/pages/configuration/BucketsConfig.tsx`, `BucketsConfig.test.tsx`.
  - Anpassen: `App.tsx`, `CategoryModal.tsx`, `AccountModal.tsx`, `TransactionDetailModal.tsx`, `Transactions.tsx`.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typdefinitionen bereinigen (`src/types/`)**
   - `category.types.ts`, `account.types.ts`, `transaction.types.ts`, `operations.types.ts`
2. [x] **Schritt 2: Repository & IndexedDB bereinigen (`src/repository/`)**
   - `src/repository/indexeddb/db.ts` (Version 1, saubere Stores/Indexe)
   - `src/repository/local/storage.ts`
3. [x] **Schritt 3: Domain-Schicht anpassen (`src/domain/`)**
   - CSV Parser, Transaction Service, Filter, Analytics-Rechner, FinanceProvider
4. [x] **Schritt 4: UI-Komponenten anpassen und Alt-Komponenten löschen (`src/ui/`)**
   - Löschen von `BucketModal` & `BucketsConfig`
   - Bereinigen von `CategoryModal`, `AccountModal`, `TransactionDetailModal`, `Transactions`, `App`
5. [x] **Schritt 5: Tests anpassen & Verifikation**
   - Bestehende Tests auf die sauberen Typen und Properties anpassen
   - `pnpm test`, `pnpm build`, `pnpm format:check`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Code-Formatierung geprüft (`pnpm format:check`)
