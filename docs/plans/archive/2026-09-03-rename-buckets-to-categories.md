# Plan: Umbenennung von „Buckets“ zu „Kategorien“ / „Categories“

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Das Projekt soll einheitlich die Terminologie **„Kategorie“ / „Kategorien“** (bzw. im englischen Code **`Category` / `Categories`**) anstelle von „Bucket“ verwenden. Dies betrifft die Benutzeroberfläche, Typdefinitionen, Datenbanktabellen, State-Management, Service-Methoden, Routing und Dokumentation.

## 2. Anforderungen & User Stories

- [x] Richtlinie in `AGENTS.md` aktualisieren (Kategorie statt Bucket vorgegeben).
- [x] Domänen-Typen in `src/types/finance.ts` (`Category`, `categoryId`, `categoryIds`, etc.) aktualisieren (`Bucket` als abwärtskompatibler Alias).
- [x] Seed-Daten in `src/data/seedConfiguration.json` auf `categories` und `categoryIds` anpassen.
- [x] IndexedDB (`db.ts`) Schemaversion auf 3 anheben mit automatischer Migration von `buckets` auf `categories`.
- [x] `FinanceContext.tsx` auf `categories` umstellen inkl. Abwärtskompatibilitäts-Aliase.
- [x] Rechenlogik (`cashflowCalculator.ts`, `regexMatcher.ts`, `csvParser.ts`) aktualisieren.
- [x] UI-Komponenten umbenennen & anpassen:
  - [x] `BucketModal.tsx` -> `CategoryModal.tsx`
  - [x] `BucketsConfig.tsx` -> `CategoriesConfig.tsx`
  - [x] Spalten, Labels und Dropdowns in `Cashflow.tsx`, `Transactions.tsx`, `AccountsConfig.tsx`, `ConfigurationLayout.tsx`.
- [x] Routing in `App.tsx` auf `/configuration/categories` anpassen (mit Weiterleitung von `/configuration/buckets`).
- [x] Alle Tests anpassen und verifizieren (`pnpm test`, `pnpm build`, `pnpm format:check`).

## 3. Technische Konzeption & Betroffene Komponenten

- **UI / Komponenten (`src/components/`, `src/pages/`):**
  - `src/components/modals/CategoryModal.tsx`: Neu angelegt mit deutschen Labels („Neue Kategorie anlegen“, „Übergeordnete Kategorie“, etc.). `BucketModal.tsx` re-exportiert `CategoryModal`.
  - `src/pages/configuration/CategoriesConfig.tsx`: Baumtabelle und Drag & Drop für Kategorien. `BucketsConfig.tsx` re-exportiert `CategoriesConfig`.
  - `src/pages/configuration/ConfigurationLayout.tsx`: Tab-Link `/configuration/categories` mit Label „Kategorien“.
  - `src/pages/Transactions.tsx` & `src/pages/Cashflow.tsx`: Tabellenüberschriften, Filter und Auswahllisten auf Kategorie umgestellt.
- **Services & State (`src/services/`):**
  - `src/services/storage/db.ts`: IndexedDB v3 mit `STORES.CATEGORIES` und Index `categoryId`. Normalisierung bei `saveTransaction` und `saveAccount`.
  - `src/services/storage/FinanceContext.tsx`: Stellt `categories`, `addCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`, `assignTransactionCategory` bereit.
  - `src/services/matcher/regexMatcher.ts`: `getLeafCategories()`, `matchTransaction()`, `reMatchAllTransactions()`.
  - `src/services/analytics/cashflowCalculator.ts`: `CategoryCashflowRow`, `calculateCashflowMatrix()`.
- **Routing (`src/App.tsx`):**
  - Hauptroute `/configuration/categories` aktiv, Weiterleitung von `/configuration/buckets` eingerichtet.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen & Seed-Konfiguration**
   - `src/types/finance.ts`: `Category`, `CategoryAssignmentSource`, optionale Kompatibilitätsfelder.
   - `src/data/seedConfiguration.json`: `categories` und `categoryIds`.
2. [x] **Schritt 2: Persistenz & Speicher-Layer**
   - `src/services/storage/db.ts` & `src/services/storage/db.test.ts`: IndexedDB v3 Migration, `getCategories()` etc.
3. [x] **Schritt 3: Matching-, CSV- & Analyse-Engines**
   - `src/services/matcher/regexMatcher.ts` & `src/services/matcher/regexMatcher.test.ts`
   - `src/services/csv/csvParser.ts`
   - `src/services/analytics/cashflowCalculator.ts` & `src/services/analytics/cashflowCalculator.test.ts`
   - `src/services/analytics/balanceCalculator.test.ts`
4. [x] **Schritt 4: Context & State Management**
   - `src/services/storage/FinanceContext.tsx` & `src/services/storage/FinanceContext.test.tsx`
5. [x] **Schritt 5: UI-Komponenten & Subpages**
   - `src/components/modals/CategoryModal.tsx` & `CategoryModal.test.tsx`
   - `src/components/modals/AccountModal.tsx` & `AccountModal.test.tsx`
   - `src/components/modals/CsvImportModal.tsx`
   - `src/pages/configuration/CategoriesConfig.tsx` & `CategoriesConfig.test.tsx`
   - `src/pages/configuration/ConfigurationLayout.tsx` & `ConfigurationLayout.test.tsx`
   - `src/pages/configuration/AccountsConfig.tsx`
   - `src/pages/Cashflow.tsx` & `Cashflow.test.tsx`
   - `src/pages/Transactions.tsx` & `Transactions.test.tsx`
   - `src/pages/Home.tsx`
   - `src/App.tsx`
6. [x] **Schritt 6: Verifikation & Formatting**
   - `pnpm format`
   - `pnpm test`
   - `pnpm build`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test` -> 30 Testdateien, 111 von 111 Tests bestanden)
- [x] TypeScript Check & Build erfolgreich (`pnpm build` -> tsc && vite build erfolgreich)
- [x] Prettier Formatierung geprüft (`pnpm format:check` -> All matched files use Prettier code style)
