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
