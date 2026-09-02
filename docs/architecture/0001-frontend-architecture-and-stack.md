# ADR-0001: Frontend-Technologiestack und Basisarchitektur

* **Status:** Akzeptiert
* **Datum:** 2026-09-02
* **Autor(en):** Antigravity & Entwickler-Team
* **Entscheider:** Projektleitung

---

## 1. Kontext & Problemstellung
Für das Projekt *Personal Finance Analyzer* wird eine schlanke, moderne und typensichere Frontend-Architektur benötigt. Das Projekt soll ohne Monorepo-Komplexität, ohne Backend-Abhängigkeit und mit direktem Entwicklungsfokus aufgerollt werden.

## 2. Betrachtete Optionen / Alternativen
* **Option A: React + Vite + TypeScript + Tailwind CSS (Ausgewählt)**
  - Maximale Performance, blitzschnelle HMR-Entwicklungszyklen, vollständige Typensicherheit.
* **Option B: Next.js (Fullstack / SSR)**
  - Höhere Komplexität, Serverkomponenten und Backend-Laufzeit nicht zwingend erforderlich für ein reines Client-Dashboard.
* **Option C: Create React App (CRA)**
  - Veraltet, langsame Builds und keine zeitgemäße ESM-Unterstützung.

## 3. Getroffene Entscheidung
Es wurde **Option A** gewählt mit folgenden Kernbausteinen:
1. **Framework & Tooling:** React 18, TypeScript, Vite, pnpm.
2. **Routing:** `react-router-dom` für Standard-Client-Side-Routing.
3. **Styling:** `tailwindcss` mit PostCSS und Autoprefixer.
4. **Icons:** `lucide-react`.
5. **Path Alias:** `@/*` verweist direkt auf `src/`.
6. **Testing:** `vitest` mit `@testing-library/react` und `happy-dom` (Co-Location-Muster).
7. **Release & Commits:** Conventional Commits (Commitlint + Husky) und automatische Release Notes (`commit-and-tag-version`).

## 4. Konsequenzen & Auswirkungen
* **Positiv:**
  - Extrem schnelle Entwicklungs- und Buildzeiten.
  - Hohe Code-Qualität durch TypeScript und automatisierte Pre-Commit Hooks.
  - Saubere Release-Zyklen nach Semantic Versioning.
* **Negativ / Risiken:**
  - Keine serverseitige Vorberechnung (SSR) – für die vorliegende Dashboard-Anwendung jedoch irrelevant.

