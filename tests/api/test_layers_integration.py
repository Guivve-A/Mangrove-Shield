from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope='module')
def client() -> TestClient:
    data_dir = Path(__file__).resolve().parents[2] / 'data' / 'demo'
    os.environ['DATA_BACKEND'] = 'file'
    os.environ['DATA_DIR'] = str(data_dir)

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client: TestClient) -> None:
    response = client.get('/health')
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'ok'
    assert payload['backend'] in {'FileBackend', 'PostGISBackend'}
    assert payload['layers']['flood'] >= 1


def test_timeline_endpoint(client: TestClient) -> None:
    response = client.get('/api/v1/timeline')
    assert response.status_code == 200
    dates = response.json()['dates']
    assert dates == ['2026-01-01', '2026-01-15', '2026-02-01']


def test_layer_filter_by_date(client: TestClient) -> None:
    response = client.get('/api/v1/layers/priorities?date=2026-01-15')
    assert response.status_code == 200
    payload = response.json()

    assert payload['type'] == 'FeatureCollection'
    assert len(payload['features']) == 5
    assert all(feature['properties']['date'] == '2026-01-15' for feature in payload['features'])


def test_dem_tile_route(client: TestClient) -> None:
    response = client.get('/api/v1/tiles/dem/0/0/0.png')
    assert response.status_code == 200
    assert response.headers['content-type'] == 'image/png'
