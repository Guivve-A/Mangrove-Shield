from __future__ import annotations

import logging

from app.backends.base import DataBackend
from app.backends.file_backend import FileBackend
from app.backends.postgis_backend import PostGISBackend
from app.config import Settings


logger = logging.getLogger(__name__)


def build_backend(settings: Settings) -> DataBackend:
    if settings.data_backend == "file":
        backend = FileBackend(settings.data_dir)
        backend.initialize()
        logger.info("Using file backend with demo data")
        return backend

    backend = PostGISBackend(settings.database_url, settings.data_dir)
    try:
        backend.initialize()
        logger.info("Using PostGIS backend")
        return backend
    except Exception as error:
        logger.warning(
            "PostGIS backend failed (%s). Falling back to file backend.",
            error,
        )
        fallback_backend = FileBackend(settings.data_dir)
        fallback_backend.initialize()
        return fallback_backend
