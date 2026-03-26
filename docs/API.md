# API

Base URL: `http://localhost:8000`

## Endpoints

- `GET /health`
  - Service status and loaded layer counts.

- `GET /api/v1/timeline`
  - Returns available dates.

- `GET /api/v1/layers/{layer_name}?date=YYYY-MM-DD`
  - Layer GeoJSON by date.
  - Allowed layers: `flood`, `priorities`, `mangrove_extent`, `mangrove_hotspots`.

- `GET /api/v1/tiles/dem/{z}/{x}/{y}.png`
  - Offline DEM tiles for terrain.

- `GET /api/v1/stats`
  - Feature counts by layer.
