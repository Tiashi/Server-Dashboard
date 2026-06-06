import subprocess
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


def _run(cmd: list[str], input: str = None) -> str:
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        input=input, timeout=10
    )
    return (result.stdout + result.stderr).strip()


def _ufw_status_raw() -> str:
    return _run(["ufw", "status", "verbose"])


# ── Modelli ───────────────────────────────────────────────────

class AddRule(BaseModel):
    direction: str        # in / out
    action: str           # allow / deny / reject
    port: Optional[str] = None
    proto: Optional[str] = None   # tcp / udp / any
    from_ip: Optional[str] = None
    to_ip: Optional[str] = None
    comment: Optional[str] = None

class DefaultPolicy(BaseModel):
    direction: str   # incoming / outgoing
    policy: str      # allow / deny / reject


# ── Helpers parsing ───────────────────────────────────────────

def _parse_status(raw: str) -> dict:
    enabled = "Status: active" in raw

    default_in  = re.search(r"Default:.*?(\w+)\s+\(incoming\)", raw)
    default_out = re.search(r"Default:.*?(\w+)\s+\(outgoing\)", raw)

    rules = []
    lines = raw.splitlines()
    in_table = False

    for line in lines:
        # La riga separatore è "-- ------ ----"
        if re.match(r"^--\s+-{4,}", line):
            in_table = True
            continue
        if not in_table:
            continue
        line_s = line.strip()
        if not line_s:
            continue

        # Formato: "To   Action      From"
        # Colonne allineate a spazi — splittiamo su 2+ spazi
        parts = re.split(r'\s{2,}', line_s)
        if len(parts) < 3:
            continue

        to     = parts[0].strip()
        action = parts[1].strip()
        from_  = parts[2].strip()

        # Commento inline (raro in verbose, ma gestiamolo)
        comment = parts[3].strip() if len(parts) > 3 else ""

        rules.append({
            "to":      to,
            "action":  action,
            "from":    from_,
            "comment": comment,
        })

    return {
        "enabled":     enabled,
        "default_in":  default_in.group(1)  if default_in  else "deny",
        "default_out": default_out.group(1) if default_out else "allow",
        "rules":       rules,
    }


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/status")
def get_status():
    try:
        raw = _ufw_status_raw()
        return _parse_status(raw)
    except FileNotFoundError:
        raise HTTPException(503, "ufw non trovato nel sistema")
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/enable")
def enable_firewall():
    try:
        _run(["ufw", "--force", "enable"])
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/disable")
def disable_firewall():
    try:
        _run(["ufw", "disable"])
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/rules")
def add_rule(body: AddRule):
    try:
        cmd = ["ufw"]

        if body.direction == "out":
            cmd.append("route") if body.to_ip else None

        # Azione + direzione
        action_dir = body.action
        if body.direction == "in":
            action_dir = f"{body.action}"
        cmd.append(action_dir)

        if body.direction in ("in", "out"):
            cmd += ["proto", body.proto] if body.proto and body.proto != "any" else []

        # From
        if body.from_ip and body.from_ip not in ("", "Anywhere", "any"):
            cmd += ["from", body.from_ip]
        else:
            cmd += ["from", "any"]

        # To / port
        cmd += ["to", "any"]
        if body.port:
            cmd += ["port", body.port]

        if body.proto and body.proto != "any" and "proto" not in cmd:
            cmd += ["proto", body.proto]

        if body.comment:
            cmd += ["comment", body.comment]

        out = _run(cmd)
        if "ERROR" in out.upper():
            raise HTTPException(400, out)
        return {"ok": True, "output": out}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/rules")
def delete_rule(to: str, action: str, from_: str):
    """
    Elimina una regola passando i suoi campi.
    ufw delete allow from X to Y port Z
    """
    try:
        # Ricostruiamo il comando da cancellare basandoci sulla rappresentazione
        # più semplice: ufw delete <rule-spec>
        # Usiamo "ufw --force delete" con numero riga dalla status numbered
        raw = _run(["ufw", "status", "numbered"])
        lines = raw.splitlines()
        target_num = None
        for line in lines:
            m = re.match(r"^\[\s*(\d+)\]\s+(.+?)\s{2,}(.+?)\s{2,}(.+)$", line)
            if m:
                num, t, a, f = m.group(1), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
                if t == to and a == action and f == from_:
                    target_num = num
                    break

        if not target_num:
            raise HTTPException(404, "Regola non trovata")

        out = _run(["ufw", "--force", "delete", target_num])
        return {"ok": True, "output": out}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/default")
def set_default(body: DefaultPolicy):
    try:
        out = _run(["ufw", "default", body.policy, body.direction])
        if "ERROR" in out.upper():
            raise HTTPException(400, out)
        return {"ok": True, "output": out}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/reset")
def reset_firewall():
    try:
        out = _run(["ufw", "--force", "reset"])
        return {"ok": True, "output": out}
    except Exception as e:
        raise HTTPException(500, str(e))