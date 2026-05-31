import tomllib, re
from pathlib import Path

def get_path() -> Path:
    return Path("./config/config.toml")

def load() -> dict:
    with open(get_path(), "rb") as f:
        return tomllib.load(f)

def update_api_key(new_key: str):
    global cfg, HEADSCALE_APIKEY
    p = get_path()
    text = p.read_text()
    text = re.sub(r'(api_key\s*=\s*")[^"]*(")', rf'\g<1>{new_key}\2', text)
    p.write_text(text)
    cfg = load()
    HEADSCALE_APIKEY = cfg["headscale"]["api_key"]

def update_headscale_url(new_url: str):
    global cfg, HEADSCALE_URL
    p = get_path()
    text = p.read_text()
    text = re.sub(r'(url\s*=\s*")[^"]*(")', rf'\g<1>{new_url}\2', text)
    p.write_text(text)
    cfg = load()
    HEADSCALE_URL = cfg["headscale"]["url"]

def update_compose_dir(new_dir: str):
    global cfg, COMPOSE_BASE_DIR
    p = get_path()
    text = p.read_text()
    if '[compose]' in text:
        text = re.sub(r'(base_dir\s*=\s*")[^"]*(")', rf'\g<1>{new_dir}\2', text)
    else:
        text += f'\n[compose]\nbase_dir = "{new_dir}"\n'
    p.write_text(text)
    cfg = load()
    COMPOSE_BASE_DIR = cfg.get("compose", {}).get("base_dir", str(Path.home() / "docker"))


cfg = load()
HEADSCALE_URL    = cfg["headscale"]["url"]
HEADSCALE_APIKEY = cfg["headscale"]["api_key"]
COMPOSE_BASE_DIR = cfg.get("compose", {}).get("base_dir", str(Path.home() / "docker"))

# GLANCES_PORT     = cfg["glances"]["port"]
# SERVER_HOST      = cfg["server"]["host"]
# SERVER_PORT      = cfg["server"]["port"]