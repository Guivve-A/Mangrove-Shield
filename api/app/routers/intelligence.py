from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.backends.base import DataBackend
from app.services.intelligence import IntelligenceService


router = APIRouter()


def get_backend(request: Request) -> DataBackend:
    return request.app.state.backend


@router.get("/mangroves")
def mangroves(
    date: str | None = Query(default=None, description="ISO date filter, example: 2026-01-15"),
    backend: DataBackend = Depends(get_backend),
) -> dict:
    return IntelligenceService(backend).mangroves(date)


@router.get("/flood-risk")
def flood_risk(
    date: str | None = Query(default=None, description="ISO date filter, example: 2026-01-15"),
    backend: DataBackend = Depends(get_backend),
) -> dict:
    return IntelligenceService(backend).flood_risk(date)


@router.get("/coastal-protection")
def coastal_protection(
    date: str | None = Query(default=None, description="ISO date filter, example: 2026-01-15"),
    backend: DataBackend = Depends(get_backend),
) -> dict:
    return IntelligenceService(backend).coastal_protection(date)


@router.get("/ecosystem-health")
def ecosystem_health(
    date: str | None = Query(default=None, description="ISO date filter, example: 2026-01-15"),
    backend: DataBackend = Depends(get_backend),
) -> dict:
    return IntelligenceService(backend).ecosystem_health(date)
