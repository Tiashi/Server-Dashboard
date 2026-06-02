import subprocess
import re
import yaml
import json as _json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import docker as docker_sdk
import config as cfg_module

router = APIRouter()

# ── Docker client ─────────────────────────────────────────────
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

# ── Compose helpers ───────────────────────────────────────────
def _base_dir() -> Path:
    return Path(cfg_module.COMPOSE_BASE_DIR).expanduser()

def _compose_path(app: str) -> Path:
    p = _base_dir() / app / "docker-compose.yaml"
    if not p.exists():
        p2 = _base_dir() / app / "docker-compose.yml"
        if p2.exists():
            return p2
        raise HTTPException(404, f"docker-compose.yaml non trovato per '{app}'")
    return p

def _run_compose(app: str, *args, timeout: int = 120) -> str:
    compose_file = _compose_path(app)
    cmd = ["docker", "compose", "-f", str(compose_file)] + list(args)
    result = subprocess.run(
        cmd,
        capture_output=True, text=True,
        timeout=timeout,
        cwd=str(compose_file.parent)
    )
    output = result.stdout + result.stderr
    if result.returncode != 0:
        raise HTTPException(500, output.strip() or f"Comando fallito (exit {result.returncode})")
    return output

def _parse_images(app: str) -> list[dict]:
    compose_file = _compose_path(app)
    data = yaml.safe_load(compose_file.read_text())
    result = []
    for svc_name, svc in (data.get("services") or {}).items():
        image = svc.get("image")
        if not image:
            continue
        repo, tag = image.rsplit(":", 1) if ":" in image else (image, "latest")
        result.append({"service": svc_name, "image": image, "repo": repo, "tag": tag})
    return result

def _update_image_tag(app: str, service: str, new_tag: str):
    """Aggiorna il tag di un servizio nel docker-compose.yaml."""
    compose_file = _compose_path(app)
    content = compose_file.read_text()
    
    # Trova la riga image: del servizio e aggiorna il tag
    lines = content.splitlines(keepends=True)
    in_service = False
    service_indent = None
    new_lines = []
    
    for line in lines:
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        
        # Rileva ingresso nel blocco del servizio target
        if stripped.startswith(f"{service}:") and (service_indent is None or indent == service_indent):
            in_service = True
            service_indent = indent
        elif in_service and indent <= service_indent and stripped and not stripped.startswith("#"):
            # Usciti dal blocco del servizio
            in_service = False
        
        if in_service and re.match(r'\s*image\s*:', line):
            # Sostituisce o aggiunge il tag
            match = re.match(r'(\s*image\s*:\s*)([^\s#]+)(.*)', line)
            if match:
                img = match.group(2).strip('"\'')
                if ":" in img:
                    repo = img.rsplit(":", 1)[0]
                else:
                    repo = img
                new_img = f"{repo}:{new_tag}"
                line = f"{match.group(1)}{new_img}{match.group(3)}\n"
        new_lines.append(line)
    
    compose_file.write_text("".join(new_lines))


# ══════════════════════════════════════════════════════════════
# CONTAINER LOGS
# ══════════════════════════════════════════════════════════════

@router.get("/log-parsers")
def get_log_parsers():
    path = Path("config/docker_logs.json")
    if not path.exists():
        return {}
    import json as _json
    return _json.loads(path.read_text())

# ══════════════════════════════════════════════════════════════
# COMPOSE SETTINGS
# ══════════════════════════════════════════════════════════════

@router.get("/compose/settings")
def get_compose_settings():
    return {"base_dir": str(_base_dir())}

class ComposeSettings(BaseModel):
    base_dir: str

@router.patch("/compose/settings")
def update_compose_settings(body: ComposeSettings):
    try:
        cfg_module.update_compose_dir(body.base_dir)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

# ══════════════════════════════════════════════════════════════
# COMPOSE STACKS
# ══════════════════════════════════════════════════════════════

@router.get("/compose/stacks")
def list_stacks():
    base = _base_dir()
    if not base.exists():
        return []
    stacks = []
    for d in sorted(base.iterdir()):
        if not d.is_dir():
            continue
        yaml_path = d / "docker-compose.yaml"
        yml_path  = d / "docker-compose.yml"
        if not yaml_path.exists() and not yml_path.exists():
            continue
        stacks.append({"name": d.name, "path": str(yaml_path if yaml_path.exists() else yml_path)})
    return stacks

@router.get("/compose/stacks/{app}/status")
def stack_status(app: str):
    """Restituisce i container dello stack con il loro stato."""
    try:
        output = _run_compose(app, "ps", "--all", "--format", "json")
        import json
        containers = []
        for line in output.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                containers.append({
                    "name":    obj.get("Name", ""),
                    "service": obj.get("Service", ""),
                    "status":  obj.get("Status", ""),
                    "state":   obj.get("State", ""),
                    "ports":   obj.get("Publishers", []),
                })
            except json.JSONDecodeError:
                continue
        return {"ok": True, "containers": containers}
    except HTTPException as e:
        return {"ok": False, "containers": [], "error": e.detail}

@router.post("/compose/stacks/{app}/up")
def stack_up(app: str):
    output = _run_compose(app, "up", "-d", "--remove-orphans")
    return {"ok": True, "output": output}

@router.post("/compose/stacks/{app}/down")
def stack_down(app: str):
    output = _run_compose(app, "down")
    return {"ok": True, "output": output}

@router.post("/compose/stacks/{app}/restart")
def stack_restart(app: str):
    output = _run_compose(app, "restart")
    return {"ok": True, "output": output}

@router.post("/compose/stacks/{app}/pull")
def stack_pull(app: str):
    output = _run_compose(app, "pull", timeout=300)
    return {"ok": True, "output": output}

@router.get("/compose/stacks/{app}/logs")
def stack_logs(app: str, tail: int = 200):
    output = _run_compose(app, "logs", "--no-color", f"--tail={tail}")
    return {"logs": output}

@router.get("/compose/stacks/{app}/images")
def stack_images(app: str):
    return _parse_images(app)

class UpdateImageBody(BaseModel):
    service: str
    tag: str

@router.post("/compose/stacks/{app}/images/update")
def update_image(app: str, body: UpdateImageBody):
    _update_image_tag(app, body.service, body.tag)
    return {"ok": True}

@router.post("/compose/stacks/{app}/images/update-and-deploy")
def update_and_deploy(app: str, body: UpdateImageBody):
    _update_image_tag(app, body.service, body.tag)
    pull_out = _run_compose(app, "pull", timeout=300)
    up_out   = _run_compose(app, "up", "-d", "--remove-orphans")
    return {"ok": True, "output": pull_out + "\n" + up_out}

# ══════════════════════════════════════════════════════════════
# CONTAINER SINGOLI (mantenuti per compatibilità)
# ══════════════════════════════════════════════════════════════

@router.get("/containers")
def list_containers():
    return [_fmt(c) for c in _client().containers.list(all=True)]

@router.post("/containers/{container_id}/start")
def start_container(container_id: str):
    try:
        _client().containers.get(container_id).start()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/containers/{container_id}/stop")
def stop_container(container_id: str):
    try:
        _client().containers.get(container_id).stop()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/containers/{container_id}/logs")
def get_logs(container_id: str, tail: int = 500):
    tail = min(tail, 2000)  # cap massimo
    try:
        c = _client().containers.get(container_id)
        logs = c.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/images")
def list_images():
    images = _client().images.list()
    result = []
    for img in images:
        tags = img.tags or [img.short_id]
        result.append({
            "id":      img.short_id,
            "tags":    tags,
            "size":    img.attrs.get("Size", 0),
            "created": img.attrs.get("Created", ""),
        })
    return result

@router.post("/images/prune")
def prune_images():
    result = _client().images.prune(filters={"dangling": True})
    reclaimed = result.get("SpaceReclaimed", 0)
    return {"ok": True, "reclaimed": reclaimed}

@router.get("/networks")
def list_networks():
    result = []
    for net in _client().networks.list():
        net.reload()
        containers = [
            { "name": c.get("Name", ""), "ipv4": c.get("IPv4Address", "—") }
            for c in (net.attrs.get("Containers") or {}).values()
        ]
        ipam = net.attrs.get("IPAM", {}).get("Config") or [{}]
        result.append({
            "id":         net.id[:12],
            "name":       net.name,
            "driver":     net.attrs.get("Driver", ""),
            "subnet":     ipam[0].get("Subnet", "—"),
            "gateway":    ipam[0].get("Gateway", "—"),
            "containers": containers,
        })
    return result