# Plan: Drag-and-Drop für Buckets (Reihenfolge & Hierarchie) und Accounts (Reihenfolge)

* **Status:** Abgeschlossen
* **Erstellt am:** 2026-09-02
* **Abgeschlossen am:** 2026-09-02
* **Bearbeiter:** Antigravity & Entwickler-Team

---

## 1. Ziel & Übersicht
Ermöglichung von intuitivem Drag-and-Drop in der Konfiguration (`/configuration`):
1. **Buckets:** Reihenfolge unter Geschwister- und Top-Level-Buckets ändern sowie Eltern-Kind-Hierarchien per Nesting flexibel anpassen.
2. **Accounts:** Reihenfolge der Konten-Karten per Drag-and-Drop anpassen.

---

## 2. Anforderungen & User Stories
- [x] **Sortierung (Order):** `EntityVisualMetadata` (und damit `Bucket` und `Account`) erhält ein `order?: number` Attribut zur deterministischen Sortierung.
- [x] **Visuelles Drag-Handle:**
  - Bucket-Zeilen erhalten ein `GripVertical`-Handle.
  - Account-Karten erhalten ein `GripVertical`-Handle.
- [x] **Drop-Zonen für Buckets:**
  - **Oberer Rand ('before'):** Als Geschwister oberhalb anordnen (gleiche `parentId`).
  - **Mitte / Zeile ('inside'):** Als Kind-Bucket unterordnen (`parentId = target.id`).
  - **Unterer Rand ('after'):** Als Geschwister unterhalb anordnen (gleiche `parentId`).
  - **Root-Dropzone:** Kind-Buckets auf Top-Level-Ebene herausziehen (`parentId = null`).
- [x] **Drop-Zonen für Accounts:**
  - Verschieben und Umsortieren von Konten ('before' / 'after').
- [x] **Zyklen- & Selbst-Drop-Schutz:** Ein Bucket kann nicht in sich selbst oder in seine Nachkommen verschoben werden.
- [x] **Persistenz & Kontext:** `reorderBuckets` und `reorderAccounts` in `FinanceContext` und `db.ts` zur Batch-Speicherung in IndexedDB.

---

## 3. Technische Konzeption & Betroffene Komponenten
* **Domain Model (`src/types/finance.ts`):**
  - Ergänzung von `order?: number` in `EntityVisualMetadata`.
* **Storage & Context (`src/services/storage/`):**
  - `reorderBuckets(updatedBuckets: Bucket[])` und `reorderAccounts(updatedAccounts: Account[])` in `FinanceContext.tsx` und `db.ts`.
* **UI (`src/pages/Configuration.tsx`):**
  - Drag-and-Drop Handlers für Bucket-Zeilen und Account-Karten mit visueller Hervorhebung.
* **Cashflow & Balances Matrix Views:**
  - Automatische Sortierung von Buckets und Accounts nach `(a.order ?? 0) - (b.order ?? 0)`.

---

## 4. Schrittweiser Umsetzungsplan
1. [x] **Schritt 1: Typdefinitionen (`order?: number`)**
   - Datei: `src/types/finance.ts`
2. [x] **Schritt 2: Batch Storage & Context Methoden**
   - Datei: `src/services/storage/db.ts` & `FinanceContext.tsx`
3. [x] **Schritt 3: Drag & Drop UI für Buckets & Accounts**
   - Datei: `src/pages/Configuration.tsx`
4. [x] **Schritt 4: Tests & Verifikation**
   - Datei: `src/pages/Configuration.test.tsx` & `src/services/storage/FinanceContext.test.tsx`

---

## 5. Verifikationsplan
- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)

