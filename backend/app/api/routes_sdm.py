from fastapi import APIRouter, HTTPException

from ..models import SdmControlSummary, SdmControlDetail
from ..services.file_service import FileService
from ..services.sdm_catalog_service import SdmCatalogService
from ..config import settings

router = APIRouter(prefix="/api/sdm", tags=["sdm"])


@router.get("/controls", response_model=dict)
def list_sdm_controls():
    fs = FileService()
    content = fs.read_text(settings.SDM_PRIVACY_CATALOG_NAME)
    service = SdmCatalogService.from_json_str(content)
    items = service.list_controls()
    return {"items": items}


@router.get("/controls/{control_id}", response_model=SdmControlDetail)
def get_sdm_control(control_id: str):
    fs = FileService()
    content = fs.read_text(settings.SDM_PRIVACY_CATALOG_NAME)
    service = SdmCatalogService.from_json_str(content)
    control = service.get_control(control_id)
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    return control
