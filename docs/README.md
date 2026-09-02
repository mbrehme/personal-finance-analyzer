# Projekt-Dokumentation & Planungsverwaltung

Dieses Verzeichnis dient der transparenten Verwaltung von Architekturentscheidungen und konkreten Feature-Planungen.

---

## 📁 Verzeichnisstruktur

```text
docs/
├── architecture/          # Langfristige Architekturentscheidungen (ADRs)
│   ├── template.md        # Vorlage für neue ADRs
│   └── 0001-frontend-architecture-and-stack.md
└── plans/                 # Konkrete Feature- und Umsetzungspläne
    ├── template.md        # Vorlage für neue Feature-Pläne
    ├── active/            # Aktuell in Bearbeitung befindliche Pläne
    └── archive/           # Erfolgreich abgeschlossene und archivierte Pläne
```

---

## 🏛 1. Architekturentscheidungen (`docs/architecture/`)

Hier werden **Architecture Decision Records (ADRs)** nach etabliertem Standard abgelegt.

* **Dateibenennung:** `XXXX-titel-der-entscheidung.md` (z. B. `0002-state-management-approach.md`).
* **Vorlage:** Nutze [template.md](file:///Users/mbrehme/Documents/personal-finance-analyzer/docs/architecture/template.md) für neue Einträge.
* **Inhalt:** Kontext, getroffene Entscheidung, betrachtete Alternativen und Konsequenzen.

---

## 📋 2. Feature-Pläne (`docs/plans/`)

Pläne strukturieren größere Features, Refactorings oder Änderungen vor der eigentlichen Implementierung.

### Lebenszyklus eines Plans:
1. **Erstellung:** Erstelle eine neue Plan-Datei unter `docs/plans/active/YYYY-MM-DD-feature-name.md` basierend auf der [Vorlage](file:///Users/mbrehme/Documents/personal-finance-analyzer/docs/plans/template.md).
2. **In Bearbeitung (`active/`):** Der Plan wird vom Agenten und Entwickler schrittweise umgesetzt und abgehakt.
3. **Abschluss & Archivierung (`archive/`):** Nach erfolgreicher Umsetzung und Verifikation wird die Datei in `docs/plans/archive/` verschoben.

