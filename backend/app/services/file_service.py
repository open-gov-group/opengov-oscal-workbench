import json
from pathlib import Path
from typing import Dict

from . import diff_service
from ..config import settings


NAME_TO_PATH: Dict[str, Path] = {
    settings.SDM_PRIVACY_CATALOG_NAME: settings.SDM_PRIVACY_CATALOG_FILE,
    settings.RESILIENCE_CATALOG_NAME: settings.RESILIENCE_CATALOG_FILE,
    settings.SDM_MAPPING_NAME: settings.SDM_MAPPING_FILE,
}


class FileService:
    def read_text(self, name: str) -> str:
        path = NAME_TO_PATH.get(name)
        if not path:
            raise ValueError(f"Unknown file name: {name}")
        return path.read_text(encoding="utf-8")

    def write_text(self, name: str, content: str) -> None:
        path = NAME_TO_PATH.get(name)
        if not path:
            raise ValueError(f"Unknown file name: {name}")
        path.write_text(content, encoding="utf-8")

    def diff(self, old_content: str, new_content: str):
        old_json = json.loads(old_content)
        new_json = json.loads(new_content)
        return diff_service.diff_json(old_json, new_json)
