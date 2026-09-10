# Plan: Historisierte Soll-Budgets mit Gültig-ab Datum für Kategorien (Option B)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-10
- **Bearbeiter:** Agent

---

## 1. Ziel & Übersicht

Ermöglicht die Hinterlegung mehrerer historisierter und zukünftiger Soll-Budgets mit Gültigkeitsdatum (`validFrom`) pro Kategorie. Dadurch können Budgets für zukünftige Finanzplanungen definiert werden, ohne historische oder aktuelle Soll/Ist-Vergleiche in vergangenen Zeiträumen zu verändern.

## 2. Anforderungen & User Stories

- [x] `TargetBudget` wird um ein optionales `id` und `validFrom` (ISO-Datum) erweitert.
- [x] `Category` unterstützt neben dem abwärtskompatiblen `targetBudget` ein Array `targetBudgets?: TargetBudget[]`.
- [x] Fehlt `validFrom` (oder ist `null`/leer), gilt das Budget als Basisbudget ohne zeitliche Begrenzung.
- [x] In `cashflowCalculator.ts` werden Budgets periodenspezifisch berechnet:
  - Für jede Periode greift das zum Perioden-Enddatum gültige Budget mit dem spätesten `validFrom`.
  - Liegt die Periode vor allen definierten `validFrom`, greift kein Budget (`budget: undefined`, `diffToBudget: undefined`).
  - Eltern-Rollups aggregieren für jede Periode nur diejenigen Kinderbudgets, die in dieser spezifischen Periode bereits gültig sind.
- [x] Im `CategoryModal` können mehrere Budgets mit Betrag, Zyklus und "Gültig ab" angelegt, bearbeitet und entfernt werden.
- [x] In `CategoriesConfig` wird das aktive Budget sowie Hinweise auf zukünftige Budgets transparent angezeigt.
- [x] Sämtliche bestehenden Unit-Tests und Berechnungen bleiben abwärtskompatibel funktionsfähig.

## 3. Technische Konzeption & Betroffene Komponenten

- **Typen (`src/types/category.types.ts`):**
  - `TargetBudget.validFrom?: ISODateString | null;`
  - `TargetBudget.id?: string;`
  - `Category.targetBudgets?: TargetBudget[];`
  - Hilfsfunktionen `getCategoryBudgets` und `getActiveCategoryBudgetForDate`.
- **Domain & Analytics (`src/domain/modules/analytics/cashflowCalculator.ts`):**
  - `getEffectiveCategoryBudget` wird um Stichtag / Perioden-Enddatum erweitert.
  - `periods[pKey].budget` und `diffToBudget` werden periodenspezifisch ermittelt.
- **UI (`src/ui/components/modals/CategoryModal.tsx`, `src/ui/pages/configuration/CategoriesConfig.tsx`):**
  - Multi-Budget-Verwaltung im `CategoryModal`.
  - Darstellung in `CategoriesConfig`.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typdefinitionen & Hilfsfunktionen in `src/types/category.types.ts`**
2. [x] **Schritt 2: Domain-Logik & Periodenberechnung in `cashflowCalculator.ts` inkl. Tests**
3. [x] **Schritt 3: Multi-Budget-UI in `CategoryModal.tsx` und Tests in `CategoryModal.test.tsx`**
4. [x] **Schritt 4: Transparente Darstellung in `CategoriesConfig.tsx`**
5. [x] **Schritt 5: Gesamtverifikation (`pnpm test`, `pnpm build`, `pnpm format:check`)**

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Prettier Formatierung geprüft (`pnpm format:check`)
- [x] Änderungen verbleiben ungestaged im Working Tree
