import json
from typing import List, Optional, Dict, Any

from ..models import SecurityControl


class ResilienceCatalogService:
    def __init__(self, raw_json: dict):
        self.raw = raw_json

    @classmethod
    def from_json_str(cls, content: str) -> "ResilienceCatalogService":
        data = json.loads(content)
        return cls(data)

    # -------- interne Helfer --------

    def _iter_controls(self):
        """
        Generator über alle Controls im Resilience-Katalog.
        Gibt (group_id, control_dict) zurück.
        """
        catalog = self.raw.get("catalog", {})
        for group in catalog.get("groups", []):
            group_id = group.get("id")
            for control in group.get("controls", []):
                yield group_id, control

    @staticmethod
    def _extract_props(control: Dict[str, Any]) -> dict:
        """
        Liest domain & objective aus props und description aus parts.
        """
        domain: Optional[str] = None
        objective: Optional[str] = None
        description: Optional[str] = None

        # props: domain / objective
        for prop in control.get("props", []):
            name = prop.get("name")
            value = prop.get("value", "")
            if name == "domain":
                domain = value
            elif name == "objective":
                objective = value

        # parts: description aus prose
        for part in control.get("parts", []):
            pname = part.get("name")
            pid = part.get("id", "")
            prose = part.get("prose")
            if pname == "description" or pid.endswith("-desc"):
                description = prose
                break

        return {
            "domain": domain,
            "objective": objective,
            "description": description,
        }

    # -------- öffentliche Methoden --------

    def list_controls(self) -> List[SecurityControl]:
        items: List[SecurityControl] = []

        for _group_id, control in self._iter_controls():
            ctrl_id = control.get("id")
            title = control.get("title", "")
            if not ctrl_id:
                continue

            props = self._extract_props(control)

            items.append(
                SecurityControl(
                    id=ctrl_id,
                    title=title,
                    class_=control.get("class"),
                    domain=props["domain"],
                    objective=props["objective"],
                    description=None,  # in der Liste lassen wir Beschreibung weg oder gekürzt
                )
            )

        items.sort(key=lambda c: c.id)
        return items

    def get_control(self, control_id: str) -> Optional[SecurityControl]:
        for _group_id, control in self._iter_controls():
            if control.get("id") == control_id:
                props = self._extract_props(control)
                return SecurityControl(
                    id=control_id,
                    title=control.get("title", ""),
                    class_=control.get("class"),
                    domain=props["domain"],
                    objective=props["objective"],
                    description=props["description"],
                )
        return None

    def update_control(self, control_id: str, updates: dict) -> SecurityControl:
        """
        Aktualisiert Titel, Domain, Objective und Beschreibung für ein SEC-Control.
        """
        catalog = self.raw.get("catalog", {})
        target_control: Optional[dict] = None

        for group in catalog.get("groups", []):
            for control in group.get("controls", []):
                if control.get("id") == control_id:
                    target_control = control
                    break

        if target_control is None:
            raise ValueError(f"Security control {control_id} not found")

        # Titel
        if "title" in updates and updates["title"] is not None:
            target_control["title"] = updates["title"]

        # props: domain & objective
        props_list = target_control.setdefault("props", [])

        if "domain" in updates and updates["domain"] is not None:
            props_list = [p for p in props_list if p.get("name") != "domain"]
            props_list.append({"name": "domain", "value": updates["domain"]})

        if "objective" in updates and updates["objective"] is not None:
            props_list = [p for p in props_list if p.get("name") != "objective"]
            props_list.append({"name": "objective", "value": updates["objective"]})

        target_control["props"] = props_list

        # parts: description
        if "description" in updates and updates["description"] is not None:
            parts = target_control.setdefault("parts", [])
            desc_part = None
            for part in parts:
                pname = part.get("name")
                pid = part.get("id", "")
                if pname == "description" or pid.endswith("-desc"):
                    desc_part = part
                    break

            if desc_part is None:
                # neue Description-Part anlegen
                desc_part = {
                    "id": f"{control_id.lower()}-desc",
                    "name": "description",
                    "prose": updates["description"],
                }
                parts.append(desc_part)
            else:
                desc_part["prose"] = updates["description"]

            target_control["parts"] = parts

        # aktualisierte Werte extrahieren
        props = self._extract_props(target_control)
        return SecurityControl(
            id=control_id,
            title=target_control.get("title", ""),
            class_=target_control.get("class"),
            domain=props["domain"],
            objective=props["objective"],
            description=props["description"],
        )

    def to_json_str(self) -> str:
        return json.dumps(self.raw, ensure_ascii=False, indent=2)
