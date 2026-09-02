# ADR-0002: Local-First Datenmodell, Typisierung und Matching-Architektur

* **Status:** Akzeptiert
* **Datum:** 2026-09-02
* **Autor(en):** Antigravity & Entwickler-Team
* **Entscheider:** Projektinhaber & Entwickler-Team

---

## 1. Kontext & Problemstellung
Der Personal Finance Analyzer soll private Banktransaktionen, Konten und Kategorien (Buckets) verwalten und analysieren.
Als Kernanforderung gilt: Sämtliche Finanzdaten verbleiben zu 100% lokal im Browser des Nutzers (Local-First), ohne dass Daten an externe Server übertragen werden. Zudem müssen Buchungen flexibel und fehlertolerant per Regex und Freitext kategorisierbar sein, manuelle Eingriffe persistent geschützt werden und Kontostände exakt über historische Stichtage rekonstruierbar sein.

## 2. Betrachtete Optionen / Alternativen
* **Option A: Reine In-Memory/LocalStorage-Lösung**
  - *Vorteile:* Sehr einfache Implementierung.
  - *Nachteile:* LocalStorage ist auf ca. 5 MB begrenzt und blockiert den Hauptthread.
* **Option B: IndexedDB mit typisiertem Local-First State Store (Gewählt)**
  - *Vorteile:* Nahezu unbegrenzter clientseitiger Speicher, asynchroner Zugriff, vollständige Offline-Verfügbarkeit, portable JSON-Konfigurations-Backups.
  - *Nachteile:* Asynchrone Schnittstelle erfordert sauberen Service-Layer.

## 3. Getroffene Entscheidung
Es wurde **Option B** gewählt mit folgenden Kernprinzipien:
1. **Speicher-Layer (`src/services/storage/`):**
   - Verwendung der nativen `IndexedDB` API mit `MemoryStorage`-Fallback für Tests.
2. **Typsicherheit mit `ISODateString`:**
   - Alle Datumsangaben (`valueDate`, `bookingDate`, `BalanceEntry.date`) sind streng typisiert als `${number}-${string}-${string}` (`YYYY-MM-DD`).
3. **Generische visuelle Metadaten (`EntityVisualMetadata`):**
   - `Account` und `Bucket` erweitern die gemeinsame Basis-Schnittstelle (`name`, `color`, `icon`, `description`), während `id` als Identität separat geführt wird.
4. **Typenlose Buckets & Compound Matching:**
   - Buckets besitzen keinen festen Typ (`income/expense`).
   - Blatt-Buckets nutzen einen einzelnen `regexPattern`-String (unterstützt native Alternation `|`).
   - Regex-Matching und Freitextsuche laufen gegen ein virtuelles `compoundSearchField` (`${accountId} | ${issuer} | ${receiver} | ${subject} | ${type} | ${value} | ${iban}`).
5. **Persistente manuelle Overrides:**
   - Manuell zugewiesene Buchungen werden mit `assignmentSource: 'manual'` gesperrt und in `Bucket.manualTransactionIds` gespeichert, sodass sie in der Konfiguration sichtbar sind und beim Re-Import automatisch erhalten bleiben.

## 4. Konsequenzen & Auswirkungen
* **Positiv:**
  - 100% Datenschutzgarantie ohne Server-Backend.
  - Performante Suche und Regex-Matching auch bei zehntausenden Transaktionen.
  - Nahtlose Wiederherstellbarkeit aller Nutzerkonfigurationen über schlanke JSON-Dateien.
* **Negativ / Risiken:**
  - Browserdaten-Löschung (z. B. "Alle Websitedaten löschen") löscht die lokale IndexedDB – regelmäßige JSON-Exporte werden empfohlen.
* **Folgeaufgaben:**
  - Bereitstellung von weiteren CSV-Bank-Profilen und automatisierten Import-Parsern nach Bedarf.
