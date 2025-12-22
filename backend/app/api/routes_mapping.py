from fastapi import APIRouter, HTTPException

from ..models import SdmSecurityMapping, SdmSecurityMappingUpdateRequest
from ..services.file_service import FileService
from ..services.mapping_service import MappingService
from ..config import settings

router = APIRouter(prefix="/api", tags=["mapping"])


@router.get("/mapping", response_model=dict)
def list_mappings():
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_MAPPING_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_to_security.json not found – check config.py and data/ path",
        )

    service = MappingService.from_json_str(content)
    items = service.list_mappings()
    return {"items": items}


@router.get("/mapping/{sdm_control_id}", response_model=SdmSecurityMapping)
def get_mapping(sdm_control_id: str):
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_MAPPING_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_to_security.json not found – check config.py and data/ path",
        )

    service = MappingService.from_json_str(content)
    mapping = service.get_mapping(sdm_control_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.put("/mapping/{sdm_control_id}", response_model=SdmSecurityMapping)
def upsert_mapping(sdm_control_id: str, req: SdmSecurityMappingUpdateRequest):
    """
    Legt ein neues Mapping für ein SDM-Control an oder überschreibt das bestehende.
    """
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_MAPPING_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_to_security.json not found – check config.py and data/ path",
        )

    service = MappingService.from_json_str(content)

    mapping = SdmSecurityMapping(
        sdmControlId=sdm_control_id,
        sdmTitle=req.sdmTitle,
        securityControls=req.securityControls,
        standards=req.standards,
        notes=req.notes,
    )

    updated = service.upsert_mapping(mapping)
    new_content = service.to_json_str()
    fs.write_text(settings.SDM_MAPPING_NAME, new_content)

    return updated


@router.delete("/mapping/{sdm_control_id}")
def delete_mapping(sdm_control_id: str):
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_MAPPING_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_to_security.json not found – check config.py and data/ path",
        )

    service = MappingService.from_json_str(content)
    service.delete_mapping(sdm_control_id)
    new_content = service.to_json_str()
    fs.write_text(settings.SDM_MAPPING_NAME, new_content)

    return {"status": "ok"}
