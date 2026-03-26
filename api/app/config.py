import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    data_dir: Path
    data_backend: str
    database_url: str
    cors_origins: str

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def _default_data_dir() -> Path:
    docker_data_dir = Path("/app/data/demo")
    if docker_data_dir.exists():
        return docker_data_dir

    # Resolve the repo-level demo data folder for local development.
    return Path(__file__).resolve().parents[2] / "data" / "demo"


def _resolve_data_dir() -> Path:
    configured = os.getenv("DATA_DIR")
    if configured:
        return Path(configured)
    return _default_data_dir()



def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "MangroveShield API"),
        api_prefix=os.getenv("API_PREFIX", "/api/v1"),
        data_dir=_resolve_data_dir(),
        data_backend=os.getenv("DATA_BACKEND", "postgis").lower(),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql://mangrove:mangrove@db:5432/mangroveshield",
        ),
        cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000"),
    )
