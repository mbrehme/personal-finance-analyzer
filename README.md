# Personal Finance Analyzer – Frontend

Ein schlankes, modulares und typensicheres Frontend-Projekt zur Analyse von Einnahmen, Ausgaben und Sparzielen. Aufgesetzt mit **React**, **TypeScript**, **Vite** und **Tailwind CSS**.

---

## 🚀 Schnellstart

### 1. Abhängigkeiten installieren
```bash
pnpm install
```

### 2. Entwicklungsserver starten
```bash
pnpm dev
```
Das Projekt öffnet standardmäßig unter [http://localhost:5173](http://localhost:5173).

### 3. Tests ausführen
```bash
pnpm test          # Einmaliger Testlauf (wird auch im Pre-Commit Hook ausgeführt)
pnpm test:watch    # Interaktiver Watch-Modus
```

### 4. Production Build & TypeScript Check
```bash
pnpm build
```

### 5. Build-Vorschau starten
```bash
pnpm preview
```

---

## 🛠 Tech-Stack

- **Framework:** [React 18](https://react.dev/) mit [TypeScript](https://www.typescriptlang.org/)
- **Build-Tool:** [Vite](https://vite.dev/)
- **Paketmanager:** [pnpm](https://pnpm.io/)
- **Routing:** [react-router-dom](https://reactrouter.com/) (Client-Side Routing)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (inkl. PostCSS & Autoprefixer)
- **Icons:** [lucide-react](https://lucide.dev/)
- **Testing:** [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/) & [happy-dom](https://github.com/capricorn86/happy-dom)
- **Git Hooks & Linting:** [Husky](https://typicode.github.io/husky/) & [Commitlint](https://commitlint.js.org/)
- **Versionierung & Changelog:** [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version)

---

## 📁 Projektstruktur

```text
personal-finance-analyzer/
├── .github/
│   └── workflows/
│       └── release.yml        # Automatische GitHub Releases bei Tag-Pushes
├── .husky/
│   ├── commit-msg             # Validiert Commit-Messages gegen Conventional Commits
│   └── pre-commit             # Führt 'pnpm test' vor jedem Commit aus
├── docs/                      # Architekturentscheidungen (ADRs) & Feature-Pläne
│   ├── architecture/          # Langfristige Architekturentscheidungen (ADRs)
│   └── plans/                 # Konkrete Feature-Pläne (active/ & archive/)
├── public/                    # Statische Assets
├── src/
│   ├── components/            # Wiederverwendbare UI-Komponenten
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx    # Co-located Unit-Test
│   │   └── Header.tsx
│   ├── pages/                 # Seitenkomponenten (Home, Dashboard)
│   │   ├── Home.tsx
│   │   └── Dashboard.tsx
│   ├── services/              # API- & Fetch-Funktionen
│   │   ├── api.ts
│   │   └── api.test.ts        # Co-located Service-Test
│   ├── test/                  # Globale Test-Konfiguration & Mocks
│   │   └── setup.ts           # Vitest DOM-Setup (jest-dom Matchers)
│   ├── App.tsx                # Haupt-App mit Layout & Routen
│   ├── main.tsx               # React Entry Point
│   ├── index.css              # Tailwind CSS Direktiven
│   └── vite-env.d.ts          # Vite TypeScript Deklarationen
├── .versionrc.json            # Konfiguration für Changelog & Release-Kategorien
├── AGENTS.md                  # Anweisungen & Entwicklungs-Workflow für AI-Coding-Agenten
├── commitlint.config.js       # Conventional Commits Linter-Regeln
├── index.html                 # HTML Entry Point
├── package.json               # Abhängigkeiten und NPM Scripts
├── postcss.config.js          # PostCSS Konfiguration
├── tailwind.config.js         # Tailwind CSS Konfiguration
├── tsconfig.json              # TypeScript Konfiguration inkl. Path-Alias
└── vite.config.ts             # Vite & Vitest Konfiguration inkl. Path-Alias (@/*)
```

---

## ⚡ Path Alias `@/*`

Der Alias `@/*` verweist direkt auf das Verzeichnis `src/` (konfiguriert in `tsconfig.json` und `vite.config.ts`).

**Beispiel:**
```tsx
import { Button } from '@/components/Button';
import { financeService } from '@/services/api';
```

---

## 📚 Architektur & Feature-Planung (`docs/`)

Das Repository verwaltet Architekturentscheidungen und künftige Feature-Planungen strukturiert im Ordner `docs/`:

* **`docs/architecture/`**: Dokumentiert langfristige Entscheidungen als **ADRs** (Architecture Decision Records) mit [Vorlage](docs/architecture/template.md) und Historie (z. B. `0001-frontend-architecture-and-stack.md`).
* **`docs/plans/active/`**: Aktuelle Feature-Pläne, die gerade vom Agenten / Entwickler umgesetzt werden.
* **`docs/plans/archive/`**: Erfolgreich umgesetzte und archivierte Feature-Pläne.

---

## 🧪 Testing & Test-Struktur

### Test-Philosophie (Co-Location)
Tests liegen als **Co-Located Files** direkt neben den dazugehörigen Quellcode-Dateien (z. B. `Button.test.tsx` neben `Button.tsx`).

* **Vorteil:** Beim Verschieben, Umbenennen oder Löschen von Komponenten bleiben Code und Tests stets synchron.
* **Globales Setup:** Geteilte Mocks und Matcher-Initialisierungen liegen zentral unter `src/test/setup.ts`.

### Was ist `happy-dom`?
Anstelle des schwereren `jsdom` nutzt das Projekt **`happy-dom`**. Es emuliert die Browser-DOM-APIs (`window`, `document`, Events) direkt in Node.js, ist **2–3x schneller**, verbraucht minimalen Speicher und ist für moderne ESM-Module optimiert.

### Test-Befehle:
```bash
# Alle Tests einmalig ausführen:
pnpm test

# Tests im interaktiven Watch-Modus ausführen:
pnpm test:watch
```

---

## 📝 Conventional Commits & Git Hooks

Das Projekt erzwingt über **Husky** und **Commitlint** das [Conventional Commits Format](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Gültige Commit-Typen:
- `feat:` Neues Feature (erhöht **MINOR** Version, z. B. `0.1.0` ➔ `0.2.0`)
- `fix:` Bugfix / Fehlerbehebung (erhöht **PATCH** Version, z. B. `0.1.0` ➔ `0.1.1`)
- `BREAKING CHANGE:` im Footer oder `!` nach dem Typ erhöht **MAJOR** Version (`1.0.0`)
- `docs:` Dokumentationsänderungen
- `refactor:` Code-Refactoring ohne Verhaltensänderung
- `perf:` Performance-Optimierungen
- `test:` Hinzufügen / Anpassen von Tests
- `build:` Build-System oder externe Abhängigkeiten
- `ci:` CI/CD-Pipelines
- `chore:` Allgemeine Hilfsaufgaben

### Interaktiver Commit-Assistent:
```bash
pnpm commit
```

---

## 🏷 Automatisches Semantic Versioning & Release Notes

Mit `commit-and-tag-version` werden Versionen nach [SemVer](https://semver.org/) automatisch berechnet, ein `CHANGELOG.md` mit Release Notes generiert und Git-Tags gesetzt.

### Release erstellen:
```bash
# Automatische Erkennung (Patch/Minor/Major basierend auf Commits seit letztem Release):
pnpm release

# Oder explizit:
pnpm release:patch   # z.B. 0.1.0 -> 0.1.1
pnpm release:minor   # z.B. 0.1.0 -> 0.2.0
pnpm release:major   # z.B. 0.1.0 -> 1.0.0

# Trockenlauf (Vorschau ohne Dateiänderungen):
pnpm release:dry-run
```

### Was `pnpm release` automatisch erledigt:
1. Version in `package.json` nach SemVer erhöhen.
2. `CHANGELOG.md` mit gruppierten Release Notes (Features, Fixes, Breaking Changes, etc.) erstellen bzw. erweitern.
3. Commit für den Release erzeugen.
4. Git-Tag (z. B. `v0.2.0`) erstellen.

Nach dem Release können die Änderungen und Tags übertragen werden:
```bash
git push --follow-tags origin main
```
(Ein GitHub Actions Workflow in `.github/workflows/release.yml` erstellt bei Tag-Pushes automatisch auch ein entsprechendes GitHub Release.)
