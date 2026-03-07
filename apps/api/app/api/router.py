from fastapi import APIRouter

from app.api.routes import files, runs, settings


api_router = APIRouter()
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
