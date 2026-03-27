from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.intelligence import router as intelligence_router
from app.routers.layers import router as layers_router
from app.routers.mangrove_change import router as mangrove_change_router
from app.services.bootstrap import build_backend


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.backend = build_backend(settings)
        try:
            yield
        finally:
            backend = app.state.backend
            if backend is not None:
                backend.close()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.settings = settings
    app.state.backend = None

    @app.get("/health")
    def health(request: Request) -> dict:
        backend = request.app.state.backend
        backend_name = backend.__class__.__name__ if backend else "uninitialized"
        counts = backend.counts() if backend else {}
        return {
            "status": "ok",
            "backend": backend_name,
            "layers": counts,
        }

    app.include_router(layers_router, prefix=settings.api_prefix, tags=["layers"])
    app.include_router(intelligence_router, prefix=settings.api_prefix, tags=["intelligence"])
    app.include_router(mangrove_change_router, prefix=settings.api_prefix, tags=["mangrove-change"])
    return app


app = create_app()
