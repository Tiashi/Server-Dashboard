import httpx
from fastapi import APIRouter, HTTPException
from config import HEADSCALE_URL, HEADSCALE_APIKEY

router = APIRouter()

def _fmt_node(node: dict) -> dict:
    addrs = node.get("ipAddresses", [])
    return {
        "id":        node.get("id", ""),
        "name":      node.get("name", ""),
        "ip":        addrs[0] if addrs else "",
        "online":    node.get("online", False),
        "os":        node.get("givenName", ""),
        "last_seen": node.get("lastSeen", ""),
    }

@router.get("")
async def get_hosts():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{HEADSCALE_URL}/api/v1/node",
                headers={"Authorization": f"Bearer {HEADSCALE_APIKEY}"},
            )
            r.raise_for_status()
            nodes = r.json().get("nodes", [])
            return [_fmt_node(n) for n in nodes]
    except httpx.ConnectError:
        raise HTTPException(503, "Headscale non raggiungibile")
    except Exception as e:
        raise HTTPException(500, str(e))
