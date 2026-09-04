# Plan: Keine manuellen Transaktionen & strikte Betragserhaltung bei Splits

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

1. **Keine manuellen Transaktionen mehr hinzufügen:**
   Transaktionen dürfen nicht mehr frei von Hand neu erstellt werden. Alle Transaktionen stammen aus Bank-Imports (CSV). Die Buttons und Dialogmodi zur Neuanlage wurden entfernt.
2. **Strikte Betragserhaltung bei Splits – auch beim späteren Ändern:**
   Der ursprüngliche Bankbetrag einer Transaktion ist unveränderbar und muss in jeder Situation (Erst-Split, Hinzufügen weiterer Teilbeträge, Bearbeiten bestehender Teilbeträge, Löschen/Zurücksetzen von Splits) zu 100% erhalten bleiben. Die Summe aller Split-Teile (Hauptbuchung + Split-Teile) entspricht immer exakt dem Originalbetrag der Bankbuchung.

---

## 2. Anforderungen & User Stories

- [x] **A1: Entfernen der manuellen Transaktionserstellung**
  - "Neue Buchung"-Button in `Transactions.tsx` entfernt.
  - "Transaktion hinzufügen"-Button in `Dashboard.tsx` entfernt.
  - Manuelle Buchungserstellung vollständig unterbunden.
- [x] **A2: Betragserhaltung im Datenmodell & Context (`FinanceContext`)**
  - Bei Split-Erstellung und Split-Änderung: Summe aller Teile = Originalbankbetrag.
  - Beim Löschen eines Split-Teils (`deleteTransaction`): Der Betrag des gelöschten Split-Teils wird automatisch der Hauptbuchung wieder gutgeschrieben.
  - Beim Zurücksetzen einer gesplitteten Buchung (`resetTransaction`): Alle zugehörigen Split-Kinder werden entfernt und die Hauptbuchung erhält ihren ursprünglichen Betrag zurück.
  - Beim Löschen der Hauptbuchung: Alle zugehörigen Split-Kinder werden mitgelöscht.
  - Neue Context-Funktion `updateSplitGroup(...)` für das atomare Aktualisieren aller Split-Teile einer Buchung.
- [x] **A3: Split-Dialog zur flexiblen Bearbeitung mit Festhaltung des Gesamtbetrags**
  - Wenn ein Split aufgerufen wird (egal ob von der Hauptbuchung oder einem Split-Teil aus), wird die Split-Funktionalität bereitgestellt.
  - Der Bank-Originalbetrag wird fix angezeigt und kann nicht überschritten werden.
  - Der Restbetrag der Hauptbuchung passt sich dynamisch an, sodass die Summe stets exakt dem Originalbetrag entspricht.
- [x] **A4: Tests & Verifikation**
  - Unit-Tests in `FinanceContext.test.tsx`, `TransactionModal.test.tsx`, `Transactions.test.tsx`.
  - Alle Tests und `pnpm build` laufen fehlerfrei durch.

---

## 3. Technische Konzeption & Betroffene Komponenten

- **`src/services/storage/FinanceContext.tsx`:**
  - `updateSplitGroup(originalId: string, splits: Array<{ id?: string; amount: number; subject: string; receiver: string; categoryId: string | null }>)`: Atomares Neuausrichten aller Split-Teile bei fester Originalsumme.
  - `deleteTransaction`: Bei Split-Kind (`splitFromId`) Betrag zurück an den Parent transferieren.
  - `resetTransaction`: Bei Split-Parent alle Split-Kinder entfernen.
- **`src/components/modals/TransactionModal.tsx`:**
  - Split-Modus mit dynamischer Restbetrag-Berechnung und strenger Betragserhaltung.
- **`src/pages/Transactions.tsx`:**
  - Entfernen des "Neue Buchung"-Buttons.
  - Split-Aufruf für Parent und Child möglich.
- **`src/pages/Dashboard.tsx`:**
  - Entfernen des Buttons "Transaktion hinzufügen".

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Manuelle Neuanlage-Buttons entfernen (`Transactions.tsx`, `Dashboard.tsx`)**
2. [x] **Schritt 2: `FinanceContext` mit strikter Betragserhaltung und `updateSplitGroup` erweitern**
3. [x] **Schritt 3: `TransactionModal` und Split-Abläufe absichern**
4. [x] **Schritt 4: Aufruf und Verknüpfung in `Transactions.tsx` und `TransactionDetailModal.tsx` anpassen**
5. [x] **Schritt 5: Tests anpassen und neue Tests für Betragserhaltung schreiben**
6. [x] **Schritt 6: Verifikation (`pnpm test && pnpm build`)**

---

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Prettier Formatierung (`pnpm format:check`)
