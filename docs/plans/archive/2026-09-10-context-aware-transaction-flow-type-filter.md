# Plan: Kontextsensitive Transaktionstyp-Filterung (Variante 1)

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-10
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Verbesserung der Transaktionstyp-Filterung auf der Buchungsseite (`/transactions`):
Statt eines starren Vorzeichen-Matchings (`tx.value >= 0`) wird der Filter um **„Umbuchungen“** (`TransactionFlowType = 'inbound' | 'outbound' | 'transfer'`) erweitert und berücksichtigt dynamisch die **Kontoperspektive**:

- Aus Sicht eines konkreten Kontos (z. B. _Rücklagen_) gilt eine eingehende Umbuchung als Zufluss (`+`), eine ausgehende als Abfluss (`-`).
- In der Gesamtsicht (_Alle Konten_) gelten Umbuchungen als neutrale interne Transfers und werden nicht mehr fälschlicherweise als externe Einnahmen oder Ausgaben geführt.

## 2. Anforderungen & User Stories

- [x] **A1 (Typen):** `TransactionFlowType = 'inbound' | 'outbound' | 'transfer'` wird in `TransactionFiltersState` und URL-Parametern unterstützt.
- [x] **A2 (Domain-Logik):** Neue Funktion `matchesTransactionFlowType` prüft Buchungen präzise abhängig von `selectedAccount` und Gesamtperspektive.
- [x] **A3 (UI-Anpassung):** Dropdown auf `/transactions` bietet dynamische Optionen (`Einnahmen/Ausgaben (extern)` bei allen Konten vs. `Geldeingänge/Geldabgänge` bei Einzelkonto) sowie `Umbuchungen (⇄)`.
- [x] **A4 (URL & Deep Links):** URL-Parameter `type=transfer`, `type=inbound`, `type=outbound` werden sauber geparst und synchronisiert.
- [x] **A5 (Testing):** Vollständige Testabdeckung für die neue Domain-Funktion und die UI-Filterung.

## 3. Technische Konzeption & Betroffene Komponenten

- **Typen (`src/types/`):**
  - `src/types/transaction.types.ts`: `TransactionFlowType` exportieren und verwenden.
- **Domain & State (`src/domain/`):**
  - `src/domain/modules/accounts/accountService.ts`: `matchesTransactionFlowType` implementieren.
- **UI & Pages (`src/ui/`):**
  - `src/ui/pages/Transactions.tsx`: `TransactionFiltersState` aktualisieren, Dropdown anpassen und Filter anbinden.

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Domain-Logik & Service-Funktion**
   - `matchesTransactionFlowType` in `accountService.ts` erstellen & exportieren.
   - Tests in `accountService.test.ts` schreiben.
2. [x] **Schritt 2: Integration in Transactions-Page & Filter-State**
   - `TransactionFiltersState.type` auf `TransactionFlowType | 'all'` anpassen.
   - `parseTransactionFiltersFromParams` und `serializeTransactionFiltersToParams` anpassen.
   - Filterfunktion in `filteredTransactions` auf `matchesTransactionFlowType` umstellen.
   - UI-Dropdown in `Transactions.tsx` dynamisch rendern.
3. [x] **Schritt 3: Testing & Verifikation**
   - Tests in `Transactions.test.tsx` erweitern.
   - `pnpm test`, `pnpm build`, `pnpm format:check` ausführen.
4. [x] **Schritt 4: Dokumentation & Archivierung**
   - Plan nach `docs/plans/archive/` verschieben.

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test`)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Format-Check erfolgreich (`pnpm format:check`)
