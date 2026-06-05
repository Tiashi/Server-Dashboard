import subprocess
import re
import yaml
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import docker as docker_sdk
import config as cfg_module

router = APIRouter()

# ── Docker client ─────────────────────────────────────────────

def _client():
    try:
        return docker_sdk.from_env()
    except Exception as e:
        raise HTTPException(503, f"Docker non raggiungibile: {e}")

# ── Compose helpers ───────────────────────────────────────────

def _base_dir() -> Path:
    return Path(cfg_module.COMPOSE_BASE_DIR).expanduser()

def _compose_path(app: str) -> Path:
    for name in ("docker-compose.yaml", "docker-compose.yml"):
        p = _base_dir() / app / name
        if p.exists():
            return p
    raise HTTPException(404, f"docker-compose.yaml non trovato per '{app}'")

def _run_compose(app: str, *args, timeout: int = 120) -> str:
    compose_file = _compose_path(app)
    cmd = ["docker", "compose", "-f", str(compose_file)] + list(args)
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        timeout=timeout, cwd=str(compose_file.parent)
    )
    output = result.stdout + result.stderr
    if result.returncode != 0:
        raise HTTPException(500, output.strip() or f"Comando fallito (exit {result.returncode})")
    return output

def _parse_images(app: str) -> list[dict]:
    data = yaml.safe_load(_compose_path(app).read_text())
    result = []
    for svc_name, svc in (data.get("services") or {}).items():
        image = svc.get("image")
        if not image:
            continue
        repo, tag = image.rsplit(":", 1) if ":" in image else (image, "latest")
        result.append({"service": svc_name, "image": image, "repo": repo, "tag": tag})
    return result

def _update_image_tag(app: str, service: str, new_tag: str):
    compose_file = _compose_path(app)
    lines = compose_file.read_text().splitlines(keepends=True)
    in_service = False
    service_indent = None
    new_lines = []
    for line in lines:
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if stripped.startswith(f"{service}:") and (service_indent is None or indent == service_indent):
            in_service = True
            service_indent = indent
        elif in_service and indent <= service_indent and stripped and not stripped.startswith("#"):
            in_service = False
        if in_service and re.match(r'\s*image\s*:', line):
            m = re.match(r'(\s*image\s*:\s*)([^\s#]+)(.*)', line)
            if m:
                img = m.group(2).strip('"\'')
                repo = img.rsplit(":", 1)[0] if ":" in img else img
                line = f"{m.group(1)}{repo}:{new_tag}{m.group(3)}\n"
        new_lines.append(line)
    compose_file.write_text("".join(new_lines))

# ── Formattatori ──────────────────────────────────────────────

def _fmt_container(c) -> dict:
    ports = []
    for k, v in (c.ports or {}).items():
        ports.append(f"{v[0]['HostPort']}→{k}" if v else k)
    return {
        "id":     c.short_id,
        "name":   c.name,
        "status": c.status,
        "image":  c.image.tags[0] if c.image.tags else c.image.short_id,
        "ports":  ", ".join(ports),
    }

# ── Modelli ───────────────────────────────────────────────────

class ComposeSettings(BaseModel):
    base_dir: str

class UpdateImageBody(BaseModel):
    service: str
    tag: str

# ══════════════════════════════════════════════════════════════
# LOG PARSERS
# ══════════════════════════════════════════════════════════════

@router.get("/log-parsers")
def get_log_parsers():
    path = Path("config/docker_logs.json")
    if not path.exists():
        return {}
    return json.loads(path.read_text())

# ══════════════════════════════════════════════════════════════
# COMPOSE SETTINGS
# ══════════════════════════════════════════════════════════════

@router.get("/compose/settings")
def get_compose_settings():
    return {"base_dir": str(_base_dir())}

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
    return [
        {"name": d.name, "path": str(next(p for p in (d / "docker-compose.yaml", d / "docker-compose.yml") if p.exists()))}
        for d in sorted(base.iterdir())
        if d.is_dir() and any((d / n).exists() for n in ("docker-compose.yaml", "docker-compose.yml"))
    ]

@router.get("/compose/stacks/{app}/status")
def stack_status(app: str):
    try:
        output = _run_compose(app, "ps", "--all", "--format", "json")
        containers = []
        for line in output.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                containers.append({
                    "name":    obj.get("Name", ""),
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
    return {"ok": True, "output": _run_compose(app, "up", "-d", "--remove-orphans")}

@router.post("/compose/stacks/{app}/down")
def stack_down(app: str):
    return {"ok": True, "output": _run_compose(app, "down")}

@router.post("/compose/stacks/{app}/pull")
def stack_pull(app: str):
    return {"ok": True, "output": _run_compose(app, "pull", timeout=300)}

@router.get("/compose/stacks/{app}/images")
def stack_images(app: str):
    return _parse_images(app)

@router.post("/compose/stacks/{app}/images/update")
def update_image(app: str, body: UpdateImageBody):
    _update_image_tag(app, body.service, body.tag)
    return {"ok": True}

@router.post("/compose/stacks/{app}/images/update-and-deploy")
def update_and_deploy(app: str, body: UpdateImageBody):
    _update_image_tag(app, body.service, body.tag)
    return {"ok": True, "output": _run_compose(app, "pull", timeout=300) + "\n" + _run_compose(app, "up", "-d", "--remove-orphans")}

# ══════════════════════════════════════════════════════════════
# CONTAINER SINGOLI
# ══════════════════════════════════════════════════════════════

@router.get("/containers")
def list_containers():
    return [_fmt_container(c) for c in _client().containers.list(all=True)]

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
    try:
        c = _client().containers.get(container_id)
        logs = c.logs(tail=min(tail, 2000), timestamps=True).decode("utf-8", errors="replace")
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(500, str(e))

# ══════════════════════════════════════════════════════════════
# IMMAGINI
# ══════════════════════════════════════════════════════════════

@router.get("/images")
def list_images():
    return [
        {
            "id":      img.short_id,
            "tags":    img.tags or [img.short_id],
            "size":    img.attrs.get("Size", 0),
            "created": img.attrs.get("Created", ""),
        }
        for img in _client().images.list()
    ]



# ══════════════════════════════════════════════════════════════
# RETI
# ══════════════════════════════════════════════════════════════

@router.get("/networks")
def list_networks():
    result = []
    for net in _client().networks.list():
        net.reload()
        containers = [
            {"name": c.get("Name", ""), "ipv4": c.get("IPv4Address", "—")}
            for c in (net.attrs.get("Containers") or {}).values()
        ]
        ipam = net.attrs.get("IPAM", {}).get("Config") or [{}]
        result.append({
            "id":         net.id[:12],
            "name":       net.name,
            "driver":     net.attrs.get("Driver", ""),
            "subnet":     ipam[0].get("Subnet", "—"),
            "gateway":    ipam[0].get("Gateway") or "—",
            "containers": containers,
        })
    return result


# ══════════════════════════════════════════════════════════════
# Purne Endpoint
# ══════════════════════════════════════════════════════════════

@router.post("/images/prune")
def prune_images():
    result = _client().images.prune(filters={"dangling": True})
    return {"ok": True, "reclaimed": result.get("SpaceReclaimed", 0)}

@router.post("/containers/prune")
def prune_containers():
    result = _client().containers.prune()
    return {"ok": True, "reclaimed": result.get("SpaceReclaimed", 0), "count": len(result.get("ContainersDeleted") or [])}

@router.post("/networks/prune")
def prune_networks():
    result = _client().networks.prune()
    return {"ok": True, "count": len(result.get("NetworksDeleted") or [])}