# Plan: Gestapeltes Kategorie-Balkendiagramm in der Cashflow-Analyse

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Auf der Analyse-Seite (Bereich Cashflow) wurde oberhalb der Matrix-Tabelle ein interaktives, responsives Balkendiagramm eingefügt, das pro Zeiteinheit (Monat, Quartal, Halbjahr, Jahr je nach gewählter Granularität und Date-Range-Picker) die Beträge der Top-Level-Kategorien (inkl. Nicht-kategorisiert) gestapelt darstellt. Die Kategorien bestimmen selbst, ob es sich um Einnahmen (oberhalb der Nulllinie) oder Ausgaben (unterhalb der Nulllinie) handelt. Das Diagramm bietet zudem einen Filter für Kategorien und ist ein-/ausklappbar.

## 2. Anforderungen & User Stories

- [x] Eigenständige, modulare Komponente `StackedCategoryBarChart` mit vollständiger TypeScript-Typisierung und TSDoc.
- [x] Pro Zeiteinheit (Periode) wird eine Säule dargestellt:
  - Einnahmen-Kategorien (`net > 0`) stapeln sich nach oben ab der 0-Linie.
  - Ausgaben-Kategorien (`net < 0`) stapeln sich nach unten ab der 0-Linie.
  - Kein gesonderter Ausgaben/Einnahmen-Modus-Umschalter nötig; Kategorien bestimmen dies selbst.
- [x] **Kategorie-Filter & visuelle Metadaten:**
  - Multi-Select Filter im Chart-Header und in der globalen Analytics-Toolbar zum Ein-/Ausblenden einzelner Kategorien inkl. Kategorie-Farbe und Kategorie-Icon.
  - **Synchronisation mit Matrix-Tabelle:** Der Kategorie-Filter filtert synchron sowohl das Diagramm als auch die Matrix-Tabelle, die KPI-Karten und die Gesamtsummenzeile.
  - **Keine separate Farblegende:** Da der interaktive Hover-Tooltip alle Details (Kategorie-Name, Icon, Farbe, Betrag, Anteil) liefert, wird auf eine statische Farblegende verzichtet.
- [x] **Filter- & Date-Picker-Integration:**
  - Reagiert nahtlos auf DateRangePicker (`startDate`, `endDate`), Konto-Filter und Granularität aus dem `AnalyticsContext`.
- [x] Detaillierter Hover-Tooltip je Segment mit **Kategorie-Icon, Kategorie-Farbe**, Kategorie-Name, Betrag, prozentualem Anteil an Einnahmen/Ausgaben und Periodensumme.
- [x] Ein-/Ausklappbar über den Card-Header mit Persistierung in `localStorage`.
- [x] Saubere Empty-State-Behandlung bei Zeiträumen ohne Buchungen.
- [x] 100% Co-Located Unit-Tests für die neue Komponente und Integrationstest in `Cashflow.test.tsx`.

## 3. Technische Konzeption & Betroffene Komponenten

- **UI / Komponenten (`src/components/analytics/`):**
  - Neu: `src/components/analytics/StackedCategoryBarChart.tsx`
  - Neu: `src/components/analytics/StackedCategoryBarChart.test.tsx`
- **Pages (`src/pages/Cashflow.tsx`):**
  - Einbindung der Komponente zwischen den KPI-Karten und der Cashflow-Matrix-Tabelle.
- **Services & State:**
  - Nutzt direkt das existierende `CashflowAnalysisResult` aus `calculateCashflowMatrix`. Keine Backend- oder Schemaänderungen erforderlich.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Plandokumentation anlegen**
   - Datei: `docs/plans/active/2026-09-03-stacked-bar-chart-cashflow.md`
2. [x] **Schritt 2: Komponente `StackedCategoryBarChart` implementieren**
   - Datei: `src/components/analytics/StackedCategoryBarChart.tsx`
   - SVG-basiertes gestapeltes Balkendiagramm, Zero-Baseline (Einnahmen oben, Ausgaben unten), Kategorie-Filter-Dropdown mit Icons/Farben, interaktiver Tooltip (ohne Farblegende).
3. [x] **Schritt 3: Tests für Komponente erstellen**
   - Datei: `src/components/analytics/StackedCategoryBarChart.test.tsx`
4. [x] **Schritt 4: Einbindung in `Cashflow.tsx` & Page-Tests**
   - Datei: `src/pages/Cashflow.tsx`
   - Datei: `src/pages/Cashflow.test.tsx`
5. [x] **Schritt 5: Verifikation & Formatierung**
   - `pnpm format`, `pnpm test`, `pnpm build`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Manuelle Prüfung im Browser (`pnpm dev`)
