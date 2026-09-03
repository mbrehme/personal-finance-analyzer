# Plan: Analytics Layout mit Subpages Cashflow und Salden

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Cashflow und Salden wurden als untergeordnete Subpages unter einem gemeinsamen Hauptbereich **Analyse** (`/analytics`) zusammengefasst – analog zur bestehenden Struktur von **Konfiguration** (`/configuration/buckets`, `/configuration/accounts`).
Der Headerbereich mit der Auswahl von:

1. **Konto** (Alle Konten oder spezifisches Konto)
2. **Granularität** (Monatlich, Quartal, Halbjahr, Jährlich)
3. **Date Range Picker** (Zeitraum-Auswahl mit Presets und Von–Bis)

gilt global für beide Unterseiten. Beim Wechsel zwischen Cashflow und Salden bleiben alle Filtereinstellungen nahtlos erhalten.

## 2. Anforderungen & User Stories

- [x] Neuer Layout-Container `AnalyticsLayout.tsx` unter `src/pages/analytics/` mit:
  - Globalem Header & Titel „Analyse“
  - Gemeinsamer Filter-Toolbar (Konto-Dropdown, Granularitäts-Umschalter `PeriodSelector`, `DateRangePicker`)
  - Persistenz der Filterwerte im `localStorage`
  - Subpage-Tabs: **Cashflow** (`/analytics/cashflow`) und **Salden** (`/analytics/balances`)
  - `<Outlet />` zur Einbettung der aktiven Subpage
- [x] Routing in `src/App.tsx`:
  - Neue Route `/analytics` mit Kind-Routen `cashflow` und `balances`
  - Index-Redirect von `/analytics` auf `cashflow`
  - Abwärtskompatible Weiterleitungen von `/cashflow` -> `/analytics/cashflow` und `/balances` -> `/analytics/balances`
- [x] Hauptnavigation in `src/components/Header.tsx`:
  - Ersetzen der separaten Links „Cashflow“ und „Salden“ durch einen einzelnen Navigationslink **„Analyse“** (`/analytics`), der aktiv ist, wenn man sich in `/analytics/*` befindet.
- [x] Refactoring von `Cashflow.tsx` und `Balances.tsx`:
  - Anbindung an die vom Layout bereitgestellten globalen Filter-Zustände (Konto, Granularität, Date Range)
  - Entfernung redundanter Toolbars / Header in den Subpages
  - Unterstützung des Kontofilters und DateRange-Filters auch in `Balances.tsx` / `balanceCalculator.ts`
- [x] Vollständige Testabdeckung (`vitest`) für Layout, Routing und Subpages.

## 3. Technische Konzeption & Betroffene Komponenten

- **UI / Komponenten (`src/pages/analytics/`):**
  - `AnalyticsLayout.tsx`: Gemeinsamer Layout-Container mit Toolbar, Tabs und Outlet.
  - `AnalyticsContext.tsx`: Typisierter React Context / Hook zur Weitergabe der globalen Filterzustände an die Kindkomponenten.
  - `Cashflow.tsx`: Nutzt Filter aus Context; eigener Toolbar-Header entfällt.
  - `Balances.tsx`: Nutzt Filter aus Context; eigener Toolbar-Header entfällt.
- **Services & Rechner (`src/services/analytics/`):**
  - `balanceCalculator.ts`: Optionaler Kontofilter und Datumsfilter für die Salden-Timeline.
- **Routing & Navigation (`src/App.tsx`, `src/components/Header.tsx`):**
  - `Header.tsx`: Ersetzt Cashflow/Salden durch „Analyse“.
  - `App.tsx`: Definiert `/analytics` als verschachtelte Route.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: AnalyticsContext & AnalyticsLayout erstellen**
   - `src/pages/analytics/AnalyticsContext.tsx`
   - `src/pages/analytics/AnalyticsLayout.tsx` & `AnalyticsLayout.test.tsx`
2. [x] **Schritt 2: Routing in App.tsx & Navigation in Header.tsx anpassen**
   - `src/App.tsx`
   - `src/components/Header.tsx` & `src/components/Header.test.tsx`
3. [x] **Schritt 3: Cashflow.tsx und Balances.tsx auf globale Filter umstellen**
   - Anbindung an `useAnalyticsFilter()`
   - `balanceCalculator.ts` um Konto- & Datumsunterstützung erweitern
4. [x] **Schritt 4: Tests anpassen & verifizieren**
   - `Cashflow.test.tsx`, `Balances.test.tsx`, `Header.test.tsx`, `App.test.tsx`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test` – 109 Tests bestanden)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Manuelle Prüfung von Tab-Wechsel und Filterpersistenz
