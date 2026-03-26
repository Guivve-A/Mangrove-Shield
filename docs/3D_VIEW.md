# 3D View (Terrain Mode)

## Engine

The redesigned frontend uses **MapLibre GL JS** with local `raster-dem` tiles. No Mapbox token is required.

## Activation

Terrain mode is controlled from the bottom simulation panel using:

- `2D View / 3D View` switch
- `Reset Camera` button on map canvas

## Rendering behavior

When terrain mode is enabled:

- `map.setTerrain({ source: dem, exaggeration: 1.8 })` is applied.
- Priority zones are extruded by `priority_score * 120`.
- Flood polygons are extruded as semi-transparent water surfaces.
- Mangrove extent is rendered as low extrusions.
- Mangrove hotspots are extruded as vertical severity spikes.

When terrain mode is disabled:

- Terrain is removed (`setTerrain(null)`).
- Extrusion layers are removed.
- 2D thematic layers remain active.

## DEM source

Frontend route:

- `/api/dem/{z}/{x}/{y}.png`

The route resolves local demo tiles from:

- `frontend/public/data/demo/dem/`

and falls back to `0/0/0.png` when specific tiles are unavailable.

## Scenario coupling

Extrusion heights and flood intensity react to simulation controls:

- storm intensity slider
- selected scenario
- restoration toggle

This enables visual storytelling for mitigation planning and impact communication.
