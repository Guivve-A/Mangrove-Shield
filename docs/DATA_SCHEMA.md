# Data Schema - MangroveShield Frontend

## Accepted GeoJSON datasets

The frontend consumes the following FeatureCollections:

- `flood_polygons.geojson`
- `priority_zones.geojson`
- `mangrove_extent.geojson`
- `mangrove_hotspots.geojson`

The API endpoints remain:

- `GET /api/v1/layers/flood?date=YYYY-MM-DD`
- `GET /api/v1/layers/priorities?date=YYYY-MM-DD`
- `GET /api/v1/layers/mangrove_extent?date=YYYY-MM-DD`
- `GET /api/v1/layers/mangrove_hotspots?date=YYYY-MM-DD`
- `GET /api/v1/timeline`

## Feature property contract

### Flood polygons

Required properties:
- `date: string`
- `flood_likelihood: number (0-1)`
- `exposure: number (0-1)`
- `mangrove_health: number (0-1)`
- `priority_score: number (0-1)`

### Priority zones

Required properties:
- `date: string`
- `zone_name: string`
- `flood_likelihood: number (0-1)`
- `exposure: number (0-1)`
- `mangrove_health: number (0-1)`
- `priority_score: number (0-1)`

### Mangrove extent

Required properties:
- `date: string`
- `mangrove_health: number (0-1)`
- `status: string`

### Mangrove hotspots

Required properties:
- `date: string`
- `hotspot_name: string`
- `severity: number (0-1)`
- `mangrove_health: number (0-1)`

## TypeScript mock intelligence contracts

Frontend keeps local mock intelligence arrays in `frontend/lib/mockData.ts`:

- `GUAYAQUIL_KPI_TIMELINE`: date-indexed KPI snapshots for Greater Guayaquil.
- `GUAYAQUIL_HOTSPOTS`: named hotspot catalogue (Isla Puna, Estuario del Rio Guayas, Duran, Samborondon, Jambeli).

## DEM / terrain contract

Terrain mode uses local route:

- `GET /api/dem/{z}/{x}/{y}.png`

Source config:

```ts
{
  type: 'raster-dem',
  tiles: ['/api/dem/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium'
}
```

## Offline fallback

If API is unavailable, frontend falls back to local demo files:

- `frontend/public/data/demo/*.geojson`
- `frontend/public/data/demo/dem/0/0/0.png`
