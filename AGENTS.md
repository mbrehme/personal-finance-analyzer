# Agent Guidelines & Workflow Instructions

Willkommen im Projekt **Personal Finance Analyzer**. Diese Datei enthält verbindliche Verhaltensregeln, Architekturprinzipien und Entwicklungs-Workflows für alle Coding-Agenten in diesem Repository.

---

## 🧭 Entwicklungs-Workflow (Lifecycle)

Bei allen nicht-trivialen Aufgaben und neuen Features ist folgender Ablauf einzuhalten:

### 1. Vorbereitungs- & Planungsphase
1. **Architektur prüfen:** Vor Entwurfsentscheidungen bestehende ADRs in [`docs/architecture/`](docs/architecture/) sichten.
2. **Plan anlegen:** Für größere Features oder Refactorings einen Plan unter `docs/plans/active/YYYY-MM-DD-<feature-name>.md` nach der Vorlage [`docs/plans/template.md`](docs/plans/template.md) erstellen.

### 2. Implementierungsphase
* **Tech-Stack:** React 18, TypeScript (strikter Modus), Vite, Tailwind CSS.
* **Path-Alias:** Verwende für alle relativen Modulimporte den konfigurierten Alias `@/*` (z. B. `import { Button } from '@/components/Button'`).
* **Struktur:**
  - `src/components/`: Wiederverwendbare UI-Komponenten.
  - `src/pages/`: Routen- und Seitenansichten.
  - `src/services/`: Typisierter Daten- und API-Layer.
* **Dokumentation:** Schreibe für alle exportierten Komponenten, Hilfsfunktionen, Interfaces und Service-Methoden vollständige **JSDoc/TSDoc-Kommentare** (inkl. `@param`, `@returns`, `@example`).

### 3. Testing-Phase (Co-Location)
* Tests werden **immer als Co-Located Files** direkt neben der Quellcode-Datei abgelegt (`Button.test.tsx` neben `Button.tsx`, `api.test.ts` neben `api.ts`).
* Test-Stack: **`vitest`** mit **`happy-dom`** und **`@testing-library/react`**.
* Geteilte Matcher und Mocks liegen in `src/test/setup.ts`.

### 4. Commits & Releasing
* **Conventional Commits Pflicht:** Alle Commits müssen dem Conventional Commits Schema folgen (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, etc.).
* Git-Hooks (`husky`) prüfen Commit-Nachrichten automatisch über `commitlint`.
* Releases werden mit `pnpm release` (SemVer + Changelog-Generierung) verwaltet.

### 5. Abschluss & Archivierung
1. **Verifikation:** Stelle sicher, dass `pnpm test` und `pnpm build` ohne Fehler oder Warnungen durchlaufen.
2. **Plan archivieren:** Verschiebe die fertige Plandatei von `docs/plans/active/` nach `docs/plans/archive/`.
3. **ADR festhalten:** Wurde eine grundlegende Architekturentscheidung getroffen, dokumentiere sie als neues ADR unter `docs/architecture/XXXX-<thema>.md` nach [`docs/architecture/template.md`](docs/architecture/template.md).

---

## 🛠 Wichtige Terminal-Befehle

| Befehl | Zweck |
| :--- | :--- |
| `pnpm dev` | Startet den Vite Entwicklungsserver (`http://localhost:5173`) |
| `pnpm test` | Führt alle Tests einmalig aus |
| `pnpm test:watch` | Startet Vitest im interaktiven Watch-Modus |
| `pnpm build` | Führt den TypeScript-Check (`tsc`) und den Vite-Build aus |
| `pnpm commit` | Interaktiver Commit-Assistent (Conventional Commits) |
| `pnpm release` | Erstellt einen automatischen SemVer-Release inkl. `CHANGELOG.md` |
| `pnpm release:dry-run` | Vorschau der nächsten Version und Release Notes ohne Schreibzugriff |

