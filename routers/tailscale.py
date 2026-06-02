import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import config as cfg_module

router = APIRouter()

def _get_key():
    return cfg_module.HEADSCALE_APIKEY

def _base_url():
    return cfg_module.HEADSCALE_URL

def _headers():
    return {"Authorization": f"Bearer {_get_key()}"}

async def _get(path: str):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{_base_url()}/api/v1{path}", headers=_headers())
        r.raise_for_status()
        return r.json()

async def _post(path: str, body: dict = {}, params: dict = {}):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{_base_url()}/api/v1{path}", headers=_headers(), json=body, params=params)
        r.raise_for_status()
        return r.json()

async def _delete(path: str):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.delete(f"{_base_url()}/api/v1{path}", headers=_headers())
        r.raise_for_status()
        return r.json()

# ── Modelli ───────────────────────────────────────────────────
class RenameNode(BaseModel):
    name: str

class MoveNode(BaseModel):
    user: str

class RegisterNode(BaseModel):
    user: str
    key: str

class CreateUser(BaseModel):
    name: str

class RenameUser(BaseModel):
    new_name: str

class SetConfig(BaseModel):
    url: Optional[str] = None
    key: Optional[str] = None

# ── Formattatori ──────────────────────────────────────────────
def _fmt_node(n: dict) -> dict:
    addrs = n.get("ipAddresses", [])
    routes = n.get("enabledRoutes", []) or []
    advertised = n.get("availableRoutes", []) or []
    is_exit = any(r in ["0.0.0.0/0", "::/0"] for r in routes)
    return {
        "id":                n.get("id", ""),
        "name":              n.get("name", ""),
        "given_name":        n.get("givenName", ""),
        "ip":                addrs[0] if addrs else "",
        "online":            n.get("online", False),
        "user":              n.get("user", {}).get("name", ""),
        "last_seen":         n.get("lastSeen", ""),
        "created":           n.get("createdAt", ""),
        "is_exit_node":      is_exit,
        "routes_advertised": advertised,
        "os":                n.get("os", ""),
    }

def _fmt_user(u: dict) -> dict:
    return {
        "id":      u.get("id", ""),
        "name":    u.get("name", ""),
        "created": u.get("createdAt", ""),
    }

# ══════════════════════════════════════════════════════════════
# NODI
# ══════════════════════════════════════════════════════════════

@router.get("/nodes")
async def list_nodes():
    try:
        data = await _get("/node")
        return [_fmt_node(n) for n in data.get("nodes", [])]
    except httpx.ConnectError:
        raise HTTPException(503, "Headscale non raggiungibile")
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/nodes/register")
async def register_node(body: RegisterNode):
    try:
        data = await _post("/node/register", params={"user": body.user, "key": body.key})
        return {"ok": True, "node": _fmt_node(data.get("node", {}))}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/nodes/{node_id}/rename")
async def rename_node(node_id: str, body: RenameNode):
    try:
        await _post(f"/node/{node_id}/rename/{body.name}")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/nodes/{node_id}/move")
async def move_node(node_id: str, body: MoveNode):
    try:
        await _post(f"/node/{node_id}/user", {"user": body.user})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    try:
        await _delete(f"/node/{node_id}")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

# ══════════════════════════════════════════════════════════════
# UTENTI
# ══════════════════════════════════════════════════════════════

@router.get("/users")
async def list_users():
    try:
        data = await _get("/user")
        users = [_fmt_user(u) for u in data.get("users", [])]
        nodes_data = await _get("/node")
        counts = {}
        for n in nodes_data.get("nodes", []):
            u = n.get("user", {}).get("name", "")
            counts[u] = counts.get(u, 0) + 1
        for u in users:
            u["node_count"] = counts.get(u["name"], 0)
        return users
    except httpx.ConnectError:
        raise HTTPException(503, "Headscale non raggiungibile")
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/users")
async def create_user(body: CreateUser):
    try:
        data = await _post("/user", {"name": body.name})
        return _fmt_user(data.get("user", {}))
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/users/{user_id}/rename")
async def rename_user(user_id: str, body: RenameUser):
    try:
        await _post(f"/user/{user_id}/rename/{body.new_name}")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    try:
        await _delete(f"/user/{user_id}")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

# ══════════════════════════════════════════════════════════════
# SESSIONE / API KEYS
# ══════════════════════════════════════════════════════════════

@router.get("/session/status")
async def session_status():
    key = _get_key()
    url = _base_url()
    if not key:
        return {"has_key": False, "valid": False, "prefix": None, "url": url}
    try:
        await _get("/node")
        return {"has_key": True, "valid": True, "prefix": key[:7] + "...", "url": url}
    except Exception:
        return {"has_key": True, "valid": False, "prefix": key[:7] + "...", "url": url}

@router.patch("/session/config")
async def update_config(body: SetConfig):
    try:
        if body.url is not None:
            cfg_module.update_headscale_url(body.url.rstrip('/'))
        if body.key is not None:
            cfg_module.update_api_key(body.key)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/session/key")
async def forget_api_key():
    """Svuota la chiave nel config.toml."""
    try:
        cfg_module.update_api_key("")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/session/keys")
async def list_api_keys():
    try:
        data = await _get("/apikey")
        return [{
            "id":         k.get("id", ""),
            "prefix":     k.get("prefix", ""),
            "expiration": k.get("expiration", ""),
            "created":    k.get("createdAt", ""),
            "last_seen":  k.get("lastSeen", ""),
        } for k in data.get("apiKeys", [])]
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/session/keys/expire")
async def expire_api_key(request: Request):
    try:
        body = await request.json()
        await _post("/apikey/expire", {"prefix": body.get("prefix", "")})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))