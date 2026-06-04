from pathlib import Path
import tomlkit

DEFAULT_CONFIG = {
    "headscale": {
        "url": "",
        "api_key": "",
    },
    "compose": {
        "base_dir": "",
    },
}

class Config:
    def __init__(self):
        self.path = Path("./config/config.toml")
        self.data = self._load()

    def _load(self) -> tomlkit.TOMLDocument:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            doc = self._build_default()
            self.path.write_text(tomlkit.dumps(doc))
            return doc

        doc = tomlkit.parse(self.path.read_text())
        changed = self._fill_missing(doc, DEFAULT_CONFIG)
        if changed:
            self.path.write_text(tomlkit.dumps(doc))
        return doc

    def _build_default(self) -> tomlkit.TOMLDocument:
        doc = tomlkit.document()
        for section, values in DEFAULT_CONFIG.items():
            table = tomlkit.table()
            for k, v in values.items():
                table.add(k, v)
            doc.add(section, table)
        return doc

    def _fill_missing(self, doc: tomlkit.TOMLDocument, defaults: dict) -> bool:
        changed = False
        for section, values in defaults.items():
            if section not in doc:
                table = tomlkit.table()
                for k, v in values.items():
                    table.add(k, v)
                doc.add(section, table)
                changed = True
            else:
                for k, v in values.items():
                    if k not in doc[section]:
                        doc[section].add(k, v)
                        changed = True
        return changed

    def _save(self) -> None:
        self.path.write_text(tomlkit.dumps(self.data))

    def set(self, section: str, key: str, value) -> None:
        if section not in self.data:
            table = tomlkit.table()
            self.data.add(section, table)
        self.data[section][key] = value
        self._save()


cfg = Config()
HEADSCALE_URL    = cfg.data["headscale"]["url"]
HEADSCALE_APIKEY = cfg.data["headscale"]["api_key"]
COMPOSE_BASE_DIR = cfg.data["compose"]["base_dir"]


def update_api_key(new_key: str):
    global HEADSCALE_APIKEY
    cfg.set("headscale", "api_key", new_key)
    HEADSCALE_APIKEY = new_key

def update_headscale_url(new_url: str):
    global HEADSCALE_URL
    cfg.set("headscale", "url", new_url)
    HEADSCALE_URL = new_url

def update_compose_dir(new_dir: str):
    global COMPOSE_BASE_DIR
    cfg.set("compose", "base_dir", new_dir)
    COMPOSE_BASE_DIR = new_dir