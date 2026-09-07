# Plan: Korrektur der Salden- und Cashflow-Berechnung für Unterkonten bei internen Umbuchungen

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-07
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Korrektur der Berechnung der effektiven Beträge (`getTransactionEffectiveValueForAccount`) in `src/domain/modules/accounts/accountService.ts`. Zahlungen vom übergeordneten Rücklagenkonto auf das Hauptkonto wurden für Unterkonten des Rücklagenkontos fälschlicherweise als positiver Cashflow gewertet. Zudem wird die Gegenbuchungs-Prüfung bei gerichteten Buchungen gegen Doppelzählungen harmonisiert und die Freitextsuche in `Transactions.tsx` um Betragssuche erweitert.

## 2. Anforderungen & User Stories

- [x] Für virtuelle Unterkonten richtet sich das Vorzeichen des effektiven Betrags bei gerichteten Buchungen danach, ob das übergeordnete Konto Absender (`-amount`) oder Empfänger (`+amount`) ist.
- [x] Direkte Adressierung von Unterkonto-IDs als `senderIban` oder `receiverIban` wird korrekt mit `-amount` bzw. `+amount` berücksichtigt.
- [x] Bei Vorliegen beider Gegenstücke einer internen Umbuchung in `allTransactions` wird die Gegenbuchung für Unterkonten und Hauptkonten dedupliziert, um Doppelzählungen zu verhindern.
- [x] Freitextsuche in `Transactions.tsx` erlaubt die Suche nach formatierten und unformatierten Beträgen.
- [x] Alle bestehenden und neuen Tests laufen fehlerfrei durch.

## 3. Technische Konzeption & Betroffene Komponenten

- **Domain & State (`src/domain/`):**
  - `src/domain/modules/accounts/accountService.ts`: Überarbeitung von `getTransactionEffectiveValueForAccount` und `hasDirectCounterpart`.
  - `src/domain/modules/accounts/accountService.test.ts`: Neue Testfälle für gerichteten Cashflow von Unterkonten und Deduplizierung.
  - `src/types/finance.test.ts`: Anpassung/Ergänzung der Integrations-Tests für `getTransactionEffectiveValueForAccount`.
- **UI & Pages (`src/ui/`):**
  - `src/ui/pages/Transactions.tsx`: Betragssuche in `filteredTransactions`, Übergabe von `transactions` statt `displayedTransactions` an `getTransactionEffectiveValueForAccount`.
  - `src/ui/pages/Transactions.test.tsx`: Test für Betragssuche.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Implementierung der gerichteten Logik in `accountService.ts`**
   - Datei: `src/domain/modules/accounts/accountService.ts`
2. [x] **Schritt 2: Unit-Tests für `accountService.ts` und `finance.test.ts`**
   - Dateien: `src/domain/modules/accounts/accountService.test.ts`, `src/types/finance.test.ts`
3. [x] **Schritt 3: Betragssuche in `Transactions.tsx` & Test**
   - Dateien: `src/ui/pages/Transactions.tsx`, `src/ui/pages/Transactions.test.tsx`
4. [x] **Schritt 4: Verifikation & Regressionstests**
   - `pnpm test` und `pnpm build`

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Plan archivieren
