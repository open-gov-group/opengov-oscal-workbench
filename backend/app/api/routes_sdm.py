from fastapi import APIRouter, HTTPException

from ..models import SdmControlDetail, SdmControlUpdateRequest
from ..services.file_service import FileService
from ..services.sdm_catalog_service import SdmCatalogService
from ..config import settings

router = APIRouter(prefix="/api/sdm", tags=["sdm"])


@router.get("/controls", response_model=dict)
def list_sdm_controls():
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_PRIVACY_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_catalog.json not found – check config.py and data/ path",
        )

    service = SdmCatalogService.from_json_str(content)
    items = service.list_controls()
    return {"items": items}


@router.get("/controls/{control_id}", response_model=SdmControlDetail)
def get_sdm_control(control_id: str):
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_PRIVACY_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_catalog.json not found – check config.py and data/ path",
        )

    service = SdmCatalogService.from_json_str(content)
    control = service.get_control(control_id)
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    return control


@router.put("/controls/{control_id}", response_model=SdmControlDetail)
def update_sdm_control(control_id: str, req: SdmControlUpdateRequest):
    """
    Aktualisiert Props für ein SDM-Control und persistiert die Änderungen
    direkt in sdm_privacy_catalog.json.
    """
    fs = FileService()
    try:
        content = fs.read_text(settings.SDM_PRIVACY_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="sdm_privacy_catalog.json not found – check config.py and data/ path",
        )

    service = SdmCatalogService.from_json_str(content)

    try:
        updated_control = service.update_control_props(
            control_id,
            props_update=req.props.dict(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # neuen Katalog zurückschreiben
    new_content = service.to_json_str()
    fs.write_text(settings.SDM_PRIVACY_CATALOG_NAME, new_content)

    return updated_control
