# Plan: Umstellung auf einheitliches Wertstellungsdatum (Valuta)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Bearbeiter:** Antigravity Agent

---

## 1. Ziel & Übersicht

Vereinfachung des Transaktionsmodells von zwei Datumsfeldern (\`valueDate\` und \`bookingDate\`) auf ein einziges Feld \`date\`, welches explizit das **Wertstellungsdatum (Valutadatum)** darstellt. Auch beim CSV-Import wird gezielt nach dem Wertstellungsdatum gefragt und dieses vorausgewählt.

## 2. Anforderungen & User Stories

- [x] Transaktions-Modell besitzt \`date: ISODateString\` (Wertstellungsdatum) und ein optionales \`originalDate?: ISODateString\`.
- [x] JSDoc-Dokumentation beschreibt explizit, dass \`date\` das Wertstellungsdatum (Valuta) ist.
- [x] CSV-Import bietet ein Dropdown für das "Wertstellungsdatum (Valuta)" und auto-erkennt Spalten mit Valuta/Wertstellung/Datum priorisiert.
- [x] Detail- & Edit-Dialoge sowie Tabellen zeigen einheitlich das "Wertstellungsdatum" an und bearbeiten \`date\`.
- [x] Alle Analysen und Berechnungen (Salden, Cashflow, Monatsfilter) basieren auf \`date\`.
- [x] Sämtliche Tests und Beispieldaten sind aktualisiert.

## 3. Technische Konzeption & Betroffene Komponenten

- **Typen (\`src/types/finance.ts\`):**
  - \`Transaction.date\`, \`Transaction.originalDate\`.
  - Anpassung von \`isTransactionOverridden\`, \`resetTransactionToOriginal\`, \`buildCompoundSearchField\`, \`sortTransactionsDesc\`.
- **CSV-Import (\`src/services/csv/csvParser.ts\`, \`src/components/modals/CsvImportModal.tsx\`):**
  - \`CsvColumnMapping.dateColumn\`.
  - Erkennungs-Regex in \`guessColumnMapping\` mit Valuta/Wertstellung-Priorität.
  - Dropdown "Wertstellungsdatum (Valuta)" im Import-Modal.
- **UI-Komponenten (\`src/components/modals/TransactionDetailModal.tsx\`, \`TransactionModal.tsx\`):**
  - Nur ein Datumsfeld für Wertstellungsdatum (Valuta) bei Ansicht, Bearbeitung und Reset.
- **Seiten (\`src/pages/Transactions.tsx\`, \`Dashboard.tsx\`, \`Balances.tsx\`, \`Cashflow.tsx\`):**
  - Tabellenspalte "Wertstellungsdatum", Filter und Sortierung nutzen \`tx.date\`.
- **Services (\`src/services/analytics/\`):**
  - \`balanceCalculator.ts\`, \`cashflowCalculator.ts\`.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Vorbereitung & Typdefinitionen**
   - Datei: \`src/types/finance.ts\`
2. [x] **Schritt 2: Implementierung der Services & CSV-Logik**
   - Datei: \`src/services/csv/csvParser.ts\`
   - Datei: \`src/services/analytics/balanceCalculator.ts\`
   - Datei: \`src/services/analytics/cashflowCalculator.ts\`
3. [x] **Schritt 3: UI-Komponenten & Seiten anpassen**
   - Datei: \`src/components/modals/CsvImportModal.tsx\`
   - Datei: \`src/components/modals/TransactionDetailModal.tsx\`
   - Datei: \`src/components/modals/TransactionModal.tsx\`
   - Datei: \`src/pages/Transactions.tsx\`
   - Datei: \`src/pages/Dashboard.tsx\`
   - Datei: \`src/pages/Balances.tsx\`
   - Datei: \`src/pages/Cashflow.tsx\`
4. [x] **Schritt 4: Seeds & Tests aktualisieren**
   - Datei: \`src/data/seedTransactions.ts\`
   - Test-Dateien
5. [x] **Schritt 5: Verifikation**
   - \`pnpm test\`, \`pnpm build\`, \`pnpm format:check\`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (\`pnpm test\`: 200 Tests in 36 Suites bestanden)
- [x] TypeScript Check & Build erfolgreich (\`pnpm build\` fehlerfrei)
- [x] Prettier Formatierung geprüft (\`pnpm format:check\` sauber)
