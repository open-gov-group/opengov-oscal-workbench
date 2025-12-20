from fastapi import APIRouter, HTTPException

from ..models import FileContent, SaveRequest, SaveResponse
from ..services.file_service import FileService

router = APIRouter(prefix="/api", tags=["files"])


@router.get("/files/{name}", response_model=FileContent)
def get_file(name: str):
    fs = FileService()
    try:
        content = fs.read_text(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return FileContent(name=name, content=content)


@router.post("/save", response_model=SaveResponse)
def save_file(req: SaveRequest):
    fs = FileService()

    old_content = fs.read_text(req.name)
    diff = fs.diff(old_content, req.content)

    if req.previewOnly:
        return SaveResponse(mode="preview", written=False, diff=diff)

    # TODO: optional: Validation-Service vor Schreiben aufrufen
    fs.write_text(req.name, req.content)
    # TODO: optional: GitService.commit(...)
    return SaveResponse(mode="saved", written=True, diff=diff)
