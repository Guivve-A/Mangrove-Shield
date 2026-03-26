from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app.backends.base import DataBackend
from app.backends.file_backend import LAYER_FILES


router = APIRouter()


ALLOWED_LAYERS = set(LAYER_FILES.keys())


def get_backend(request: Request) -> DataBackend:
    return request.app.state.backend


def get_data_dir(request: Request) -> Path:
    return request.app.state.settings.data_dir


@router.get("/layers/{layer_name}")
def layer_data(
    layer_name: str,
    date: str | None = Query(default=None, description="ISO date filter, example: 2026-01-15"),
    backend: DataBackend = Depends(get_backend),
) -> dict:
    if layer_name not in ALLOWED_LAYERS:
        allowed = ", ".join(sorted(ALLOWED_LAYERS))
        raise HTTPException(status_code=404, detail=f"Unknown layer '{layer_name}'. Allowed: {allowed}")
    return backend.get_layer(layer_name, date=date)


@router.get("/timeline")
def timeline(backend: DataBackend = Depends(get_backend)) -> dict[str, list[str]]:
    return {"dates": backend.list_dates()}


@router.get("/tiles/dem/{z}/{x}/{y}.png")
def dem_tile(z: int, x: int, y: int, data_dir: Path = Depends(get_data_dir)) -> FileResponse:
    if z < 0 or x < 0 or y < 0:
        raise HTTPException(status_code=400, detail="Tile coordinates must be non-negative")

    tile_path = data_dir / "dem" / str(z) / str(x) / f"{y}.png"
    if not tile_path.exists():
        raise HTTPException(status_code=404, detail="DEM tile not found")
    return FileResponse(tile_path)


@router.get("/stats")
def stats(backend: DataBackend = Depends(get_backend)) -> dict[str, dict[str, int]]:
    return {"counts": backend.counts()}
