from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()

CA_PATH = Path.home() / ".local/share/mkcert/rootCA.pem"

@router.get("/download")
def download_ca():
    if not CA_PATH.exists():
        raise HTTPException(404, "File CA non trovato")
    return FileResponse(CA_PATH, media_type="application/x-pem-file", filename="rootCA.pem")