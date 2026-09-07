# Plan: Bulk-Kategoriebearbeitung und Mehrfachauswahl in der Transaktionsliste

- **Status:** Abgeschlossen
- **Datum:** 2026-09-07
- **Beteiligte:** Coding-Agent, Benutzer

---

## 🎯 Ziel & Motivation

Ermöglichung einer Mehrfachauswahl (Bulk Selection) in der Transaktionsübersicht (`Transactions.tsx`) mit einer Aktionsleiste am unteren Bildschirmrand zur Zuweisung einer Kategorie für alle selektierten Transaktionen in einem einzigen Schritt.

---

## 📋 Geplante Arbeitsschritte

- [x] **1. Domain & State: Batch-Methode hinzufügen**
  - [x] `assignTransactionCategoryBatch` in `useTransactions.ts`
  - [x] Exponieren via `FinanceProvider.tsx` und `useFinance()`
- [x] **2. UI: Mehrfachauswahl & Floating Action Bar in `Transactions.tsx`**
  - [x] Checkbox-Spalte im Table-Header (inkl. Indeterminate-State) und Table-Body
  - [x] Hervorhebung selektierter Zeilen
  - [x] Floating Bulk Action Bar am unteren Bildschirmrand mit Zähler, Deselect-Button und Kategorie-Picker
  - [x] Automatische Deselektion nach erfolgreicher Zuweisung
- [x] **3. Tests & Verifikation**
  - [x] Unit-Tests für `assignTransactionCategoryBatch`
  - [x] Tests für Checkbox-Selektion und Bulk-Zuweisung in `Transactions.test.tsx`
  - [x] `pnpm test`, `pnpm build`, `pnpm format:check`
