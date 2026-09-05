# Plan: Strict Layered Architecture (Clean / Hexagonal) Refactoring

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-05
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Refactoring des Quellcode-Verzeichnisses (`src/`) in eine strikte Schichtenarchitektur (Clean / Hexagonal Architecture) mit strikter Einwärts-Abhängigkeitsregel:
`src/types/` ◄── `src/domain/` (und `src/repository/contracts/`) ◄── `src/ui/` (und `src/repository/local/` bzw. `src/repository/indexeddb/`).
Alle Speicherzugriffe werden über abstrakte Repository-Interfaces entkoppelt, sodass die Persistenz (LocalStorage, IndexedDB oder spätere APIs) nahtlos austauschbar ist.

## 2. Anforderungen & User Stories

- [x] **R1: types/ (Pure Data Models & Contracts)**: Keine Abhängigkeiten auf andere Schichten.
- [x] **R2: repository/contracts/ (Ports)**: Abstrakte Repository-Interfaces mit async `Promise<T>`-Methoden.
- [x] **R3: repository/local/ (LocalStorage Adapter)**: Implementierung mit versionierten Keys, QuotaExceededError-Handling und sicherer JSON-Serialisierung.
- [x] **R4: repository/indexeddb/ (IndexedDB Adapter)**: Beibehaltung der performanten IndexedDB-Implementierung für große Transaktionsvolumina hinter denselben Verträgen.
- [x] **R5: domain/ (Core Business Logic & State)**: Reines Domain-Modell (`modules/accounts`, `modules/categories`, `modules/transactions`, `modules/analytics`), das nur von `types/` und `repository/contracts/` abhängt.
- [x] **R6: ui/ (Presentation Layer)**: `pages/`, `views/`, `components/`, `hooks/`, `styles/`. Greift ausschließlich auf `domain/` zu, niemals direkt auf `repository/` oder Storage.
- [x] **R7: Rückwärtskompatibilität & Tests**: Alle 68 Testsuiten und 343 Tests laufen ohne Fehler durch (`pnpm test` und `pnpm build`).

## 3. Technische Konzeption & Betroffene Komponenten

- **`src/types/`**:
  - `account.types.ts`, `category.types.ts`, `transaction.types.ts`, `operations.types.ts`, `common.types.ts`, `index.ts`.
- **`src/repository/`**:
  - `contracts/`: `accountRepository.ts`, `categoryRepository.ts`, `transactionRepository.ts`, `metaRepository.ts`.
  - `local/`: `storageKeys.ts`, `storageUtils.ts`, `localAccountRepository.ts`, `localCategoryRepository.ts`, `localTransactionRepository.ts`, `localMetaRepository.ts`.
  - `indexeddb/`: `indexedDbRepositories.ts`.
  - `index.ts`: Repository Factory & Provider.
- **`src/domain/`**:
  - `modules/accounts/`: `accountService.ts`, `useAccounts.ts`.
  - `modules/categories/`: `categoryService.ts`, `categoryMatcher.ts`, `useCategories.ts`.
  - `modules/transactions/`: `transactionService.ts`, `transactionFilter.ts`, `useTransactions.ts`.
  - `modules/analytics/`: `cashflowCalculator.ts`, `balanceCalculator.ts`.
  - `modules/finance/`: `FinanceProvider.tsx`, `useFinance.ts`.
- **`src/ui/`**:
  - `pages/`, `views/`, `components/`, `hooks/`, `styles/`, `App.tsx`.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen-Schicht aufbauen (`src/types/`)**
   - Erstellen von `[entity].types.ts` und `index.ts`.
2. [x] **Schritt 2: Repository-Verträge & Adapter (`src/repository/`)**
   - `contracts/` erstellen.
   - `local/` LocalStorage-Adapter mit safe error handling implementieren.
   - `indexeddb/` Adapter hinter den Verträgen bereitstellen.
   - `index.ts` Factory aufsetzen.
3. [x] **Schritt 3: Domain-Schicht (`src/domain/`)**
   - Services und Store-Hooks unter `src/domain/modules/` organisieren.
   - `FinanceProvider.tsx` Facade mit Dependency Injection der Repositories verdrahten.
4. [x] **Schritt 4: UI-Schicht neu strukturieren (`src/ui/`)**
   - Komponenten nach `ui/components/`, `ui/views/`, `ui/pages/`, `ui/styles/` verschieben und Imports auf `domain/` ausrichten.
5. [x] **Schritt 5: Tests anpassen & Verifikation**
   - Co-located Tests prüfen und Imports aktualisieren.
   - `pnpm test`, `pnpm build` und `pnpm format:check` ausführen.

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test` - 68 Suiten, 343 Tests bestanden)
- [x] TypeScript Check & Build erfolgreich (`pnpm build` - 0 Fehler)
- [x] Code-Formatting sauber (`pnpm format:check` - alle Dateien formatiert)
- [x] Keine zirkulären Abhängigkeiten und Einhaltung der Einwärts-Abhängigkeitsregel
