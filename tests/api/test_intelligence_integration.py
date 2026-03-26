from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    data_dir = Path(__file__).resolve().parents[2] / "data" / "demo"
    os.environ["DATA_BACKEND"] = "file"
    os.environ["DATA_DIR"] = str(data_dir)

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_mangroves_endpoint_defaults_to_latest_date(client: TestClient) -> None:
    response = client.get("/api/v1/mangroves")
    assert response.status_code == 200

    payload = response.json()
    assert payload["region"]["name"] == "Greater Guayaquil"
    assert payload["date"] == "2026-02-01"
    assert payload["summary"]["coverage_km2"] > 0
    assert 0 <= payload["summary"]["health_index"] <= 1
    assert len(payload["hotspots"]) == 5


def test_flood_risk_endpoint_filters_by_date(client: TestClient) -> None:
    response = client.get("/api/v1/flood-risk?date=2026-01-15")
    assert response.status_code == 200

    payload = response.json()
    assert payload["date"] == "2026-01-15"
    assert payload["summary"]["risk_level"] in {"low", "moderate", "high", "critical"}
    assert payload["summary"]["priority_features"] == 5
    assert payload["zones"][0]["zone_name"] == "Estuario del Rio Guayas Centro"


def test_coastal_protection_endpoint_returns_clamped_indexes(client: TestClient) -> None:
    response = client.get("/api/v1/coastal-protection?date=2026-01-01")
    assert response.status_code == 200

    payload = response.json()
    summary = payload["summary"]
    assert 0 <= summary["natural_buffer_index"] <= 1
    assert 0 <= summary["protection_gap_index"] <= 1
    assert len(payload["priority_interventions"]) == 5


def test_ecosystem_health_includes_trend_context(client: TestClient) -> None:
    response = client.get("/api/v1/ecosystem-health?date=2026-02-01")
    assert response.status_code == 200

    payload = response.json()
    trend = payload["trend"]
    assert trend["previous_date"] == "2026-01-15"
    assert trend["direction"] in {"improving", "stable", "declining"}
    assert 0 <= payload["summary"]["resilience_index"] <= 1
