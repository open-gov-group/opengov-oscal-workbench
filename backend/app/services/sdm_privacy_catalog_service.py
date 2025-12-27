import json
from typing import Dict, List, Optional, Tuple

from .file_service import FileService
from ..models import SdmTomControlSummary, SdmTomControlDetail


class SdmPrivacyCatalogService:
    """
    Service zum Lesen/Bearbeiten des sdm_privacy_catalog.json.

    Erwartete Struktur (vereinfachte OSCAL-Annahme):

    {
      "catalog": {
        "groups": [
          {
            "id": "sdm-del",
            "controls": [
              {
                "id": "SDM-TOM-DEL-01-03",
                "title": "...",
                "props": [
                  { "name": "sdm-module", "value": "DEL" },
                  { "name": "dsgvo-article", "value": "19" },
                  { "name": "sdm-goal", "value": "integrity" }
                ],
                "parts": [
                  { "name": "description", "prose": "..." },
                  { "name": "implementation-hints", "prose": "..." },
                  ...
                ]
              }
            ]
          }
        ]
      }
    }
    """

    CATALOG_NAME = "sdm_privacy_catalog"

    def __init__(self, file_service: Optional[FileService] = None) -> None:
        self.fs = file_service or FileService()

    def _load_catalog(self) -> Tuple[str, Dict]:
        raw = self.fs.read_text(self.CATALOG_NAME)
        data = json.loads(raw)
        return raw, data

    def _save_catalog(self, original_raw: str, catalog_dict: Dict) -> Dict:
        new_raw = json.dumps(catalog_dict, indent=2, ensure_ascii=False)
        diff = self.fs.diff(original_raw, new_raw)
        self.fs.write_text(self.CATALOG_NAME, new_raw)
        return {"content": new_raw, "diff": diff}

    def _iter_controls(self, catalog_dict: Dict):
        catalog = catalog_dict.get("catalog") or {}
        for group in catalog.get("groups", []):
            for ctrl in group.get("controls", []):
                yield ctrl

    @staticmethod
    def _get_props_by_name(control: Dict, name: str) -> List[str]:
        result: List[str] = []
        for p in control.get("props", []):
            if p.get("name") == name and p.get("value") is not None:
                result.append(str(p["value"]))
        return result

    @staticmethod
    def _get_prop_first(control: Dict, name: str) -> Optional[str]:
        for p in control.get("props", []):
            if p.get("name") == name and p.get("value") is not None:
                return str(p["value"])
        return None

    @staticmethod
    def _find_part(control: Dict, name: str) -> Optional[Dict]:
        for part in control.get("parts", []):
            if part.get("name") == name:
                return part
        return None

    @staticmethod
    def _ensure_part(control: Dict, name: str) -> Dict:
        part = SdmPrivacyCatalogService._find_part(control, name)
        if part is None:
            part = {"id": f"{control['id']}-{name}", "name": name}
            control.setdefault("parts", []).append(part)
        return part

    # ---------------------- öffentliche API ------------------------

    def list_controls(self) -> List[SdmTomControlSummary]:
        _, data = self._load_catalog()
        items: List[SdmTomControlSummary] = []

        for ctrl in self._iter_controls(data):
            module = self._get_prop_first(ctrl, "sdm-module")
            goals = self._get_props_by_name(ctrl, "sdm-goal")
            dsgvo = self._get_props_by_name(ctrl, "dsgvo-article")

            items.append(
                SdmTomControlSummary(
                    id=ctrl.get("id"),
                    title=ctrl.get("title", ""),
                    sdm_module=module,
                    sdm_goals=goals,
                    dsgvo_articles=dsgvo,
                )
            )

        items.sort(key=lambda c: (c.sdm_module or "", c.id))
        return items

    def get_control(self, control_id: str) -> Optional[SdmTomControlDetail]:
        _, data = self._load_catalog()

        for ctrl in self._iter_controls(data):
            if ctrl.get("id") != control_id:
                continue

            module = self._get_prop_first(ctrl, "sdm-module")
            goals = self._get_props_by_name(ctrl, "sdm-goal")
            dsgvo = self._get_props_by_name(ctrl, "dsgvo-article")

            desc_part = self._find_part(ctrl, "description")
            impl_part = self._find_part(ctrl, "implementation-hints")

            return SdmTomControlDetail(
                id=ctrl.get("id"),
                title=ctrl.get("title", ""),
                sdm_module=module,
                sdm_goals=goals,
                dsgvo_articles=dsgvo,
                description=(desc_part or {}).get("prose"),
                implementation_hints=(impl_part or {}).get("prose"),
            )

        return None

    def update_control(self, control_id: str, data: SdmTomControlDetail) -> Dict:
        original_raw, catalog = self._load_catalog()

        found = False
        for ctrl in self._iter_controls(catalog):
            if ctrl.get("id") != control_id:
                continue

            found = True

            ctrl["title"] = data.title

            # Beschreibung / Umsetzungshinweise
            desc = self._ensure_part(ctrl, "description")
            impl = self._ensure_part(ctrl, "implementation-hints")

            desc["prose"] = data.description or ""
            impl["prose"] = data.implementation_hints or ""

            break

        if not found:
            raise ValueError(f"Control {control_id} not found in sdm_privacy_catalog")

        result = self._save_catalog(original_raw, catalog)
        updated = self.get_control(control_id)
        return {
            "updated": updated,
            "file": result,
        }
