# MangroveShield API

FastAPI service for:

- Layer GeoJSON endpoints
- Timeline endpoint
- DEM tile endpoint for terrain rendering
- Intelligence endpoints for Guayaquil climate analytics

By default the API uses PostGIS backend in Docker. For local tests, `DATA_BACKEND=file` is supported.

## REST endpoints

Base prefix: `/api/v1`

- `GET /layers/{layer_name}` -> GeoJSON (`flood`, `priorities`, `mangrove_extent`, `mangrove_hotspots`)
- `GET /timeline` -> available observation dates
- `GET /tiles/dem/{z}/{x}/{y}.png` -> DEM tile
- `GET /stats` -> layer feature counts
- `GET /mangroves?date=YYYY-MM-DD` -> mangrove coverage, health and hotspot intelligence
- `GET /flood-risk?date=YYYY-MM-DD` -> flood-risk index and top vulnerable zones
- `GET /coastal-protection?date=YYYY-MM-DD` -> natural buffer index and protection gaps
- `GET /ecosystem-health?date=YYYY-MM-DD` -> ecosystem health, stress, resilience, and trend
