from fastapi import APIRouter, Body, HTTPException

from ..models import ( 
    PrivacyControlSummary, 
    PrivacyControlDetail, 
    PrivacyGroupSummary, 
    PrivacyGroupDetail, 
    PrivacyGroupCreateRequest, 
    PrivacyGroupUpdateRequest, 
    PrivacyGroupDeleteRequest
)
from ..services.privacy_catalog_service import PrivacyCatalogService

router = APIRouter(prefix="/api/privacy", tags=["privacy-catalog"])


# --------- Gruppen-Endpunkte ---------

@router.get("/groups", response_model=dict)
def list_privacy_groups():
    svc = PrivacyCatalogService()
    items = svc.list_groups()
    # für das Frontend-Konsistenz mit /controls (items-Array)
    return {"items": items}


@router.post("/groups", response_model=PrivacyGroupDetail)
def create_privacy_group(req: PrivacyGroupCreateRequest):
    svc = PrivacyCatalogService()
    try:
        return svc.create_group(req.id, req.title, req.description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/groups/{group_id}", response_model=PrivacyGroupDetail)
def update_privacy_group(group_id: str, req: PrivacyGroupUpdateRequest):
    svc = PrivacyCatalogService()
    try:
        return svc.update_group(
            group_id=group_id,
            title=req.title,
            description=req.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/groups/{group_id}", response_model=dict)
def delete_privacy_group(
    group_id: str,
    req: PrivacyGroupDeleteRequest = Body(
        default=PrivacyGroupDeleteRequest(),
        description="Optional: Zielgruppe zum Reassign & Flag zum Löschen nicht-leerer Gruppen",
    ),
):
    svc = PrivacyCatalogService()
    try:
        result = svc.delete_group(
            group_id=group_id,
            reassign_to=req.reassignTo,
            allow_delete_non_empty=req.allowDeleteNonEmpty,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result

#------ controls endpoints ---------------

@router.get("/controls", response_model=dict)
def list_privacy_controls():
    svc = PrivacyCatalogService()
    items = svc.list_controls()
    return {"items": items}


@router.get(
    "/controls/{control_id}",
    response_model=PrivacyControlDetail,
)
def get_privacy_control(control_id: str):
    svc = PrivacyCatalogService()
    ctrl = svc.get_control(control_id)
    if not ctrl:
        raise HTTPException(status_code=404, detail="Control not found")
    return ctrl


@router.put(
    "/controls/{control_id}",
    response_model=dict,
)
def update_privacy_control(control_id: str, data: PrivacyControlDetail):
    svc = PrivacyCatalogService()
    try:
        result = svc.update_control(control_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
