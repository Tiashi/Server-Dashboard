from pathlib import Path
import tomlkit

def get_path() -> Path:
    return Path("./config/config.toml")

def load() -> tomlkit.TOMLDocument:
    return tomlkit.parse(get_path().read_text())

def update_api_key(new_key: str):
    global cfg, HEADSCALE_APIKEY
    doc = load()
    doc["headscale"]["api_key"] = new_key
    _save(doc)
    cfg = load()
    HEADSCALE_APIKEY = cfg["headscale"]["api_key"]

def update_headscale_url(new_url: str):
    global cfg, HEADSCALE_URL
    doc = load()
    doc["headscale"]["url"] = new_url
    _save(doc)
    cfg = load()
    HEADSCALE_URL = cfg["headscale"]["url"]

def update_compose_dir(new_dir: str):
    global cfg, COMPOSE_BASE_DIR
    doc = load()
    if "compose" not in doc:
        doc.add("compose", tomlkit.table())
    doc["compose"]["base_dir"] = new_dir
    _save(doc)
    cfg = load()
    COMPOSE_BASE_DIR = cfg.get("compose", {}).get("base_dir", str(Path.home() / "docker"))


cfg = load()
HEADSCALE_URL    = cfg["headscale"]["url"]
HEADSCALE_APIKEY = cfg["headscale"]["api_key"]
COMPOSE_BASE_DIR = cfg.get("compose", {}).get("base_dir", str(Path.home() / "docker"))

# GLANCES_PORT     = cfg["glances"]["port"]
# SERVER_HOST      = cfg["server"]["host"]
# SERVER_PORT      = cfg["server"]["port"]