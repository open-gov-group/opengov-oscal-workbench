# OpenGov OSCAL Workbench

Webbasierte Workbench zur Pflege von OSCAL-Artefakten im OpenGov-Kontext:

- **Privacy-Kataloge** (z.B. `open_privacy_catalog_risk.json`, `sdm_privacy_catalog.json`)
- **Security-/Resilience-Kataloge** (z.B. `resilience_baseline_catalog.json`)
- **Cross-Mappings** (SDM ↔ BSI IT-Grundschutz ↔ ISO 27001 ↔ ISO 27701 ↔ Resilience-Controls)
- perspektivisch: **Profile, Components und SSPs**

Ziel ist es, die Pflege und Weiterentwicklung der Kataloge, Mappings und Implementierungen deutlich zu vereinfachen – ohne JSON- oder OSCAL-Details im Kopf haben zu müssen.

---

## Motivation

Die Repos

- [`opengov-privacy-oscal`](https://github.com/open-gov-group/opengov-privacy-oscal)
- [`opengov-security-oscal`](https://github.com/open-gov-group/opengov-security-oscal)

enthalten:

- Privacy-/TOM-Kataloge (SDM, Open-Privacy-Katalog),
- Security-/Resilience-Kataloge,
- erste Cross-Mappings zwischen SDM, BSI, ISO 2700x und Resilienz-Anforderungen.

Diese Artefakte wachsen und sollen:

- **versioniert und maschinenlesbar** (OSCAL) bleiben,
- aber auch **für DSB, CISO, Fachverfahren & IT** pflegbar sein.

Direktes Editieren von JSON-Dateien ist dafür auf Dauer zu fehleranfällig.  
Die **OSCAL Workbench** bietet daher eine spezialisierte Oberfläche für genau diese Domain.

---

## Zielbild (MVP)

Der erste Ausbauschritt (MVP) fokussiert auf:

- **SDM-/Privacy-Katalog lesen & bearbeiten**
- **Resilience-Katalog lesen & bearbeiten**
- **Mappings zwischen Privacy und Security/Standards pflegen**
- **Änderungen validieren & mit Diff-Vorschau speichern**

### MVP-Features (P0)

1. **OSCAL-Dateien laden & validieren**
   - Laden der zentralen Dateien:
     - `sdm_privacy_catalog.json`
     - `open_privacy_catalog_risk.json`
     - `resilience_baseline_catalog.json`
     - `sdm_privacy_to_security.json`
   - Schema-Validierung gegen OSCAL 1.1.2 (für Catalogs)
   - Verständliche Anzeige von Validierungsfehlern

2. **Control-Explorer für SDM-Privacy-Katalog**
   - Listenansicht aller SDM-Controls (`SDM-TOM-…`, `DSR-…` etc.)
   - Filter nach:
     - ID, Titel
     - SDM-Baustein (`sdm-module`)
     - DSGVO-Artikel (`dsgvo-article`)
     - SDM-Gewährleistungsziel (`sdm-goal`)
   - Detailansicht eines Controls:
     - Stammdaten (ID, Titel, Klasse)
     - Eigenschaften (`props`) strukturiert angezeigt:
       - `sdm-goal`, `sdm-module`, `dsgvo-article`, `implementation-level`, `dp-risk-*`, `related-mapping`, …
   - Bearbeiten von Props (insb. `related-mapping`)

3. **Mapping-Editor (SDM ↔ BSI/ISO/SEC)**
   - Pro SDM-Control:
     - Zuweisung von BSI-Bausteinen (z.B. `CON.2`, `CON.3`, `APP.3.1`, `APP.4.3`)
     - Zuweisung von ISO 27001:2022-Controls (z.B. `A.5.34`, `A.8.10`, `A.8.15`)
     - Zuweisung von ISO 27701-/PIMS-Themen (z.B. `obligations-to-pii-principals`)
     - Verknüpfung mit Resilience-/Security-Controls (`SEC-…` aus dem Resilience-Katalog)
   - Pflege von `related-mapping`-Props im SDM-Katalog und/oder in einer Mapping-Datei
     (`sdm_privacy_to_security.json`)

4. **Resilience-Katalog-Explorer**
   - Listen- und Detailansicht der Resilience-Controls (`SEC-…`) aus
     `resilience_baseline_catalog.json`
   - Bearbeitbare Felder:
     - Domain (z.B. `backup-recovery`, `logging`)
     - Objective
     - Beschreibung (Prosa)

5. **Änderungen speichern mit Diff-Vorschau**
   - Änderungen an Katalogen/Mappings werden zunächst im Speicher gehalten
   - Vor dem Speichern:
     - strukturierte Diff-Vorschau (`added`, `changed`, `removed`)
   - Erst nach Bestätigung werden die JSON-Dateien im jeweiligen Repo überschrieben
   - optional: Übergabe einer Commit Message für Git

---

## Architektur (High Level)

Die Workbench folgt einem Domain-Driven-Ansatz mit klaren Bounded Contexts:

- **PrivacyCatalog**  
  – SDM-/Privacy-Katalog (`sdm_privacy_catalog.json`)

- **SecurityCatalog**  
  – Resilience-/Security-Katalog (`resilience_baseline_catalog.json`)

- **Mapping**  
  – SDM ↔ Security/Standards (`sdm_privacy_to_security.json`)

- **File/Repo/Validation**  
  – Lesen/Schreiben von Dateien, Schema-Validierung, Diff, Git-Integration

### Tech-Stack (vorgesehen)

- **Frontend**
  - React + TypeScript
  - UI-Framework (z.B. MUI oder Tailwind + eigene Komponenten)
  - Datenzugriff über REST-API (z.B. mit React Query)

- **Backend**
  - Python + FastAPI
  - `jsonschema`/ähnliches für OSCAL-Validation
  - Zugriff auf lokale Git-Repos (per Volume oder Git-Client)
  - Saubere Domain-Services:
    - `SdmCatalogService`
    - `ResilienceCatalogService`
    - `MappingService`
    - `FileService`, `ValidationService`, `DiffService`, optional `GitService`

- **Datenbasis**
  - Keine separate Datenbank im MVP
  - Single Source of Truth bleiben die JSON-Dateien in:
    - `opengov-privacy-oscal`
    - `opengov-security-oscal`

---

## Bounded Contexts & Domain Services

### PrivacyCatalog BC

- **Quelle:** `sdm_privacy_catalog.json`
- **Service:** `SdmCatalogService`
  - listet Controls
  - liefert Details zu einem Control
  - aktualisiert Props (z.B. `related-mapping`)

### SecurityCatalog BC

- **Quelle:** `resilience_baseline_catalog.json`
- **Service:** `ResilienceCatalogService`
  - listet SEC-Controls
  - liefert Details
  - bearbeitet Titel, Domain, Ziel, Beschreibung

### Mapping BC

- **Quelle:** `sdm_privacy_to_security.json` (oder ähnlich)
- **Service:** `MappingService`
  - verwaltet Einträge:
    - `sdmControlId`
    - zugeordnete `SEC-…`-Controls
    - BSI-/ISO-/ISO27701-Listen
  - optional: Konsistenzchecks zu SDM- und Resilience-Katalog

### File/Repo/Validation BC

- **Services:**
  - `FileService` – liest/schreibt Dateien anhand symbolischer Namen
  - `ValidationService` – OSCAL-Schema-Validation
  - `DiffService` – JSON-Diff für die Preview
  - `GitService` (optional) – `git add` + `git commit` nach Save

---

## Entwicklungs-Setup (Skizze)

> **Hinweis:** Konkrete Befehle folgen, sobald das Grundgerüst steht.  
> Dieser Abschnitt dient als Orientierung.

1. Repos lokal klonen:

   ```bash
   git clone https://github.com/open-gov-group/opengov-privacy-oscal.git
   git clone https://github.com/open-gov-group/opengov-security-oscal.git
   git clone https://github.com/open-gov-group/opengov-oscal-workbench.git
