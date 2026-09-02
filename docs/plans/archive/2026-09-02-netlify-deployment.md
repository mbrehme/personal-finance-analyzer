# Plan: Netlify Deployment Pipeline & Multi-Environment Setup

* **Status:** Abgeschlossen
* **Erstellt am:** 2026-09-02
* **Bearbeiter:** Antigravity

---

## 1. Ziel & Übersicht
Bereitstellung einer automatisierten Netlify Deployment-Pipeline für das Projekt **Personal Finance Analyzer**.
Es sollen separate Umgebungen für:
- **`main`** (Production)
- **`stage`** (Staging / Vorabprüfung)
- **Pull Requests** (Automatisierte Deploy Previews für jeden PR)
konfiguriert werden, inklusive SPA-Routing (200 Rewrite auf `/index.html`), Sicherheits- und Caching-Headern sowie einer optischen Kennzeichnung von Non-Production-Umgebungen in der App.

## 2. Anforderungen & User Stories
- [ ] `netlify.toml` mit Standard-Build-Befehlen (`pnpm build`), Node 20 & PNPM 9.
- [ ] SPA Rewrite-Regel (`/*` -> `/index.html 200`) für React-Router.
- [ ] Kontext-Konfiguration für `production`, `stage`, `deploy-preview` und `branch-deploy` mit `VITE_APP_ENV`.
- [ ] Fallback `public/_redirects` für zuverlässiges Client-Side-Routing.
- [ ] Typisierung von `VITE_APP_ENV` in `src/vite-env.d.ts`.
- [ ] Optionale dezente Anzeige des Umgebungs-Status (z. B. "Stage", "Preview") im Header bei Non-Production.
- [ ] Architekturdokumentation (ADR-0002).

## 3. Technische Konzeption & Betroffene Komponenten
* **Konfigurationsdateien:**
  - `netlify.toml` (Build-, Redirect- und Header-Konfiguration für Netlify)
  - `public/_redirects` (Vite statisches Asset für SPA-Fallback)
* **Typing & UI:**
  - `src/vite-env.d.ts` (Typdefinition für `VITE_APP_ENV`)
  - `src/components/Header.tsx` & `src/components/Header.test.tsx` (Umgebungsanzeige bei Stage/Preview)
* **Dokumentation:**
  - `docs/architecture/0002-netlify-deployment-pipeline.md`

## 4. Schrittweiser Umsetzungsplan
1. [ ] **Schritt 1: `netlify.toml` und `public/_redirects` erstellen**
2. [ ] **Schritt 2: `src/vite-env.d.ts` und `Header.tsx` anpassen**
3. [ ] **Schritt 3: Tests erweitern & Build verifizieren**
4. [ ] **Schritt 4: ADR erstellen & Plan archivieren**

## 5. Verifikationsplan
- [ ] Unit-Tests erfolgreich (`pnpm test`)
- [ ] TypeScript Check & Build erfolgreich (`pnpm build`)
- [ ] Überprüfung der erzeugten Artefakte in `dist/`
