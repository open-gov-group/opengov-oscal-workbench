from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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



class FileDiffRequest(BaseModel):
    updated: str  # neue JSON-Version als String


@router.post("/files/{name}/diff")
def diff_file(name: str, req: FileDiffRequest):
    """
    Vergleicht die aktuell gespeicherte Datei {name} mit der übergebenen
    neuen Version und liefert einen strukturierten JSON-Diff zurück.
    Die Datei wird dabei NICHT überschrieben.
    """
    fs = FileService()
    try:
        diff = fs.diff_current_and_new(name, req.updated)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="File not found – prüfe Dateinamen und config.py",
        )
    except ValueError as e:
        # z.B. unknown file name oder ungültiges JSON
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Erzeugen des Diffs: {e}",
        )

    return {"name": name, "diff": diff}


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
