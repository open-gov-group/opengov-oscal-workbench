import json
from typing import Dict, List, Optional, Tuple

from .file_service import FileService
from ..models import PrivacyControlSummary, PrivacyControlDetail, PrivacyGroupSummary, PrivacyGroupDetail
from ..config import settings

class PrivacyCatalogService:
    """
    Service zum Lesen/Bearbeiten des open-privacy-catalog_risk.

    Erwartete Struktur (vereinfachte OSCAL-Annahme):

    {
      "catalog": {
        "groups": [
          {
            "id": "tom-ac",
            "controls": [
              {
                "id": "tom-ac-01",
                "title": "Access Control ...",
                "props": [
                  { "name": "tom-id", "value": "AC-01" },
                  { "name": "dsgvo-article", "value": "32" },
                  { "name": "dp-goal", "value": "integrity" }
                ],
                "parts": [
                  { "name": "statement", "prose": "..." },
                  { "name": "maturity-level-1", "prose": "..." },
                  { "name": "maturity-level-3", "prose": "..." },
                  { "name": "maturity-level-5", "prose": "..." },
                  {
                    "name": "typical-measures",
                    "parts": [
                      { "name": "measure", "prose": "..." },
                      ...
                    ]
                  },
                  {
                    "name": "assessment-questions",
                    "parts": [
                      { "name": "question", "prose": "..." },
                      ...
                    ]
                  },
                  { "name": "risk-hint", "prose": "..." }
                ]
              }
            ]
          }
        ]
      }
    }
    """

    CATALOG_NAME = "open_privacy_catalog_risk"

        


    def __init__(
        self,
        file_service: Optional[FileService] = None,
        catalog_name: Optional[str] = None,
    ) -> None:
        self.fs = file_service or FileService()
        # Name kommt aus config, kann aber bei Bedarf überschrieben werden
        self.catalog_name = catalog_name or settings.PRIVACY_CATALOG_NAME

    # ------------------------ interne Helfer ------------------------

    def _load_catalog(self) -> Tuple[str, Dict]:
        raw = self.fs.read_text(self.catalog_name)
        data = json.loads(raw)
        return raw, data

    def _save_catalog(self, original_raw: str, catalog_dict: Dict) -> Dict:
        new_raw = json.dumps(catalog_dict, indent=2, ensure_ascii=False)
        diff = self.fs.diff(original_raw, new_raw)
        self.fs.write_text(self.catalog_name, new_raw)
        return {"content": new_raw, "diff": diff}

    def _iter_controls(self, catalog_dict: Dict):
        catalog = catalog_dict.get("catalog") or {}
        for group in catalog.get("groups", []):
            group_id = group.get("id")
            for ctrl in group.get("controls", []):
                yield group_id, ctrl

    @staticmethod
    def _get_props_by_name(control: Dict, name: str) -> List[str]:
        result: List[str] = []
        for p in control.get("props", []):
            if p.get("name") == name and p.get("value") is not None:
                result.append(str(p["value"]))
        return result

    @staticmethod
    def _find_part(control: Dict, name: str) -> Optional[Dict]:
        for part in control.get("parts", []):
            if part.get("name") == name:
                return part
        return None

    @staticmethod
    def _ensure_part(control: Dict, name: str) -> Dict:
        part = PrivacyCatalogService._find_part(control, name)
        if part is None:
            part = {"id": f"{control['id']}-{name}", "name": name}
            control.setdefault("parts", []).append(part)
        return part



 # ------------------------ Gruppen-API ------------------------

    def _iter_groups(self, catalog_dict: Dict):
        """
        Interner Generator über alle Gruppen im Catalog.
        Gibt (group_dict) zurück.
        """
        catalog = catalog_dict.get("catalog") or {}
        for group in catalog.get("groups", []):
            yield group

    
    def list_groups(self) -> List[PrivacyGroupDetail]:
        """
        Liefert alle Gruppen inkl. Anzahl der Controls.
        Eignet sich super für eine Baum-/Akkordeon-Navigation im Frontend.
        """
        _, data = self._load_catalog()
        catalog = data.get("catalog") or {}
        result: List[PrivacyGroupDetail] = []

        for group in catalog.get("groups", []):
            gid = group.get("id")
            title = group.get("title", gid or "")
            description = group.get("remarks") or None  # falls du später remarks nutzt
            controls = group.get("controls", []) or []
            result.append(
                PrivacyGroupDetail(
                    id=gid,
                    title=title,
                    description=description,
                    controlCount=len(controls),
                )
            )

        # optionale Sortierung, z.B. nach id
        result.sort(key=lambda g: g.id or "")
        return result

    def create_group(self, group_id: str, title: str, description: Optional[str] = None) -> PrivacyGroupDetail:
        """
        Legt eine neue Gruppe an (ohne Controls).
        Wir prüfen, dass es keine Gruppe mit gleicher ID gibt.
        """
        original_raw, data = self._load_catalog()
        catalog = data.setdefault("catalog", {})
        groups = catalog.setdefault("groups", [])

        # Duplikatscheck
        for g in groups:
            if g.get("id") == group_id:
                raise ValueError(f"Group with id '{group_id}' already exists")

        new_group: Dict = {
            "id": group_id,
            "title": title,
            "controls": [],
        }
        if description:
            # z.B. als "remarks" ablegen – OSCAL kennt kein Pflichtfeld "description" bei groups
            new_group["remarks"] = description

        groups.append(new_group)

        # speichern
        self._save_catalog(original_raw, data)

        return PrivacyGroupDetail(
            id=group_id,
            title=title,
            description=description,
            controlCount=0,
        )


    def delete_group(
        self,
        group_id: str,
        reassign_to: Optional[str] = None,
        allow_delete_non_empty: bool = False,
    ) -> Dict:
        """
        Löscht eine Gruppe.
        Verhalten:
        - Wenn die Gruppe leer ist → einfach löschen.
        - Wenn nicht leer:
            * Wenn reassign_to gesetzt ist → Controls in Zielgruppe verschieben, dann löschen.
            * Sonst, wenn allow_delete_non_empty=False → Fehler.
            * Sonst → Gruppe mitsamt Controls entfernen.
        """
        original_raw, data = self._load_catalog()
        catalog = data.get("catalog") or {}
        groups = catalog.get("groups", []) or []

        target_group: Optional[Dict] = None
        target_index: Optional[int] = None

        for idx, g in enumerate(groups):
            if g.get("id") == group_id:
                target_group = g
                target_index = idx
                break

        if target_group is None or target_index is None:
            raise ValueError(f"Group '{group_id}' not found")

        controls = target_group.get("controls", []) or []

        # Fall 1: Controls vorhanden & reassign_to
        if controls and reassign_to:
            dest_group: Optional[Dict] = None
            for g in groups:
                if g.get("id") == reassign_to:
                    dest_group = g
                    break

            if dest_group is None:
                raise ValueError(f"Destination group '{reassign_to}' not found")

            dest_controls = dest_group.setdefault("controls", [])
            dest_controls.extend(controls)

        # Fall 2: Controls vorhanden, kein reassign_to, aber Löschung nicht erlaubt
        elif controls and not allow_delete_non_empty:
            raise ValueError(
                f"Group '{group_id}' is not empty; "
                f"use reassign_to or set allow_delete_non_empty=True"
            )

        # Gruppe entfernen
        del groups[target_index]

        # speichern
        self._save_catalog(original_raw, data)

        return {
            "deleted": group_id,
            "reassignedTo": reassign_to,
            "removedControlCount": len(controls) if not reassign_to else 0,
        }


    # ------------------------ öffentliche API ------------------------

    def list_controls(self) -> List[PrivacyControlSummary]:
        _, data = self._load_catalog()
        items: List[PrivacyControlSummary] = []

        for group_id, ctrl in self._iter_controls(data):
            dsgvo = self._get_props_by_name(ctrl, "dsgvo-article")
            dp_goals = self._get_props_by_name(ctrl, "dp-goal")
            tom_id = None
            for p in ctrl.get("props", []):
                if p.get("name") == "tom-id":
                    tom_id = p.get("value")
                    break

            items.append(
                PrivacyControlSummary(
                    id=ctrl.get("id"),
                    title=ctrl.get("title", ""),
                    group_id=group_id,
                    tom_id=tom_id,
                    dsgvo_articles=dsgvo,
                    dp_goals=dp_goals,
                )
            )

        # Nach TOM-ID/ID sortieren für stabile Anzeige
        items.sort(key=lambda c: (c.tom_id or "", c.id))
        return items

    def get_control(self, control_id: str) -> Optional[PrivacyControlDetail]:
        _, data = self._load_catalog()

        for group_id, ctrl in self._iter_controls(data):
            if ctrl.get("id") != control_id:
                continue

            dsgvo = self._get_props_by_name(ctrl, "dsgvo-article")
            dp_goals = self._get_props_by_name(ctrl, "dp-goal")
            tom_id = None
            for p in ctrl.get("props", []):
                if p.get("name") == "tom-id":
                    tom_id = p.get("value")
                    break

            # parts
            statement_part = self._find_part(ctrl, "statement")
            maturity_hints = self._find_part(ctrl, "maturity-hints")
            maturity_1 = self._find_part(maturity_hints, "maturity-level-1")
            maturity_3 = self._find_part(maturity_hints, "maturity-level-3")
            maturity_5 = self._find_part(maturity_hints, "maturity-level-5")
            typical_measures_part = self._find_part(ctrl, "typical-measures")
            assessment_questions_part = self._find_part(
                ctrl, "assessment-questions"
            )
            risk_hint_part = self._find_part(ctrl, "risk-hint")

            # typische Maßnahmen / Assessment-Fragen: je Eintrag = ein Part
            typical_measures: List[str] = []
            if typical_measures_part:
                for p in typical_measures_part.get("parts", []):
                    prose = p.get("prose")
                    if prose:
                        typical_measures.append(prose)

            assessment_questions: List[str] = []
            if assessment_questions_part:
                for p in assessment_questions_part.get("parts", []):
                    prose = p.get("prose")
                    if prose:
                        assessment_questions.append(prose)

            return PrivacyControlDetail(
                id=ctrl.get("id"),
                title=ctrl.get("title", ""),
                group_id=group_id,
                tom_id=tom_id,
                dsgvo_articles=dsgvo,
                dp_goals=dp_goals,
                statement=(statement_part or {}).get("prose"),
                maturity_level_1=(maturity_1 or {}).get("prose"),
                maturity_level_3=(maturity_3 or {}).get("prose"),
                maturity_level_5=(maturity_5 or {}).get("prose"),
                typical_measures=typical_measures,
                assessment_questions=assessment_questions,
                risk_hint=(risk_hint_part or {}).get("prose"),
            )

        return None

    def update_control(self, control_id: str, data: PrivacyControlDetail) -> Dict:
        original_raw, catalog = self._load_catalog()

        found = False
        for _, ctrl in self._iter_controls(catalog):
            if ctrl.get("id") != control_id:
                continue

            found = True

            # Titel
            ctrl["title"] = data.title

            # Props für DSGVO/DP-Ziele bleiben i.d.R. stabil – können bei Bedarf hier auch editiert werden

            # statement
            stmt = self._ensure_part(ctrl, "statement")
            stmt["prose"] = data.statement or ""

            # maturity
            m1 = self._ensure_part(ctrl, "maturity-level-1")
            m3 = self._ensure_part(ctrl, "maturity-level-3")
            m5 = self._ensure_part(ctrl, "maturity-level-5")
            m1["prose"] = data.maturity_level_1 or ""
            m3["prose"] = data.maturity_level_3 or ""
            m5["prose"] = data.maturity_level_5 or ""

            # typical measures
            tm = self._ensure_part(ctrl, "typical-measures")
            tm["parts"] = []
            for idx, text in enumerate(data.typical_measures):
                if not text.strip():
                    continue
                tm["parts"].append(
                    {
                        "id": f"{ctrl['id']}-typical-measure-{idx+1}",
                        "name": "measure",
                        "prose": text.strip(),
                    }
                )

            # assessment questions
            aq = self._ensure_part(ctrl, "assessment-questions")
            aq["parts"] = []
            for idx, text in enumerate(data.assessment_questions):
                if not text.strip():
                    continue
                aq["parts"].append(
                    {
                        "id": f"{ctrl['id']}-assessment-question-{idx+1}",
                        "name": "question",
                        "prose": text.strip(),
                    }
                )

            # risk hint
            rh = self._ensure_part(ctrl, "risk-hint")
            rh["prose"] = data.risk_hint or ""

            break

        if not found:
            raise ValueError(f"Control {control_id} not found in privacy catalog")

        # speichern + diff
        result = self._save_catalog(original_raw, catalog)
        # Ergebnis inklusive aktualisierter Detailansicht zurückgeben
        updated = self.get_control(control_id)
        return {
            "updated": updated,
            "file": result,
        }
