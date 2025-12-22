import json
from typing import List, Optional, Dict, Any

from ..models import SdmSecurityMapping, SecurityControlRef, MappingStandards


class MappingService:
    def __init__(self, raw_json: dict):
        # erwartet Struktur: { "mappings": [ { ... }, ... ] }
        self.raw = raw_json
        if "mappings" not in self.raw or not isinstance(self.raw["mappings"], list):
            self.raw["mappings"] = []

    @classmethod
    def from_json_str(cls, content: str) -> "MappingService":
        data = json.loads(content)
        return cls(data)

    # ----- interne Helfer -----

    @staticmethod
    def _from_raw_mapping(raw: Dict[str, Any]) -> SdmSecurityMapping:
        standards_raw = raw.get("standards", {}) or {}

        return SdmSecurityMapping(
            sdmControlId=raw.get("sdm_control_id", ""),
            sdmTitle=raw.get("sdm_title", ""),
            securityControls=[
                SecurityControlRef(
                    catalogId=sc.get("catalog_id", ""),
                    controlId=sc.get("control_id", "")
                )
                for sc in raw.get("security_controls", [])
            ],
            standards=MappingStandards(
                bsi=standards_raw.get("bsi"),
                iso27001=standards_raw.get("iso27001"),
                iso27701=standards_raw.get("iso27701"),
            ),
            notes=raw.get("notes"),
        )

    @staticmethod
    def _to_raw_mapping(mapping: SdmSecurityMapping) -> Dict[str, Any]:
        standards_raw: Dict[str, Any] = {}
        if mapping.standards.bsi:
            standards_raw["bsi"] = mapping.standards.bsi
        if mapping.standards.iso27001:
            standards_raw["iso27001"] = mapping.standards.iso27001
        if mapping.standards.iso27701:
            standards_raw["iso27701"] = mapping.standards.iso27701

        return {
            "sdm_control_id": mapping.sdmControlId,
            "sdm_title": mapping.sdmTitle,
            "security_controls": [
                {
                    "catalog_id": sc.catalogId,
                    "control_id": sc.controlId,
                }
                for sc in mapping.securityControls
            ],
            "standards": standards_raw,
            "notes": mapping.notes,
        }

    # ----- öffentliche Methoden -----

    def list_mappings(self) -> List[SdmSecurityMapping]:
        items: List[SdmSecurityMapping] = []
        for raw in self.raw.get("mappings", []):
            items.append(self._from_raw_mapping(raw))
        # optional sortieren nach sdmControlId
        items.sort(key=lambda m: m.sdmControlId)
        return items

    def get_mapping(self, sdm_control_id: str) -> Optional[SdmSecurityMapping]:
        for raw in self.raw.get("mappings", []):
            if raw.get("sdm_control_id") == sdm_control_id:
                return self._from_raw_mapping(raw)
        return None

    def upsert_mapping(self, mapping: SdmSecurityMapping) -> SdmSecurityMapping:
        """
        Fügt ein Mapping hinzu oder ersetzt es, wenn sdm_control_id bereits existiert.
        """
        raw_list = self.raw.setdefault("mappings", [])
        new_raw = self._to_raw_mapping(mapping)

        for idx, raw in enumerate(raw_list):
            if raw.get("sdm_control_id") == mapping.sdmControlId:
                raw_list[idx] = new_raw
                break
        else:
            raw_list.append(new_raw)

        return mapping

    def delete_mapping(self, sdm_control_id: str) -> None:
        raw_list = self.raw.get("mappings", [])
        self.raw["mappings"] = [
            raw for raw in raw_list if raw.get("sdm_control_id") != sdm_control_id
        ]

    def to_json_str(self) -> str:
        return json.dumps(self.raw, ensure_ascii=False, indent=2)
