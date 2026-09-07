# Plan: Refactoring Transaktionen – Virtuelle Herkunft (Origin: imported | split | override) & Tagesbasierter Import-Index (dayIndex)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Abgeschlossen am:** 2026-09-07
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

1. **Virtuelle Herkunft (`origin` bzw. `getTransactionOrigin`):**
   - Transaktionen werden nicht mehr manuell neu angelegt.
   - Herkunft wird über `getTransactionOrigin(tx)` ermittelt:
     - `'split'`: Aus einem Split hervorgegangene Teilbuchung (`splitFromId`).
     - `'override'`: Manuell editierte bzw. überschriebene Buchung (`isTransactionOverridden(tx)` oder legacy `'manual'`).
     - `'imported'`: Unveränderte Original-Bankbuchung.
2. **Tagesbasierter Import-Index (`dayIndex`):**
   - Beim CSV-Import wird für jeden Tag separat ein zählendes `dayIndex` (0, 1, 2, ...) vergeben.
   - Am gleichen Tag sortiert `sortTransactionsDesc` primär nach `dayIndex` (Fallback `importIndex`).

---

## 2. Anforderungen & User Stories

- [x] **A1: Typdefinitionen anpassen (`src/types/transaction.types.ts`)**
  - `TransactionOrigin = 'imported' | 'split' | 'override'` (inkl. Alias `'manual'`).
  - `dayIndex?: number` in `Transaction`.
  - Filteroptionen für Herkunft in `TransactionFilterOptions` aktualisieren.
- [x] **A2: Domänen-Logik (`src/domain/modules/transactions/transactionService.ts`)**
  - `getTransactionOrigin(tx: Transaction): TransactionOrigin` implementieren.
  - `sortTransactionsDesc` auf `dayIndex` vor `importIndex` ausrichten.
- [x] **A3: CSV-Import (`src/domain/modules/csv/csvParser.ts`)**
  - `dayIndex` pro Tag & Konto inkrementieren.
  - Tests in `csvParser.test.ts` erweitern.
- [x] **A4: State & Provider (`FinanceProvider.tsx`, `FinanceContext.tsx`)**
  - Splits erzeugen Teilbuchungen mit `splitFromId` ohne statisches `origin: 'manual'`.
  - Tests anpassen.
- [x] **A5: UI (`Transactions.tsx`, `TransactionDetailModal.tsx`)**
  - Dropdown und Badges von `'manual'` auf `'override'` und `'split'` anpassen.
  - `dayIndex` in Details anzeigen.
- [x] **A6: Tests & Verifikation**
  - Alle Tests laufen durch (`pnpm test`), TypeScript-Build (`pnpm build`) und Format-Check (`pnpm format:check`).
