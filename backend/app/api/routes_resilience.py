from fastapi import APIRouter, HTTPException

from ..models import SecurityControl, SecurityControlUpdateRequest
from ..services.file_service import FileService
from ..services.resilience_catalog_service import ResilienceCatalogService
from ..config import settings

router = APIRouter(prefix="/api/resilience", tags=["resilience"])


@router.get("/controls", response_model=dict)
def list_resilience_controls():
    fs = FileService()
    try:
        content = fs.read_text(settings.RESILIENCE_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="resilience_baseline_catalog.json not found – check config.py and data/ path",
        )

    service = ResilienceCatalogService.from_json_str(content)
    items = service.list_controls()
    return {"items": items}


@router.get("/controls/{control_id}", response_model=SecurityControl)
def get_resilience_control(control_id: str):
    fs = FileService()
    try:
        content = fs.read_text(settings.RESILIENCE_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="resilience_baseline_catalog.json not found – check config.py and data/ path",
        )

    service = ResilienceCatalogService.from_json_str(content)
    control = service.get_control(control_id)
    if not control:
        raise HTTPException(status_code=404, detail="Security control not found")
    return control


@router.put("/controls/{control_id}", response_model=SecurityControl)
def update_resilience_control(control_id: str, req: SecurityControlUpdateRequest):
    fs = FileService()
    try:
        content = fs.read_text(settings.RESILIENCE_CATALOG_NAME)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="resilience_baseline_catalog.json not found – check config.py and data/ path",
        )

    service = ResilienceCatalogService.from_json_str(content)

    try:
        updated = service.update_control(
            control_id,
            updates=req.dict(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    new_content = service.to_json_str()
    fs.write_text(settings.RESILIENCE_CATALOG_NAME, new_content)

    return updated
