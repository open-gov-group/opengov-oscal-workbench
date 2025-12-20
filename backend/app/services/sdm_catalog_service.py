import json
from typing import List, Optional, Dict, Any

from ..models import (
    SdmControlSummary,
    SdmControlSummaryProps,
    SdmControlDetail,
    SdmControlDetailProps,
    RelatedMapping,
)


class SdmCatalogService:
    def __init__(self, raw_json: dict):
        self.raw = raw_json

    @classmethod
    def from_json_str(cls, content: str) -> "SdmCatalogService":
        data = json.loads(content)
        return cls(data)

    # ---------- interne Helfer ----------

    def _iter_controls(self):
        """
        Generator über alle Controls im Catalog (inkl. Gruppenzugehörigkeit).
        Gibt Tupel (group_id, control_dict) zurück.
        """
        catalog = self.raw.get("catalog", {})
        for group in catalog.get("groups", []):
            group_id = group.get("id")
            for control in group.get("controls", []):
                yield group_id, control

    @staticmethod
    def _extract_summary_props(control: Dict[str, Any]) -> SdmControlSummaryProps:
        sdm_module: Optional[str] = None
        sdm_goals: List[str] = []
        dsgvo_articles: List[str] = []

        for prop in control.get("props", []):
            name = prop.get("name")
            value = prop.get("value", "")

            if name == "sdm-module":
                sdm_module = value

            elif name == "sdm-goal":
                if value and value not in sdm_goals:
                    sdm_goals.append(value)

            # hier ggf. an deine realen Prop-Namen anpassen
            elif name in ("dsgvo-article", "legal-basis"):
                if value and value not in dsgvo_articles:
                    dsgvo_articles.append(value)

        return SdmControlSummaryProps(
            sdmModule=sdm_module,
            sdmGoals=sdm_goals,
            dsgvoArticles=dsgvo_articles,
        )

    @staticmethod
    def _extract_detail_props(control: Dict[str, Any]) -> SdmControlDetailProps:
        summary = SdmCatalogService._extract_summary_props(control)

        implementation_level: Optional[str] = None
        dp_risk_impact: Optional[str] = None
        related_mappings: List[RelatedMapping] = []

        for prop in control.get("props", []):
            name = prop.get("name")
            value = prop.get("value", "")
            clazz = prop.get("class")

            if name == "implementation-level":
                implementation_level = value

            elif name == "dp-risk-impact":
                dp_risk_impact = value

            elif name == "related-mapping":
                # scheme leiten wir aus class ab (bsi / iso27001 / iso27701 / security / …)
                scheme = clazz or "other"
                rm = RelatedMapping(
                    scheme=scheme,
                    value=value,
                    remarks=prop.get("remarks")
                )
                related_mappings.append(rm)

        return SdmControlDetailProps(
            sdmModule=summary.sdmModule,
            sdmGoals=summary.sdmGoals,
            dsgvoArticles=summary.dsgvoArticles,
            implementationLevel=implementation_level,
            dpRiskImpact=dp_risk_impact,
            relatedMappings=related_mappings,
        )

    # ---------- öffentliche Methoden für API ----------

    def list_controls(self) -> List[SdmControlSummary]:
        """Gibt alle Controls als Summary für die Tabellen-Ansicht zurück."""
        items: List[SdmControlSummary] = []

        for group_id, control in self._iter_controls():
            ctrl_id = control.get("id")
            title = control.get("title", "")

            if not ctrl_id:
                continue

            props = self._extract_summary_props(control)

            items.append(
                SdmControlSummary(
                    id=ctrl_id,
                    title=title,
                    groupId=group_id,
                    props=props,
                )
            )

        # optional sortieren nach ID
        items.sort(key=lambda c: c.id)
        return items

    def get_control(self, control_id: str) -> Optional[SdmControlDetail]:
        """Detailansicht für ein Control (inkl. Mappings etc.)."""
        for group_id, control in self._iter_controls():
            if control.get("id") == control_id:
                props = self._extract_detail_props(control)
                return SdmControlDetail(
                    id=control_id,
                    title=control.get("title", ""),
                    class_=control.get("class"),
                    groupId=group_id,
                    props=props,
                )
        return None

    def update_control_props(self, control_id: str, props_update: dict) -> SdmControlDetail:
        """
        Aktualisiert bestimmte Props eines Controls in self.raw.
        Erwartet z.B. {"relatedMappings": [...]} aus dem API-Request.
        """
        catalog = self.raw.get("catalog", {})
        target_control: Optional[dict] = None
        target_group_id: Optional[str] = None

        for group in catalog.get("groups", []):
            for control in group.get("controls", []):
                if control.get("id") == control_id:
                    target_control = control
                    target_group_id = group.get("id")
                    break

        if target_control is None:
            raise ValueError(f"Control {control_id} not found")

        # Falls keine props-Liste existiert, anlegen
        props_list = target_control.setdefault("props", [])

        # Mapping-Update: relatedMappings → Props-Objekte
        if "relatedMappings" in props_update:
            # Entferne alle bisherigen related-mapping-Props
            props_list = [
                p for p in props_list if p.get("name") != "related-mapping"
            ]

            for rm in props_update["relatedMappings"]:
                props_list.append(
                    {
                        "name": "related-mapping",
                        "class": rm["scheme"],
                        "value": rm["value"],
                        **({"remarks": rm["remarks"]} if rm.get("remarks") else {}),
                    }
                )

            target_control["props"] = props_list

        # TODO: weitere Felder aus props_update analog behandeln (implementation-level, dp-risk-impact, ...)

        detail_props = self._extract_detail_props(target_control)
        return SdmControlDetail(
            id=control_id,
            title=target_control.get("title", ""),
            class_=target_control.get("class"),
            groupId=target_group_id,
            props=detail_props,
        )

    def to_json_str(self) -> str:
        return json.dumps(self.raw, ensure_ascii=False, indent=2)
