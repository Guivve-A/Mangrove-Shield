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

## Mangrove historical change (GMW v3.0 timeline)

### `GET /api/v1/mangrove/timeline`

Full timeline response:
```json
{
  "bbox": [-80.1, -2.4, -79.4, -1.7],
  "years": [2014, 2016, 2018, 2020, 2022, 2024],
  "summary": {
    "total_loss_ha": 6750,
    "total_gain_ha": 1450,
    "net_change_ha": -5300
  },
  "records": [
    {
      "year": 2020,
      "total_ha": 48320,
      "loss_ha": 1890,
      "gain_ha": 340,
      "delta_ha": -1550,
      "loss_rate_pct": 3.79
    }
  ]
}
```

### `GET /api/v1/mangrove/change?year={year}&bbox={bbox}`

Single-year response (FeatureCollection with metadata):

Required metadata fields:
- `year: number`
- `total_ha: number`
- `delta_ha: number`
- `loss_ha: number`
- `gain_ha: number`
- `loss_rate_pct: number`

Source: Global Mangrove Watch v3.0 (Bunting et al., 2022), extended with SERVIR Amazonia v1.1 for 2022 and SAR GEE for 2024.

## Offline fallback

If API is unavailable, frontend falls back to local demo files:

- `frontend/public/data/demo/*.geojson`
- `frontend/public/data/demo/dem/0/0/0.png`
