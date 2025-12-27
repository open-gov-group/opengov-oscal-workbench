from fastapi import APIRouter, HTTPException

from ..models import SdmTomControlSummary, SdmTomControlDetail
from ..services.sdm_privacy_catalog_service import SdmPrivacyCatalogService

router = APIRouter(prefix="/api/sdm", tags=["sdm-privacy-catalog"])


@router.get("/controls", response_model=dict)
def list_sdm_controls():
    svc = SdmPrivacyCatalogService()
    items = svc.list_controls()
    return {"items": items}


@router.get(
    "/controls/{control_id}",
    response_model=SdmTomControlDetail,
)
def get_sdm_control(control_id: str):
    svc = SdmPrivacyCatalogService()
    ctrl = svc.get_control(control_id)
    if not ctrl:
        raise HTTPException(status_code=404, detail="Control not found")
    return ctrl


@router.put(
    "/controls/{control_id}",
    response_model=dict,
)
def update_sdm_control(control_id: str, data: SdmTomControlDetail):
    svc = SdmPrivacyCatalogService()
    try:
        result = svc.update_control(control_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
