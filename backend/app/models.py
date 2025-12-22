from typing import List, Optional, Literal
from pydantic import BaseModel


class RelatedMapping(BaseModel):
    scheme: str  # "bsi" | "iso27001" | "iso27701" | ...
    value: str
    remarks: Optional[str] = None


class SdmControlSummaryProps(BaseModel):
    sdmModule: Optional[str] = None
    sdmGoals: List[str] = []
    dsgvoArticles: List[str] = []


class SdmControlSummary(BaseModel):
    id: str
    title: str
    groupId: Optional[str] = None
    props: SdmControlSummaryProps


class SdmControlDetailProps(SdmControlSummaryProps):
    implementationLevel: Optional[str] = None
    dpRiskImpact: Optional[str] = None
    relatedMappings: List[RelatedMapping] = []


class SdmControlDetail(BaseModel):
    id: str
    title: str
    class_: Optional[str] = None
    groupId: Optional[str] = None
    props: SdmControlDetailProps


class SecurityControl(BaseModel):
    id: str
    title: str
    class_: Optional[str] = None
    domain: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None


class ValidationErrorItem(BaseModel):
    path: str
    message: str


class ValidationResult(BaseModel):
    valid: bool
    errors: List[ValidationErrorItem] = []


class FileContent(BaseModel):
    name: str
    content: str


class SaveRequest(BaseModel):
    name: str
    content: str
    previewOnly: bool = True
    commitMessage: Optional[str] = None


class DiffChange(BaseModel):
    path: str
    change: Literal["added", "changed", "removed"]
    old: Optional[object] = None
    new: Optional[object] = None


class DiffSummary(BaseModel):
    added: int = 0
    changed: int = 0
    removed: int = 0


class DiffResult(BaseModel):
    summary: DiffSummary
    details: List[DiffChange] = []


class SaveResponse(BaseModel):
    mode: Literal["preview", "saved"]
    written: bool = False
    diff: Optional[DiffResult] = None

class SdmControlUpdateProps(BaseModel):
    """
    Props, die über die API aktualisiert werden können.
    Alles optional, damit wir nur Teilupdates machen müssen.
    """
    implementationLevel: Optional[str] = None
    dpRiskImpact: Optional[str] = None
    relatedMappings: Optional[List[RelatedMapping]] = None


class SdmControlUpdateRequest(BaseModel):
    props: SdmControlUpdateProps

#resilience models

class SecurityControl(BaseModel):
    id: str
    title: str
    class_: Optional[str] = None
    domain: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None

class SecurityControlUpdateRequest(BaseModel):
    """
    Felder, die für ein SEC-Control über die API geändert werden können.
    Alle optional, damit Teilupdates möglich sind.
    """
    title: Optional[str] = None
    domain: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None


#mapping models

class SecurityControlRef(BaseModel):
    catalogId: str  # z.B. "opengov-resilience-baseline"
    controlId: str  # z.B. "SEC-BACKUP-LIFECYCLE-01"


class MappingStandards(BaseModel):
    bsi: Optional[List[str]] = None         # z.B. ["CON.2", "APP.3.1"]
    iso27001: Optional[List[str]] = None   # z.B. ["5.34", "8.10"]
    iso27701: Optional[List[str]] = None   # z.B. ["obligations-to-pii-principals"]


class SdmSecurityMapping(BaseModel):
    sdmControlId: str
    sdmTitle: str
    securityControls: List[SecurityControlRef] = []
    standards: MappingStandards = MappingStandards()
    notes: Optional[str] = None


class SdmSecurityMappingUpdateRequest(BaseModel):
    """
    Request für PUT /api/mapping/{sdmControlId}.
    Wir behandeln das als vollständiges Ersetzen des Mappings
    (d.h. UI schickt den aktuellen Stand komplett).
    """
    sdmTitle: str
    securityControls: List[SecurityControlRef] = []
    standards: MappingStandards = MappingStandards()
    notes: Optional[str] = None


