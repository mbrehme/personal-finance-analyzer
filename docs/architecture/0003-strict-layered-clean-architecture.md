# ADR-0003: Strikte Schichtenarchitektur (Clean / Hexagonal Architecture)

- **Status:** Akzeptiert
- **Datum:** 2026-09-05
- **Autor(en):** Antigravity & Entwickler-Team
- **Entscheider:** Projektleitung & Entwickler-Team

---

## 1. Kontext & Problemstellung

Mit wachsendem Funktionsumfang des Personal Finance Analyzers (Kategoriehierarchien, Re-Matching, CSV-Import, Split-Buchungen, Cashflow- und Saldenberechnungen) stieg die Kopplung zwischen UI-Komponenten, Zustandsverwaltung und Speicherpersistenz.
Um eine klare Trennung der Verantwortlichkeiten ("Separation of Concerns"), einfache Wartbarkeit und vollständige Austauschbarkeit des Persistenz-Backends (LocalStorage vs. IndexedDB vs. REST-API) zu gewährleisten, sollte der Quellcode (`src/`) in eine strikte Schichtenarchitektur mit einwärtiger Abhängigkeitsregel überführt werden.

## 2. Betrachtete Optionen / Alternativen

- **Option A: Beibehaltung der flachen Feature-/Ordnerstruktur (`components/`, `pages/`, `services/`)**
  - _Vorteile:_ Geringerer anfänglicher Refactoring-Aufwand.
  - _Nachteile:_ Hohe Kopplung, direkte Abhängigkeit der UI von konkreten Persistenzmechanismen, erschwertes Unit-Testing reiner Geschäftslogik.
- **Option B: Strikte Schichtenarchitektur (Clean / Hexagonal) (Gewählt)**
  - _Vorteile:_
    - Strikte Einwärts-Abhängigkeitsregel: `types/` ◄── `domain/` & `repository/contracts/` ◄── `ui/` & Speicheradapter.
    - Zero Dependencies in der Typenschicht (`types/`).
    - Reine Geschäftslogik in `domain/` ist frei von React- oder DOM-Abhängigkeiten und unabhängig von Storage-Treibern testbar.
    - Vollständig entkoppelte Persistenz (`repository/`) hinter asynchronen Schnittstellen (`contracts/`).
    - Transparente Unterstützung von LocalStorage (mit QuotaExceededError-Handling) und IndexedDB (für zehntausende Buchungen).
  - _Nachteile:_ Initiale Restrukturierung und Pfadmigrationen erforderlich.

## 3. Getroffene Entscheidung

Es wurde **Option B** gewählt. Das Verzeichnis `src/` ist nun in vier Hauptschichten gegliedert:

1. **Schicht 1: `src/types/` (Pure Data Models & Contracts)**
   - Reines Typensystem ohne externe oder interne Abhängigkeiten.
   - Entitäten: `account.types.ts`, `category.types.ts`, `transaction.types.ts`, `operations.types.ts`, `common.types.ts`.
   - Re-Export über zentrales Barrel `src/types/index.ts` sowie abwärtskompatibles `finance.ts`.

2. **Schicht 2: `src/repository/` (Persistence Ports & Adapters)**
   - **Contracts (Ports):** Abstrakte Interfaces (`AccountRepository`, `CategoryRepository`, `TransactionRepository`, `MetaRepository`) mit `Promise<T>`-Methoden.
   - **Adapters:**
     - `local/`: LocalStorage-Adapter mit versionierten Schlüsseln, QuotaExceededError-Handling und defensiver JSON-Serialisierung.
     - `indexeddb/`: IndexedDB-Adapter für hohe Performance bei großen Datenmengen.
   - **Factory & Singleton:** `createRepositories(backend)` und Standard-Instanzen in `src/repository/index.ts`.

3. **Schicht 3: `src/domain/` (Core Business Logic & State)**
   - Reine Fachlogik, Validierung und State-Orchestrierung:
     - `modules/accounts/`: `accountService.ts`, `useAccounts.ts`
     - `modules/categories/`: `categoryService.ts`, `useCategories.ts` (Hierarchien, Leaf-Erkennung, Regex-Sanitizing)
     - `modules/transactions/`: `transactionService.ts`, `useTransactions.ts`
     - `modules/matcher/`: `regexMatcher.ts` (Automatische Zuordnung & Overrides)
     - `modules/analytics/`: `balanceCalculator.ts`, `cashflowCalculator.ts`
     - `modules/csv/`: `csvParser.ts`
     - `modules/finance/`: `FinanceProvider.tsx`, `useFinance.ts`

4. **Schicht 4: `src/ui/` (Presentation Layer)**
   - Konsumiert ausschließlich `domain/` und `types/`, niemals direkt Storage oder Repositories.
   - Gliederung:
     - `components/`: UI-Komponenten (Modals, Charts, Controls) mit Co-Located Tests.
     - `pages/`: Routen- und Seitenansichten (`Home`, `Dashboard`, `Transactions`, `Cashflow`, `Balances`, `configuration/`, `analytics/`).
     - `styles/`: CSS- und Theme-Definitionen (`index.css`).
     - `App.tsx`: UI-Root.

## 4. Konsequenzen & Auswirkungen

- **Positiv:**
  - Hohe Testbarkeit: Domain-Logik kann ohne Mocks von DOM oder Storage isoliert getestet werden.
  - Austauschbare Persistenz: Beliebige Storage-Engines (LocalStorage, IndexedDB, SQLite/WASM, REST/GraphQL) können ohne Codeänderungen in Domain oder UI eingebunden werden.
  - Einheitliche Projektstruktur erleichtert Einarbeitung und Wartung.
- **Negativ / Risiken:**
  - Zusätzliche Abstraktionsschicht erfordert Disziplin bei neuen Modulen (striktes Einhalten der Schichten-Regeln).
- **Folgeaufgaben:**
  - Dokumentationen (`README.md`, `docs/README.md`, `AGENTS.md`) kontinuierlich an der neuen Struktur ausrichten.
