# Architecture

## Runtime services

- `db`: PostgreSQL + PostGIS.
- `api`: FastAPI service exposing geospatial layers and DEM tiles.
- `web` service (Docker): builds and serves the Next.js app from `frontend/`.

## Frontend architecture (`frontend/`)

- `components/`: shared UI blocks and layout structures.
- `analytics/`: risk intelligence panel and chart modules.
- `map/`: MapLibre + deck.gl rendering engine and synchronized comparison mode.
- `simulation/`: timeline/scenario controls.
- `alerts/`: animated live alert stream.
- `hooks/`: data orchestration and stateful simulation logic.
- `lib/`: API adapters, scenario transforms, metrics computation.
- `types/`: geospatial and intelligence type contracts.

## Data flow

1. `useIntelligenceData` loads timeline and layer bundles from API.
2. If API is unavailable, frontend falls back to `frontend/public/data/demo`.
3. Scenario modifiers transform flood/mangrove/exposure metrics in memory.
4. Derived metrics feed:
- top status bar
- critical zones list
- alert stream
- charting modules
- map layer styling and 3D extrusion heights

## Geospatial rendering model

- Base engine: MapLibre GL JS (token-free).
- Advanced overlays: deck.gl (`HeatmapLayer`, `ScatterplotLayer`, `ColumnLayer`).
- Terrain mode: local `raster-dem` served by `/api/dem/{z}/{x}/{y}.png`.
- Split-screen comparison: dual synchronized map instances with shared camera state.

## Key UX capabilities

- Always-visible situational awareness KPI bar.
- Decision-first analytics panel with zone ranking.
- Animated flood and hotspot rendering.
- Bottom simulation bar for scenario planning.
- Live alerts and transparent model explanation.
- Scenario comparison mode for policy storytelling.
