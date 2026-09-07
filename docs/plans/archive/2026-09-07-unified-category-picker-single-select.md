# Plan: Einheitlicher Kategorie-Picker mit Einzel-Auswahlmodus und integriertem Suchfeld

- **Status:** Abgeschlossen
- **Datum:** 2026-09-07
- **Beteiligte:** Coding-Agent, Benutzer

---

## 🎯 Ziel & Motivation

In der Transaktionsübersicht (`Transactions.tsx`) werden Kategorien in den Tabellenzeilen bislang über ein einfaches HTML-`<select>` ausgewählt, während an anderen Stellen (Filter in Analytics, Transaktionen, AccountModal) die reichhaltige Baumkomponente `CategoryFilterDropdown` (mit Icons, Farben, Hierarchie) verwendet wird.
Ziel ist es, `CategoryFilterDropdown` um einen Einzel-Auswahlmodus (`mode="single"`) sowie ein integriertes Suchfeld zu erweitern und als einheitlichen Picker in den Zeilen der Transaktionsübersicht einzusetzen.

---

## 📋 Geplante Arbeitsschritte

- [x] **1. `CategoryFilterDropdown.tsx` erweitern**
  - [x] `mode?: 'multi' | 'single'` (Default: `'multi'`)
  - [x] `selectedCategoryId?: string | null` und `onSelectCategory?: (id: string | null) => void`
  - [x] Integriertes Suchfeld mit Lupe, Clear-Button und automatischer Baumfilterung/Aufklappen
  - [x] Kompakt-Modus (`compact?: boolean`) für Tabellenzellen
  - [x] Hervorhebung und Schließen bei Einzelauswahl
  - [x] `z-30 relative` Stacking für Tabellen-Overlays
- [x] **2. Integration in `Transactions.tsx`**
  - [x] Ersetzen des nativen `<select>` in den Tabellenzeilen durch `<CategoryFilterDropdown mode="single" compact ... />`
  - [x] Aufräumen nicht mehr benötigter Memos
- [x] **3. Tests & Verifikation**
  - [x] Unit-Tests in `CategoryFilterDropdown.test.tsx` für Einzelmodus, Suche und Abwärtskompatibilität
  - [x] Anpassung/Erweiterung der Tests in `Transactions.test.tsx`
  - [x] `pnpm test`, `pnpm build`, `pnpm format:check`
