# Plan: Unterscheidung zwischen echten und virtuellen Konten

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-04
- **Abgeschlossen am:** 2026-09-04
- **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht

Bislang waren alle Konten (`Account`) gleichförmig aufgebaut und besaßen optional manuell zugewiesene Kategorien (`categoryIds`), aber keine IBAN oder Unterscheidung zwischen realen Bankkonten und Unterbudgets.
Künftig wird explizit zwischen zwei Kontenarten unterschieden:

1. **Echte Konten (`accountType: 'real'`):**
   - Repräsentieren reale Bankkonten (Girokonto, Tagesgeld, Sparkonto etc.).
   - Besitzen eine **IBAN** (`iban?: string`).
   - Können **keine manuellen Kategorien** haben (Kategorie-Zuordnung entfällt).
   - Zuordnung von Ein- und Ausgängen erfolgt über die **IBAN** und/oder die `accountId`.
   - Können Stichtags-Salden (`balanceEntries`) besitzen.
2. **Virtuelle Unterkonten (`accountType: 'virtual'`):**
   - Werden einem übergeordneten echten Konto zugeordnet (`parentAccountId: string`).
   - Besitzen keine eigene IBAN.
   - Werden über den **Filter-Picker** (Kategorien via `CategoryFilterDropdown`) mit Transaktionen verknüpft, die deren Saldo verändern.
   - Können ebenfalls Stichtags-Salden (`balanceEntries`) besitzen (z. B. Startguthaben für einen Urlaubstopf).

---

## 2. Anforderungen & User Stories

- [x] **Datenmodell (`src/types/finance.ts`):**
  - `AccountType = 'real' | 'virtual'` definieren.
  - `Account` um `accountType?: AccountType`, `iban?: string` und `parentAccountId?: string | null` erweitern.
  - Rückwärtskompatibilität: Bestehende Konten ohne `accountType` werden als `'real'` interpretiert.
- [x] **Konto-Dialog (`src/components/modals/AccountModal.tsx`):**
  - Umschaltung der Kontoart per Karte/Tab: **Echtes Bankkonto** vs. **Virtuelles Unterkonto**.
  - **Echtes Konto:**
    - IBAN-Eingabefeld mit automatischer Formatierung/Bereinigung.
    - Kategorie-Zuweisungsbereich wird ausgeblendet (Hinweis: Transaktionen werden über IBAN zugeordnet).
    - Stichtags-Salden erfassen.
  - **Virtuelles Unterkonto:**
    - Auswahl des übergeordneten echten Kontos (`parentAccountId`).
    - Filter-Picker: Hierarchischer `CategoryFilterDropdown` zur Auswahl der relevanten Kategorien.
    - Stichtags-Salden erfassen.
- [x] **Konten-Konfiguration (`src/pages/configuration/AccountsConfig.tsx`):**
  - Hierarchische Gliederung: Echte Konten als Hauptzeilen mit IBAN-Badge, darunter eingerückt die zugehörigen virtuellen Unterkonten mit ihren Filter-Kategorien.
  - Drag-and-Drop zur Umsortierung innerhalb der Hierarchie.
- [x] **Transaktions- & CSV-Zuordnung:**
  - `CsvImportModal.tsx`:
    - Erkennt anhand der IBAN in der CSV-Datei automatisch das passende echte Konto.
    - Im Konten-Auswahldialog werden für den physischen Bankimport primär die echten Konten angeboten.
  - `TransactionModal.tsx`:
    - Bei der manuellen Buchungserfassung wird primär das echte Bankkonto gewählt.
- [x] **Salden-Berechnung (`src/services/analytics/balanceCalculator.ts`):**
  - Echtes Konto: Saldo aus Stichtagen + alle Transaktionen auf diesem echten Konto (`t.accountId === account.id || (account.iban && normalizeIban(t.iban) === normalizeIban(account.iban))`).
  - Virtuelles Unterkonto: Saldo aus Stichtagen + Transaktionen des übergeordneten echten Kontos, die einer der Filter-Kategorien angehören.
  - Gesamtsaldo (`totalRow`): Berücksichtigt nur echte Konten zur Vermeidung von Doppelzählungen (virtuelle Konten sind Sub-Allokationen des echten Geldes).
- [x] **Salden-Ansicht (`src/pages/Balances.tsx`):**
  - Zeigt echte Konten und ihre virtuellen Unterkonten strukturiert und visuell differenziert an.

---

## 3. Technische Konzeption & Betroffene Komponenten

### [Datenmodell & Types]

- **`src/types/finance.ts`**:
  - `AccountType` hinzufügen.
  - `Account` erweitern um:
    ```ts
    accountType?: 'real' | 'virtual';
    iban?: string;
    parentAccountId?: string | null;
    ```
  - Hilfsfunktion `normalizeIban(iban?: string): string`.

### [Services & Storage]

- **`src/services/storage/FinanceContext.tsx` & `db.ts`**:
  - Sicherstellen, dass `accountType`, `iban` und `parentAccountId` persistent gespeichert, exportiert und importiert werden.
  - Defaulting für Altdaten.
- **`src/services/analytics/balanceCalculator.ts`**:
  - `calculateBalanceTimeline` erweitern:
    - Bei `account.accountType === 'virtual'`:
      Filtert Transaktionen nach `parentAccountId` und `account.categoryIds`.
    - Bei `account.accountType === 'real'` (oder Default):
      Filtert Transaktionen nach `accountId` oder IBAN-Gleichheit.
  - `calculateAllBalances`:
    - `totalRow` summiert nur reale Konten, um Doppelzählung zu verhindern.

### [UI-Komponenten]

- **`src/components/modals/AccountModal.tsx`**:
  - Neuer Typ-Selektor (Radio/Tabs): „Echtes Bankkonto“ vs. „Virtuelles Unterkonto“.
  - Bedingtes Rendering:
    - `real`: IBAN-Feld anzeigen, keine Kategorien.
    - `virtual`: Elternkonto-Select anzeigen, `CategoryFilterDropdown` zur Kategorie-Auswahl.
    - Beide: Stichtags-Salden Editor.
- **`src/pages/configuration/AccountsConfig.tsx`**:
  - Gruppierte Darstellung: Echte Konten mit IBAN-Badge, darunter geschachtelt virtuelle Unterkonten.
- **`src/components/modals/CsvImportModal.tsx`**:
  - Automatisches Vorbelegen des Zielkontos, wenn die CSV-IBAN mit einem echten Konto übereinstimmt.
- **`src/pages/Balances.tsx`**:
  - Gliederung der Salden-Tabelle mit Kennzeichnung virtueller Konten.

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Typen & Hilfsfunktionen (`finance.ts`)**
   - `AccountType`, `Account`-Felder und IBAN-Normalisierung definieren.
2. [x] **Schritt 2: Berechnungs-Engine anpassen (`balanceCalculator.ts`)**
   - Transaktionsfilterung für echte Konten vs. virtuelle Unterkonten implementieren.
   - Unit-Tests in `balanceCalculator.test.ts` schreiben.
3. [x] **Schritt 3: Konto-Modal anpassen (`AccountModal.tsx`)**
   - Umschaltung Real/Virtual, IBAN-Feld, Elternkonto-Auswahl, `CategoryFilterDropdown` integrieren.
   - Unit-Tests in `AccountModal.test.tsx` ergänzen.
4. [x] **Schritt 4: Konten-Konfiguration (`AccountsConfig.tsx`)**
   - Hierarchische Anzeige echter Konten und deren virtuellen Unterkonten.
5. [x] **Schritt 5: CSV-Import & Salden-Ansicht (`CsvImportModal.tsx`, `Balances.tsx`)**
   - Auto-Matching von IBAN beim Import und hierarchische Anzeige in der Saldenübersicht.
6. [x] **Schritt 6: Tests & Verifikation**
   - Alle Tests durchführen (`pnpm test`), Formatierung (`pnpm format:check`), Build (`pnpm build`).

---

## 5. Verifikationsplan

### Automatisierte Tests

- `pnpm test` (alle Unit- und Integrationstests)
- `pnpm build` (TypeScript-Prüfung und Production-Build)
- `pnpm format:check`

### Manuelle Tests

- Erstellen eines echten Kontos mit IBAN und Stichtagssaldo.
- Erstellen eines virtuellen Unterkontos mit Elternkonto, ausgewählten Filter-Kategorien und Stichtagssaldo.
- Prüfung der Saldenberechnung in der Salden-Matrix (`/balances`).
