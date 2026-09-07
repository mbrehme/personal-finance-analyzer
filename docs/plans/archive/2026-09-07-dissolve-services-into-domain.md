# Plan: Auflösung von `src/services` in `domain` und `repository`

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Abgeschlossen am:** 2026-09-07
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Vollständige Auflösung des Übergangsverzeichnisses `src/services/` gemäß Clean Architecture (ADR-0003):

- Persistenzadapter (`db.ts`, `db.test.ts`) wandern nach `src/repository/indexeddb/`.
- Geschäftslogik und State (`FinanceProvider`, `useFinance`, `csvParser`, `regexMatcher`, `balanceCalculator`, `cashflowCalculator`) werden konsistent über `@/domain` konsumiert.
- Unbenutzte Template-Dateien (`api.ts`, `Dashboard.tsx`) werden entfernt.
- `src/services/` wird nach Migration aller Imports gelöscht.

---

## 2. Anforderungen & User Stories

- [x] **A1: Persistenz nach `repository/` umziehen**
  - `src/services/storage/db.ts` & `db.test.ts` nach `src/repository/indexeddb/` verschieben.
  - `IndexedDbRepositories` und `FinanceProvider` auf neuen Pfad umstellen.
- [x] **A2: Domänen-Exporte vervollständigen (`src/domain/`)**
  - `useFinance` in `src/domain/modules/finance/useFinance.ts` & `FinanceProvider.tsx` bereitstellen.
- [x] **A3: Alle UI-Komponenten auf `@/domain` umstellen**
  - Imports in `App.tsx`, Pages und Modals von `@/services/...` auf `@/domain` umstellen.
- [x] **A4: Alle Tests auf `@/domain` anpassen**
  - Spies und Imports in Testdateien aktualisieren.
- [x] **A5: Cleanup & Löschen von `src/services/`**
  - `src/ui/pages/Dashboard.tsx` entfernen.
  - `src/services/` vollständig entfernen.
- [x] **A6: Tests & Verifikation**
  - `pnpm test`, `pnpm build`, `pnpm format:check` fehlerfrei durchführen.
