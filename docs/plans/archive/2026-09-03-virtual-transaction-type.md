# Plan: Virtueller Transaktionstyp (Inbound / Outbound)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Bislang existierte im Datenmodell `Transaction` ein statisch gespeichertes Attribut `type: 'inbound' | 'outbound'`. Der Typ einer Transaktion (Einnahme vs. Ausgabe) soll nun **vollständig virtuell** abgebildet werden.
Die Unterscheidung, ob es sich um eine Einnahme (`inbound`) oder eine Ausgabe (`outbound`) handelt, wird rein und exklusiv über das Vorzeichen des Betrags (`value >= 0` bzw. `value < 0`) definiert – sowohl beim Importieren, beim Exportieren als auch beim Persistieren in der Datenbank.

## 2. Anforderungen & User Stories

- [x] `TransactionType` bleibt als `'inbound' | 'outbound'` typisiert, `Transaction.type` wird jedoch als virtuelles/optionales Attribut bzw. Getter bereitgestellt.
- [x] Neuer Helfer `getTransactionType(txOrValue: { value: number } | number): TransactionType` in `src/types/finance.ts`.
- [x] `buildCompoundSearchField` stützt sich auf die Hilfsmethode `getTransactionType(tx)` (Single Source of Truth).
- [x] Deterministic ID & Fingerprint: Benötigen keinen Typ, da der vorzeichenbehaftete Betrag (`value.toFixed(2)`) die Flussrichtung bereits eindeutig festlegt.
- [x] **Persistierung (IndexedDB & MemoryStore in `db.ts`):**
  - Beim Speichern (`saveTransaction`, `saveTransactions`) wird `type` nicht in die Datenbank geschrieben (gestrippt).
  - Beim Auslesen (`getTransactions`) wird `type` über `normalizeTx` als virtueller Getter (`get type(): TransactionType { return this.value >= 0 ? 'inbound' : 'outbound'; }`) bereitgestellt.
- [x] **Export & Import (`db.ts`):**
  - Beim Export (`exportConfiguration`) enthält das Export-JSON kein `type`-Feld bei `manualTransactions`.
  - Beim Import (`importConfiguration`) wird ein eventuell in Altdaten vorhandenes `type`-Feld vor der Persistierung ignoriert / gestrippt.
- [x] **CSV-Import (`csvParser.ts`):**
  - Es wird kein statisches `type`-Feld mehr für die Datenbank persistiert; die Bestimmung erfolgt rein aus dem Betragsvorzeichen via virtuellem Getter.
- [x] **UI & Modale:**
  - `TransactionModal.tsx`: Der Typ (Einnahme/Ausgabe-Toggle) steuert rein das Vorzeichen von `value` (`-Math.abs(amount)` vs. `Math.abs(amount)`). Gespeichert wird nur der signierte `value`.
  - `Transactions.tsx`: Der Filter für Typ (`inbound` / `outbound`) filtert direkt auf Basis von `tx.value >= 0` bzw. `tx.value < 0` via `getTransactionType`.
  - `FinanceContext.tsx`: Beim Aufteilen (`splitTransaction`) wird `type` nicht mehr aus `originalTx` kopiert, sondern ergibt sich aus dem Vorzeichen des Splitbetrags.
- [x] **Tests:**
  - Alle bestehenden Tests bleiben grün oder wurden an das virtuelle Verhalten angepasst.
  - Neue Tests für das Nicht-Persistieren und die korrekte dynamische Typauflösung hinzugefügt.

## 3. Technische Konzeption & Betroffene Komponenten

- **`src/types/finance.ts`:**
  - `Transaction.type` als virtuelles optionales Attribut deklariert.
  - Export von `getTransactionType(...)`.
  - `buildCompoundSearchField` auf `getTransactionType(tx)` umgestellt.
- **`src/services/storage/db.ts`:**
  - `normalizeTransaction` mit virtuellem Getter `get type()`.
  - `saveTransaction` & `saveTransactions`: Bereinigung via `sanitizeForPersistence` vor ObjectStore-`put`.
  - `exportConfiguration` & `importConfiguration`: Strippen von `type`.
- **`src/services/csv/csvParser.ts`:**
  - Virtueller Getter `get type()` im Rückgabeobjekt von `parseBankCsv`.
- **`src/services/storage/FinanceContext.tsx`:**
  - Statischer `type` im `newSplitTx` entfernt.
- **`src/components/modals/TransactionModal.tsx`:**
  - Initialisierung von `type` aus `getTransactionType(initialTransaction.value)`.
  - Kein `type`-Feld mehr im `onSave`-Payload.
- **`src/pages/Transactions.tsx`:**
  - Typ-Filterprüfung auf Basis von `getTransactionType(tx)`.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typ- & Helper-Definitionen (`src/types/finance.ts`)**
   - Helper `getTransactionType` hinzugefügt.
   - `Transaction.type` als virtuelles Feld gekennzeichnet.
   - `buildCompoundSearchField` auf `getTransactionType` umgestellt.
2. [x] **Schritt 2: Speicher-Layer Anpassungen (`src/services/storage/db.ts`)**
   - Strippen von `type` vor `put` in `saveTransaction`, `saveTransactions` und `importConfiguration`.
   - Strippen von `type` in `exportConfiguration`.
   - Dynamischer Getter in `normalizeTransaction`.
3. [x] **Schritt 3: CSV-Parser & Context (`src/services/csv/csvParser.ts`, `FinanceContext.tsx`)**
   - Anpassung der Rückgabe in `parseBankCsv`.
   - Anpassung in `splitTransaction`.
4. [x] **Schritt 4: UI & Modale (`TransactionModal.tsx`, `Transactions.tsx`)**
   - Payload und Filterlogik angepasst.
5. [x] **Schritt 5: Tests schreiben & verifizieren**
   - Unit-Tests in `finance.test.ts`, `db.test.ts`, `csvParser.test.ts`.
   - `pnpm format:check && pnpm test && pnpm build`.

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`) - 122/122 Tests grün
- [x] Prettier Formatierung (`pnpm format:check`)
- [x] TypeScript Check & Vite Build (`pnpm build`)
