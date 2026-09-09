# Plan: Analytics Deep Links zur Buchungsseite

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-09
- **Bearbeiter:** Antigravity Agent

---

## 1. Ziel & Übersicht

Einführung von direkten Deep Links von der Analyse-Ansicht (insb. Cashflow-Diagramme und -Tabelle) auf die Buchungsseite (`/transactions`).
Nutzer können durch Klick auf ein Balken-/Donut-Segment im Diagramm oder auf eine Perioden-Zelle in der Cashflow-Tabelle direkt zu den zugehörigen Buchungen springen, wobei Kategorie (inkl. "Nicht kategorisiert"), Datumsbereich (Monat, Quartal, Jahr) und ggf. das ausgewählte Konto automatisch als URL-Filter gesetzt werden.

## 2. Anforderungen & User Stories

- [x] **R1 (URL-Generator & Navigation Helper):** Bereitstellung einer typsicheren Hilfsfunktion `buildTransactionsUrl(filters)` und `useSafeNavigate()`, die aus Filterangaben (Kategorie, Datum, Konto) eine saubere Transaktions-URL generiert.
- [x] **R2 (Chart Deep Links):**
  - Klick auf ein Segment im gestapelten Balkendiagramm (`StackedCategoryBarChart`) navigiert zu `/transactions` mit der gewählten Kategorie (bzw. Konto) und dem exakten Zeitraum (`startDate`, `endDate`).
  - Tooltip und Segmente bieten visuelle und barrierefreie Interaktionshinweise (`title`, `tabIndex={0}`, Klickhinweis im Tooltip).
  - Klick auf ein Segment im Donut-Chart navigiert zu den gefilterten Buchungen der Kategorie im Gesamtzeitraum.
- [x] **R3 (Tabellen-Zellen Deep Links):**
  - Klick auf eine Perioden-Zelle einer Kategoriezeile in `Cashflow.tsx` navigiert zu `/transactions` mit `category=<categoryId>` und dem Datumsbereich der Spalte.
  - Klick auf eine Perioden-Zelle der Zeile "Nicht kategorisiert" navigiert mit `category=__uncategorized__`.
  - Klick auf eine Perioden-Zelle im Kontenmodus navigiert mit `account=<accountId>`.
  - Wenn im Analyse-Filter ein Konto gewählt ist (`selectedAccountId !== 'all'`), wird dieses bei Kategorie-Deep-Links mitübergeben.
  - Dezent hervorgehobener Hover-State und `title`-Tooltip für alle klickbaren Zellen.
- [x] **R4 (Router-Sicherheit & Abwärtskompatibilität):**
  - Sicherstellung, dass Navigation über `useSafeNavigate` auch in Komponenten-Tests außerhalb eines `<Router>`-Kontexts fehlerfrei funktioniert.
- [x] **R5 (Verifikation & Tests):**
  - Automatisierte Tests für Chart-Klicks und Tabellen-Zellen-Klicks in `StackedCategoryBarChart.test.tsx` und `Cashflow.test.tsx`.
  - `pnpm test`, `pnpm format:check` und `pnpm build` ohne Fehler.

## 3. Technische Konzeption & Betroffene Komponenten

- **UI & Pages (`src/ui/`):**
  - `src/ui/pages/Transactions.tsx`: Exportieren von `buildTransactionsUrl(filters)` und `useSafeNavigate()`.
  - `src/ui/components/analytics/StackedCategoryBarChart.tsx`:
    - Integration von `useSafeNavigate()` und `buildTransactionsUrl()`.
    - Klick-Handler für Balken-Slices und Donut-Slices.
    - Tooltip-Hinweis "Klicken für Buchungsdetails".
  - `src/ui/pages/Cashflow.tsx`:
    - Klick-Handler und Hover-Styles für Tabellenzellen (Kategorien, Unkategorisiert, Konten).
    - Berücksichtigung von Einzelperioden und zusammengeklappten Jahres-Spalten.
  - `src/ui/components/analytics/StackedCategoryBarChart.test.tsx`: Neue Tests für Deep-Link-Navigation.
  - `src/ui/pages/Cashflow.test.tsx`: Neue Tests für Tabellen-Zellen-Klick-Navigation.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: `buildTransactionsUrl` und `useSafeNavigate` in `Transactions.tsx` exportieren**
2. [x] **Schritt 2: Deep Links im `StackedCategoryBarChart` einbinden (Balken & Donut)**
3. [x] **Schritt 3: Deep Links in der `Cashflow`-Tabelle einbinden (Kategorie-, Unkategorisiert- und Kontozellen)**
4. [x] **Schritt 4: Tests für Chart- und Tabellen-Navigation schreiben und ausführen**
5. [x] **Schritt 5: Formatierung prüfen & Verifikation (`pnpm test`, `pnpm build`)**

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Prettier Format Check (`pnpm format:check`)
