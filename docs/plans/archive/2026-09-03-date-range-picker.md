# Plan: Reusable Period & Date Range Picker (Monats-, Quartals- & Jahresebene)

* **Status:** In Arbeit
* **Erstellt am:** 2026-09-03
* **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht
Einführung einer modernen, wiederverwendbaren `DateRangePicker`-Komponente, die sich auf **Monats-, Quartals-, Halbjahres- und Jahresebene** fokussiert (keine Tagesebene). Die Komponente bietet Schnellauswahl-Presets („Dieses Jahr“, „Dieses Halbjahr“, „Dieses Quartal“, „Dieser Monat“, „Letztes Jahr“, „Letztes Quartal“, etc.) sowie eine freie Von–Bis-Auswahl ganzer Monate.

## 2. Anforderungen & User Stories
- [ ] **Presets (Schnellauswahl):**
  - Dieses Jahr (01.01. – 31.12. des laufenden Jahres)
  - Dieses Halbjahr (H1 oder H2 des laufenden Jahres)
  - Dieses Quartal (Q1, Q2, Q3 oder Q4)
  - Dieser Monat (1. bis letzter Tag des aktuellen Monats)
  - Letztes Jahr, Letztes Halbjahr, Letztes Quartal, Letzter Monat
  - Gesamter Zeitraum (Filter zurücksetzen)
- [ ] **Freie Von-Bis-Auswahl auf Monatsebene:**
  - Auswahl von Start-Monat/Jahr bis End-Monat/Jahr.
  - Automatische Ermittlung des 1. Tages des Startmonats und des letzten Tages des Endmonats für präzises Filtern (`YYYY-MM-DD`).
- [ ] **Modernes Popover-UI:**
  - Kompakter Trigger-Button mit Kalender-Icon, formatiertem Datumsbereich und Löschen-Button (`✕`).
  - Schnellauswahl über ansprechende Quick-Pills.
  - Schließen bei Klick außerhalb (Click-Outside) und Escape-Taste.
- [ ] **Integration in Transactions:**
  - Ersetzt die beiden alten Tages-Datumsfelder durch den neuen Perioden-/DateRangePicker.

## 3. Technische Konzeption & Betroffene Komponenten
* **Helferfunktionen (`src/utils/dateUtils.ts`):**
  - `DateRangePreset` Typdefinition.
  - `getDateRangeForPreset(preset, referenceDate?)`.
  - `getMonthDateRange(startMonth, endMonth)`.
  - `detectPresetForRange(startDate, endDate, referenceDate?)`.
  - `formatDateRangeDisplay(startDate, endDate)`.
* **UI-Komponente (`src/components/DateRangePicker.tsx`):**
  - Popover-Menü mit Presets und Von–Bis (Monatsauswahl).
* **Transaktions-Filter (`src/pages/Transactions.tsx`):**
  - Einbindung in die Filterleiste.

## 4. Schrittweiser Umsetzungsplan
1. [ ] **Schritt 1: Helferfunktionen & Presets in `dateUtils.ts`**
2. [ ] **Schritt 2: `DateRangePicker`-Komponente & Tests**
3. [ ] **Schritt 3: Integration in `Transactions.tsx` & Testanpassung**
4. [ ] **Schritt 4: Verifikation (`pnpm test`, `pnpm build`)**

## 5. Verifikationsplan
- [ ] Unit-Tests erfolgreich (`pnpm test`)
- [ ] TypeScript Check & Build erfolgreich (`pnpm build`)
