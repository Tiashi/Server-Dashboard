import os
import asyncio
import ptyprocess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"

@router.websocket("/terminal")
async def terminal_ws(websocket: WebSocket):
    await websocket.accept()

    shell = os.environ.get("SHELL", "/bin/bash")
    try:
        proc = ptyprocess.PtyProcess.spawn([shell], env={**os.environ, "TERM": "xterm-256color"})
    except Exception as e:
        await websocket.send_text(f"\r\n[Errore avvio shell: {e}]\r\n")
        await websocket.close()
        return

    loop = asyncio.get_event_loop()

    async def pty_to_ws():
        """Read from pty, send to browser."""
        while True:
            try:
                data = await loop.run_in_executor(None, proc.read, 1024)
                await websocket.send_bytes(data)
            except EOFError:
                break
            except Exception:
                break

    async def ws_to_pty():
        """Read from browser, write to pty."""
        while True:
            try:
                msg = await websocket.receive()
                if "bytes" in msg:
                    proc.write(msg["bytes"])
                elif "text" in msg:
                    # resize event: {"type":"resize","cols":80,"rows":24}
                    import json
                    try:
                        ev = json.loads(msg["text"])
                        if ev.get("type") == "resize":
                            proc.setwinsize(ev["rows"], ev["cols"])
                    except Exception:
                        proc.write(msg["text"].encode())
            except WebSocketDisconnect:
                break
            except Exception:
                break

    try:
        await asyncio.gather(pty_to_ws(), ws_to_pty())
    finally:
        if proc.isalive():
            proc.terminate()
