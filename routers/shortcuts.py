import json
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
DATA_FILE = Path("data/shortcuts.json")
DATA_FILE.parent.mkdir(exist_ok=True)

def load() -> list:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())

def save(data: list):
    DATA_FILE.write_text(json.dumps(data, indent=2))

class Shortcut(BaseModel):
    id: str | None = None
    name: str
    url: str
    icon: str = "🔗"

@router.get("")
def get_shortcuts():
    return load()

@router.post("")
def add_shortcut(shortcut: Shortcut):
    data = load()
    shortcut.id = str(uuid.uuid4())
    data.append(shortcut.model_dump())
    save(data)
    return shortcut

@router.delete("/{shortcut_id}")
def delete_shortcut(shortcut_id: str):
    data = load()
    new_data = [s for s in data if s["id"] != shortcut_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="Not found")
    save(new_data)
    return {"ok": True}
