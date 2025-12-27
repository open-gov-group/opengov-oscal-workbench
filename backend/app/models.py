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

#oscal privacy models



class PrivacyGroupSummary(BaseModel):
    id: str            # stabile Gruppen-ID (z.B. "tom-access-control")
    title: str         # sprechender Titel (z.B. "Zugriff & Berechtigungen")

class PrivacyGroupDetail(PrivacyGroupSummary):
    description: Optional[str] = None   # optional, falls wir später etwas wie "remarks" o.ä. pflegen wollen
    controlCount: int                   # wie viele Controls hängen aktuell in dieser Gruppe

class PrivacyGroupCreateRequest(BaseModel):
    id: str
    title: str
    description: Optional[str] = None

class PrivacyGroupUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class PrivacyGroupDeleteRequest(BaseModel):
    """
    Optionales Verhalten beim Löschen:
    - reassignTo: Controls in eine andere Gruppe verschieben
    - allowDeleteNonEmpty: true → Gruppe auch dann löschen, wenn sie noch Controls hat
    """
    reassignTo: Optional[str] = None
    allowDeleteNonEmpty: bool = False


class PrivacyControlSummary(BaseModel):
    id: str
    title: str
    group_id: Optional[str] = None
    tom_id: Optional[str] = None
    dsgvo_articles: List[str] = []
    dp_goals: List[str] = []


class PrivacyControlDetail(BaseModel):
    id: str
    title: str
    group_id: Optional[str] = None
    tom_id: Optional[str] = None
    dsgvo_articles: List[str] = []
    dp_goals: List[str] = []

    # „Inhaltsebene“ des Kompendiums
    statement: Optional[str] = None
    maturity_level_1: Optional[str] = None
    maturity_level_3: Optional[str] = None
    maturity_level_5: Optional[str] = None

    typical_measures: List[str] = []
    assessment_questions: List[str] = []
    risk_hint: Optional[str] = None

class SdmTomControlSummary(BaseModel):
    id: str
    title: str
    sdm_module: Optional[str] = None
    sdm_goals: List[str] = []
    dsgvo_articles: List[str] = []


class SdmTomControlDetail(BaseModel):
    id: str
    title: str
    sdm_module: Optional[str] = None
    sdm_goals: List[str] = []
    dsgvo_articles: List[str] = []

    description: Optional[str] = None
    implementation_hints: Optional[str] = None

