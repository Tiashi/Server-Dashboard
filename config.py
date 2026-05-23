import tomllib
from pathlib import Path

_DEFAULT = Path(__file__).parent / "config" / "config.toml"
_PATH    = Path("/config/config.toml")  # path dentro il container

def load() -> dict:
    p = _PATH if _PATH.exists() else _DEFAULT
    with open(p, "rb") as f:
        return tomllib.load(f)

cfg = load()

HEADSCALE_URL    = cfg["headscale"]["url"]
HEADSCALE_APIKEY = cfg["headscale"]["api_key"]
GLANCES_PORT     = cfg["glances"]["port"]
SERVER_HOST      = cfg["server"]["host"]
SERVER_PORT      = cfg["server"]["port"]