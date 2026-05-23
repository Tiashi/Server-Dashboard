from fastapi import APIRouter, HTTPException
import docker as docker_sdk

router = APIRouter()

def _client():
    try:
        return docker_sdk.from_env()
    except Exception as e:
        raise HTTPException(503, f"Docker non raggiungibile: {e}")

def _fmt(c) -> dict:
    ports = []
    for k, v in (c.ports or {}).items():
        if v:
            ports.append(f"{v[0]['HostPort']}→{k}")
        else:
            ports.append(k)
    return {
        "id":     c.short_id,
        "name":   c.name,
        "status": c.status,
        "image":  c.image.tags[0] if c.image.tags else c.image.short_id,
        "ports":  ", ".join(ports),
    }

@router.get("")
def list_containers():
    return [_fmt(c) for c in _client().containers.list(all=True)]

@router.post("/{container_id}/start")
def start_container(container_id: str):
    try:
        _client().containers.get(container_id).start()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/{container_id}/stop")
def stop_container(container_id: str):
    try:
        _client().containers.get(container_id).stop()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/{container_id}/logs")
def get_logs(container_id: str, tail: int = 100):
    try:
        c = _client().containers.get(container_id)
        logs = c.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(500, str(e))