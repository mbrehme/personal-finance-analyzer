# ADR-0002: Netlify Deployment Pipeline und Multi-Environment Konfiguration

* **Status:** Akzeptiert
* **Datum:** 2026-09-02
* **Autor(en):** Antigravity & Entwickler-Team
* **Entscheider:** Projektleitung

---

## 1. Kontext & Problemstellung
Für den *Personal Finance Analyzer* wird eine automatisierte Continuous Deployment Pipeline benötigt. Anforderungen sind:
- Getrennte Umgebungen für **`main`** (Produktion) und **`stage`** (Staging).
- Automatische Deploy Previews für jeden **Pull Request**, um Änderungen isoliert vor dem Merge testen zu können.
- Zuverlässiges Client-Side-Routing (SPA Rewrite).
- Optimierte Sicherheits- und Caching-Header für statische Assets.

## 2. Betrachtete Optionen / Alternativen
* **Option A: Netlify mit deklarativer `netlify.toml` (Ausgewählt)**
  - Native Unterstützung für Context-spezifische Deployments (`[context.production]`, `[context.stage]`, `[context.deploy-preview]`).
  - Automatische PR-Previews ohne zusätzliche CI-Konfiguration.
  - Deklarative Redirect- und Header-Steuerung via `netlify.toml`.
  - Schnelle weltweite CDN-Auslieferung für statische Vite-Builds.
* **Option B: Vercel**
  - Ebenfalls hervorragende Preview-Funktionen, jedoch bei getrennten Branch-Umgebungen weniger flexibel über eine zentrale Datei konfigurierbar als Netlify.
* **Option C: Eigenes Hosting (S3 / CloudFront / Nginx) mit GitHub Actions**
  - Deutlich höherer Wartungsaufwand, manuelle Verwaltung von Preview-URLs, DNS und Zertifikaten.

## 3. Getroffene Entscheidung
Es wurde **Option A (Netlify)** gewählt mit folgender Konfiguration:

1. **Konfigurationsdatei `netlify.toml`:**
   - **Build:** `pnpm build` mit Publish-Directory `dist`.
   - **Laufzeit-Versionen:** Node.js 20, PNPM 9.
   - **SPA-Routing:** Rewrite `/* -> /index.html (200)` sowohl in `netlify.toml` als auch als Fallback in `public/_redirects`.
   - **Headers:** Sicherheits-Header (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) und immutable Caching für versionierte Vite-Assets (`/assets/*`).
2. **Umgebungen (Contexts):**
   - **`[context.production]` (`main`):** `VITE_APP_ENV = "production"`
   - **`[context.stage]` (`stage`):** `VITE_APP_ENV = "stage"`
   - **`[context.deploy-preview]` (PRs):** `VITE_APP_ENV = "preview"`
   - **`[context.branch-deploy]`:** `VITE_APP_ENV = "branch"`
3. **App-Integration:**
   - Header zeigt bei Non-Production-Deployments ein dezentes farbiges Badge (`stage`, `PR Preview`), um Verwechslungen beim Testen zu vermeiden.

## 4. Konsequenzen & Auswirkungen
* **Positiv:**
  - Jeder Pull Request erhält automatisch einen isolierten Preview-Link direkt im Git-Review.
  - Staging (`stage`) und Produktion (`main`) laufen vollständig automatisiert und unabhängig voneinander.
  - SPA-Routen (`/transactions`, `/cashflow`, etc.) werfen bei manuellem Neuladen im Browser keinen 404-Fehler.
* **Negativ / Risiken:**
  - Im Netlify Dashboard muss unter **Continuous deployment > Branches** einmalig der Branch `stage` für Branch Deploys aktiviert werden (oder "All branches").

