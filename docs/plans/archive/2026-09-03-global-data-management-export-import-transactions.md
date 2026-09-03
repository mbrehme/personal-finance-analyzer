# Plan: Globales Datenmanagement (Export, Import, Reset) im Header & Transaktions-Export/Import

- **Status:** Abgeschlossen
- **Erstellt am:** 2026-09-03
- **Abgeschlossen am:** 2026-09-03
- **Bearbeiter:** Antigravity & Entwickler-Team

---

## 1. Ziel & Übersicht

Export, Import und Workspace-Reset wurden aus der Konfigurationsseite in den globalen Anwendungs-Header verlagert (hinter einem kompakten Datenverwaltungs-Dropdown).
Zudem wurde sowohl für den **Export** als auch für das **Zurücksetzen (Reset)** ein modularer Dialog bereitgestellt:

- **Export-Dialog (`ExportModal.tsx`):** Standardmäßig ist alles vorausgewählt. Exportiert Konten, Kategorien, manuelle Overrides & Buchungen, alle Transaktionen und den Papierkorb.
- **Reset-Dialog (`ResetModal.tsx`):** Ermöglicht das gezielte Zurücksetzen einzelner Bereiche (z. B. nur Kategorien auf Standardkategorien zurücksetzen, oder nur Buchungen löschen, oder Konten zurücksetzen).
- **Transaktions-Export & -Import:** Vollständige Unterstützung von Transaktionen im JSON-Format für lückenlose Backups und Gerätewechsel.

---

## 2. Anforderungen & User Stories

- [x] **Globales Header-Menü (`Header.tsx`):**
  - Kompaktes Menü „Daten“ / `Database` Icon neben dem Reprogress-Button.
  - Aktionen:
    - 📤 **Daten exportieren...** -> öffnet den Export-Dialog.
    - 📥 **Daten importieren...** -> wählt eine JSON-Datei aus und importiert sie.
    - 🔄 **Daten zurücksetzen...** -> öffnet den neuen Reset-Dialog mit Bereichsauswahl.
- [x] **Modularer Export-Dialog (`ExportModal.tsx`):**
  - Standardmäßig sind **alle Optionen aktiviert**.
  - Checkboxen:
    - 🏦 **Konten** (inkl. Saldenverläufen)
    - 🏷️ **Kategorien** (inkl. Hierarchie, Regex-Muster, Soll-Budgets)
    - ✏️ **Manuelle Overrides & manuelle Buchungen** (z. B. manuelle Zuweisungen, Notizen, Splits)
    - 💳 **Alle Buchungen / Transaktionen** (gesamter Bank-Buchungsbestand)
    - 🗑️ **Gelöschte Buchungen** (Papierkorb)
  - Schnellauswahl: „Alles auswählen“, „Nur Konfiguration“.
  - Zeigt Live-Zähler der vorhandenen Datensätze an.
- [x] **Modularer Reset-Dialog (`ResetModal.tsx`):**
  - Standardmäßig sind alle Optionen ausgewählt (oder Schnellauswahl).
  - Checkboxen:
    - 🏷️ **Kategorien zurücksetzen:** Setzt Kategorien auf Standard-Seed-Kategorien zurück (Buchungen und Konten bleiben erhalten).
    - 🏦 **Konten zurücksetzen:** Setzt Konten auf Standard-Konto zurück.
    - 💳 **Buchungen / Transaktionen löschen:** Leert den gesamten Transaktions-Store.
    - 🗑️ **Papierkorb leeren:** Leert gelöschte Transaktionen.
  - Warnhinweis und Bestätigungs-Button ("Ausgewählte Bereiche zurücksetzen").
- [x] **Erweiterung von Storage & Context (`db.ts`, `FinanceContext.tsx`):**
  - `exportConfiguration(options: ExportOptions)`: Unterstützt selektives Einbetten von `accounts`, `categories`, `manualTransactions`, `transactions`, `deletedTransactions`.
  - `importConfiguration(data: FinanceConfigExport)`: Erkennt und importiert auch vollständige `transactions`.
  - `resetWorkspace(options?: ResetOptions)`: Setzt nur die übergebenen Teilbereiche selektiv zurück.
- [x] **Bereinigung von `ConfigurationLayout.tsx`:**
  - Redundante Buttons entfernt, zentrale Erreichbarkeit im Header sichergestellt.

---

## 3. Technische Konzeption & Typen

```ts
export interface ExportOptions {
  includeAccounts: boolean;
  includeCategories: boolean;
  includeManualTransactions: boolean;
  includeTransactions: boolean;
  includeDeletedTransactions: boolean;
}

export interface ResetOptions {
  resetAccounts?: boolean;
  resetCategories?: boolean;
  resetTransactions?: boolean;
  resetDeletedTransactions?: boolean;
}

export interface FinanceConfigExport {
  version: number;
  exportedAt: string;
  accounts?: Account[];
  categories?: Category[];
  buckets?: Category[];
  manualTransactions?: Transaction[];
  transactions?: Transaction[];
  deletedTransactions?: Transaction[];
}
```

---

## 4. Schrittweiser Umsetzungsplan

1. [x] **Schritt 1: Datenmodell & Storage Layer erweitern**
   - `src/types/finance.ts`: `ExportOptions`, `ResetOptions` und `FinanceConfigExport`.
   - `src/services/storage/db.ts`: Granulares `exportConfiguration` und Einspielen von `transactions` bei `importConfiguration`.
   - `src/services/storage/FinanceContext.tsx`: Selektives `resetWorkspace(options)` und erweiterter Export/Import.
2. [x] **Schritt 2: `ExportModal.tsx` erstellen**
   - Alle Checkboxen standardmäßig aktiv, Zähleranzeige, Download-Trigger.
3. [x] **Schritt 3: `ResetModal.tsx` erstellen**
   - Granulare Auswahl der zurückzusetzenden Bereiche mit visueller Warnung.
4. [x] **Schritt 4: Header-Menü (`Header.tsx`) integrieren**
   - Dropdown mit Export, Import und Reset.
   - Entfernen redundanter Buttons in `ConfigurationLayout.tsx`.
5. [x] **Schritt 5: Tests schreiben & vollständige Verifikation**
   - Unit-Tests für `ExportModal.test.tsx`, `ResetModal.test.tsx`, `Header.test.tsx`, `db.test.ts`, `FinanceContext.test.tsx`.
   - `pnpm test`, `pnpm format:check` und `pnpm build`.

---

## 5. Verifikationsplan

- [x] Unit-Tests erfolgreich (`pnpm test` - 157 Tests bestanden)
- [x] TypeScript Check & Build erfolgreich (`pnpm build`)
- [x] Formatierung (`pnpm format:check`)
