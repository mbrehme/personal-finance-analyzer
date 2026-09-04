# Plan: Verheiratung von Transaktions-Detail- und Edit-Dialog (Inline-Editing)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Bislang existierten zwei getrennte Dialoge für bestehende Transaktionen:

1. `TransactionDetailModal`: Reine Detailansicht (Suchstring, Metadaten, IBANs, Rohdaten) mit Weiterleitungs-Buttons.
2. `TransactionModal` (`mode='edit'`): Formular zur Bearbeitung von Transaktionsdaten.

Ziel dieser Änderung ist es, beide Dialoge in einem einzigen, intuitiven Dialog (`TransactionDetailModal`) zu vereinen („zu verheiraten“). Der Nutzer kann dort alle relevanten Transaktionsfelder direkt **inline bearbeiten** (Verwendungszweck, Partner/Empfänger, Kategorie, Daten, Konto), während der Betrag aus buchhalterischen Gründen fixiert bleibt und ausschließlich über die Split-Funktion verändert werden kann.

---

## 2. Anforderungen & User Stories

- [x] **Inline-Bearbeitung der Basisdaten:**
  - Verwendungszweck (`subject`) und Partner/Empfänger (`receiver`/`issuer`) direkt in Eingabefeldern bearbeitbar.
  - Valuta- und Buchungsdatum (`valueDate`, `bookingDate`) per Datumsauswahl editierbar.
  - Buchungskonto (`accountIban` / `accountId`) per Dropdown (nur reale Konten) veränderbar.
- [x] **Inline-Kategoriezuweisung:**
  - Kategorie kann direkt über ein strukturiertes Auswahlfeld geändert oder entfernt werden.
  - Manuelle Zuweisung setzt die `assignmentSource` sauber auf `'manual'` bzw. `'unassigned'`.
- [x] **Betrag unveränderlich (Betragsschutz):**
  - Der Betrag ist im Dialog rein indikativ und nicht direkt veränderbar (_„Betrag kann nicht geändert werden, sondern nur über Split“_).
  - Ein direkter Button/Hinweis zur Split-Funktion steht prominent zur Verfügung.
- [x] **Suchstring & Metadaten bleiben voll erhalten:**
  - Zusammengesetzter Suchstring (Compound Key) mit granularer Textselektion (`select-text`) und Kopier-Button.
  - Technische Metadaten (Quelldatei, Importindex, Rohdaten-Historie bei Änderungen) bleiben transparent einsehbar.
- [x] **Speichern & Zurücksetzen:**
  - Ein Speichern-Button übernimmt alle vorgenommenen Änderungen über `onSave` / `updateTransaction`.
  - Bei veränderten Banktransaktionen erlaubt ein Reset-Button das Zurücksetzen auf die ursprünglichen Bank-Rohdaten.
- [x] **Integration in die Transaktionsseite (`Transactions.tsx`):**
  - Sowohl Zeilenklick als auch Stift-Icon (Bearbeiten) öffnen den vereinheitlichten Detail- und Edit-Dialog.
  - `TransactionModal` bleibt für Neuanlage (`mode='create'`) und Aufteilen (`mode='split'`) erhalten.

---

## 3. Technische Konzeption & Betroffene Komponenten

- **`src/components/modals/TransactionDetailModal.tsx`:**
  - Erweiterung der Props um `onSave: (tx: Transaction) => Promise<void>`.
  - Hinzufügen von lokalem Formular-State (`subject`, `partner`, `categoryId`, `valueDate`, `bookingDate`, `accountId`).
  - Umwandlung der statischen Textblöcke in saubere, fokussierbare Formularfelder (Inputs / Selects).
  - Validierung und Absenden via `onSave`.
- **`src/pages/Transactions.tsx`:**
  - Übergabe von `handleSaveTransaction` als `onSave`-Prop an `TransactionDetailModal`.
  - Anpassung der Bearbeiten-Aktion in der Tabelle, sodass direkt das Detail-Modal geöffnet wird.
- **Tests:**
  - `TransactionDetailModal.test.tsx` aktualisieren und um Tests für Inline-Editing, Speichern und Betragsschutz erweitern.
  - `Transactions.test.tsx` anpassen.

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Konzeption & Plan-Abstimmung**
   - Plan anlegen und User Feedback einholen.
2. [x] **Schritt 2: `TransactionDetailModal.tsx` mit Inline-Editing ausstatten**
   - Formularstatus, Inputs für Zweck, Partner, Datum, Kategorie, Konto.
   - Betrag als Readonly sperren mit Split-Button.
   - Speichern- und Reset-Logik integrieren.
3. [x] **Schritt 3: Anbindung in `Transactions.tsx`**
   - `onSave` anbinden, Edit-Button auf Detailmodal umleiten.
4. [x] **Schritt 4: Tests schreiben & Verifikation**
   - Tests in `TransactionDetailModal.test.tsx` und `Transactions.test.tsx`.
   - `pnpm test`, `pnpm build`, `pnpm format:check`.

---

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Formatting sauber (`pnpm format:check`)
