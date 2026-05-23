from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import shortcuts, docker, tailscale, resources

app = FastAPI(title="ZimaDash")

app.include_router(shortcuts.router, prefix="/api/shortcuts", tags=["shortcuts"])
app.include_router(docker.router,    prefix="/api/docker",    tags=["docker"])
app.include_router(tailscale.router, prefix="/api/tailscale", tags=["tailscale"])
app.include_router(resources.router, prefix="/api/resources", tags=["resources"])

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/")
def root():
    return FileResponse("frontend/index.html")
