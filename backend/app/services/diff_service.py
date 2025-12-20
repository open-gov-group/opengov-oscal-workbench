# backend/app/services/diff_service.py

from typing import Any, Dict, List
from ..models import DiffResult, DiffSummary, DiffChange


def diff_json(old: Dict[str, Any], new: Dict[str, Any]) -> DiffResult:
    """
    Sehr einfache Stub-Implementierung:
    - betrachtet noch keine echten Feldänderungen,
    - liefert erst einmal nur ein leeres Diff-Ergebnis zurück.

    Später kann hier z.B. DeepDiff oder eine eigene Logik rein.
    """
    summary = DiffSummary(added=0, changed=0, removed=0)
    details: List[DiffChange] = []
    return DiffResult(summary=summary, details=details)
