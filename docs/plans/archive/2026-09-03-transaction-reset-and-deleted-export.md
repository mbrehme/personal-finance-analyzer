# Plan: Transaktionen-Reset auf Originaldaten & Export gelöschter Transaktionen

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Ermöglichung des vollständigen Zurücksetzens modifizierter oder gesplitteter Transaktionen auf ihren ursprünglichen Bank-Rohzustand über einen dedizierten Reset-Knopf. Zudem sollen gelöschte Transaktionen erfasst, in der Konfiguration exportiert und beim erneuten CSV-Import ignoriert werden können.

## 2. Anforderungen & User Stories

- [x] **Reset-Knopf für Transaktionen:**
  - Zurücksetzen aller geänderten Felder (`value`, `subject`, `receiver`, `valueDate`, `accountId`, etc.) auf die Originaldaten der Bank.
  - Reset-Aktion direkt in der Buchungszeile der Tabelle (`Transactions.tsx`).
  - "Alle Felder zurücksetzen"-Button im Edit-Modal (`TransactionModal.tsx`).
  - Bei Reset einer gesplitteten Originalbuchung: Wiederherstellung des Originalbetrags und saubere Bereinigung verknüpfter Split-Kinder.
- [x] **Gelöschte Transaktionen erfassen & exportieren:**
  - `deleted_transactions` Store im Storage-Layer (`db.ts`).
  - Export von `deletedTransactions` in `FinanceConfigExport` (ohne virtuelles `type`-Feld).
  - Re-Import von `deletedTransactions` aus dem Konfigurations-JSON.
  - Beim CSV-Import: Erkennung und Überspringen bereits gelöschter Transaktionen (`id` und `rawFingerprint`).
  - In der UI: Filteroption `Gelöscht` unter Quelle inklusive Wiederherstellen-Aktion.

## 3. Technische Konzeption & Betroffene Komponenten

- **`src/types/finance.ts`:**
  - `FinanceConfigExport.deletedTransactions?: Transaction[]`
  - Helper `resetTransactionToOriginal(tx: Transaction): Transaction`
- **`src/services/storage/db.ts`:**
  - Store `deleted_transactions` in IndexedDB & MemoryStore.
  - CRUD- und Export/Import-Methoden für gelöschte Transaktionen.
- **`src/services/storage/FinanceContext.tsx`:**
  - Methoden `resetTransaction(id)`, `deleteTransaction(id)`, `restoreTransaction(id)`.
  - Duplikatprüfung in `importTransactions` gegen gelöschte Buchungen.
- **`src/pages/Transactions.tsx`:**
  - Reset-Icon in Tabellenzeile.
  - Filter `Gelöscht` in der Quellen-Auswahl.
- **`src/components/modals/TransactionModal.tsx`:**
  - Sammel-Reset-Button für alle Formularfelder.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Domain-Typen & Helper (`src/types/finance.ts`)**
2. [x] **Schritt 2: Storage-Layer & Export/Import (`src/services/storage/db.ts`)**
3. [x] **Schritt 3: State-Layer (`src/services/storage/FinanceContext.tsx`)**
4. [x] **Schritt 4: UI & Modale (`Transactions.tsx`, `TransactionModal.tsx`)**
5. [x] **Schritt 5: Tests schreiben & verifizieren (`pnpm test`, `pnpm build`)**

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`) – 122/122 grün
- [x] TypeScript Check & Vite Build (`pnpm build`) – fehlerfrei
