# Plan: Umschaltung zwischen Kategorien- und Konten-Ansicht in der Cashflow-Analyse

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Abgeschlossen am:** 2026-09-04
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Motivation

In der bisherigen Cashflow-Analyse (`/analytics/cashflow`) werden Cashflow-Ströme ausschließlich nach Kategorien gruppiert dargestellt.  
Wenn Unstimmigkeiten zwischen Salden und Cashflow auftreten oder wenn nachvollzogen werden soll, über welches reale Bankkonto oder virtuelle Unterkonto welche Geldströme geflossen sind, fehlt der direkte Einblick auf Kontoebene.

Ziel ist die Einführung eines Umschalters in der Cashflow-Analyse zwischen:

1. **Kategorien-Ansicht** (bisherige Standard-Hierarchie mit Soll-Budgets)
2. **Konten-Ansicht** (Hierarchie: Echte Bankkonten mit ihren virtuellen Unterkonten, Ein-/Ausgänge und Netto-Cashflow je Konto und Periode)

---

## 2. Anforderungen & User Stories

- [x] **Ansichts-Umschalter (Segmented Control):**
  - Oben in der Cashflow-Ansicht ein Segmented Switch `[ Kategorien | Konten ]` mit Icons (`FolderTree` / `Landmark`).
  - Persistierung der Wahl im `localStorage` (`cashflow_view_mode: 'categories' | 'accounts'`).
- [x] **Berechnung des Konten-Cashflows (`cashflowCalculator.ts`):**
  - Neue Funktion `calculateAccountCashflowMatrix` (oder Erweiterung von `calculateCashflowMatrix` mit `groupBy: 'categories' | 'accounts'`).
  - Echte Bankkonten (`accountType !== 'virtual'`):
    - Direkte Buchungen des Kontos erfassen (`tx.value >= 0` -> inbound, `tx.value < 0` -> outbound).
  - Virtuelle Unterkonten (`accountType === 'virtual'`):
    - Transaktionen erfassen, die über `getTransactionEffectiveValueForAccount` dem virtuellen Unterkonto zugeordnet sind.
  - Gesamtsumme (`totalRow`):
    - Summiert nur echte Konten auf, um Doppelzählungen durch virtuelle Sub-Allokationen zu verhindern.
- [x] **Tabelle in der Konten-Ansicht (`Cashflow.tsx`):**
  - Spaltentitel: "Konto" statt "Kategorie".
  - Darstellung der echten Konten mit Icon, Farbe und Name; darunter eingerückt und auf-/zuklappbar die zugehörigen virtuellen Unterkonten mit "Virtuell"-Pill.
  - Zeitraumspalten, Jahres-Gruppen (auf-/zuklappbar) und Durchschnitts-Spalte identisch nutzbar.
  - Netto-Gesamtergebnis-Zeile summiert konsistent die realen Konten.
- [x] **Diagramm-Anpassung (`StackedCategoryBarChart.tsx`):**
  - Kann im Konten-Modus betrieben werden: Die gestapelten Balken und der Donut zeigen die Konten statt Kategorien mit ihren Kontofarben.
- [x] **Filter-Kompatibilität:**
  - DateRangePicker und Granularitäts-Umschalter wirken wie gewohnt auf beide Ansichten.
  - Kategorie-Filter bleibt aktiv: Wählt der Nutzer Kategorien aus, zeigt die Konten-Ansicht exakt, über welche Konten Buchungen dieser Kategorien liefen.

---

## 3. Technische Konzeption & Betroffene Komponenten

### [Analytics-Engine]

- **`src/services/analytics/cashflowCalculator.ts`**:
  - `AccountCashflowRow` Interface definieren.
  - `calculateAccountCashflowMatrix(accounts, transactions, granularity, selectedAccountId, options)` implementieren.
  - Unit-Tests in `cashflowCalculator.test.ts`.

### [UI-Komponenten & Pages]

- **`src/pages/Cashflow.tsx`**:
  - State `viewMode: 'categories' | 'accounts'` (aus `localStorage`).
  - Segmented Switch `[ Kategorien | Konten ]`.
  - Je nach Modus `matrix` für Kategorien oder `accountMatrix` für Konten rendern.
  - Auf-/Zuklappen von Elternkonten mit Chevron.
- **`src/components/analytics/StackedCategoryBarChart.tsx`**:
  - Prop `mode?: 'categories' | 'accounts'` hinzufügen für angepasste Tooltip-Texte und Donut-Titel.

---

## 4. Verifikationsplan

### Automatisierte Tests

- `pnpm test` – Neue Tests für `calculateAccountCashflowMatrix` und Test-Updates für `Cashflow.test.tsx` und `StackedCategoryBarChart.test.tsx`.
- `pnpm build` – TypeScript-Typen & Vite-Build fehlerfrei.
- `pnpm format:check` – Prettier-Formatierung einhalten.
