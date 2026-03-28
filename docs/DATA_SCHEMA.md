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

## Mangrove health indices (Sentinel-2 + NASA AGB)

### `GET /api/v1/health/summary`

Global health summary with municipality breakdown:
```json
{
  "period": "2024-12",
  "global_health_pct": 72,
  "ndvi_mean": 0.6875,
  "ndwi_mean": 0.34,
  "classification": { "status": "Moderado", "level": "moderate", "color": "#eab308" },
  "distribution": { "healthy": 18, "moderate": 54, "degraded": 23, "critical": 5 },
  "municipalities": [
    {
      "name": "Guayaquil",
      "ndvi": 0.68,
      "ndwi": 0.34,
      "agb_mg_ha": 168.4,
      "canopy_height_m": 12.8,
      "annual_delta": -0.04,
      "status": "Moderado",
      "level": "moderate",
      "color": "#eab308"
    }
  ]
}
```

### `GET /api/v1/health/timeseries?months={24}`

Monthly NDVI time series per municipality:
```json
{
  "municipalities": ["Guayaquil", "Duran", "Daule", "Samborondon"],
  "months": ["2024-01", "2024-02"],
  "series": { "Guayaquil": [0.71, 0.72], "Duran": [0.73, 0.74] },
  "regional_mean": [0.6875, 0.6950]
}
```

### `GET /api/v1/health/ndvi?month={m}&year={y}&index={ndvi|ndwi|agb|height}`

Single-month index values per municipality.

Sources: Sentinel-2 SR Harmonized (COPERNICUS/S2_SR_HARMONIZED, 10m monthly median), NASA Global Mangrove AGB v1.3 (ORNL DAAC, 30m year 2000 baseline).

## Offline fallback

If API is unavailable, frontend falls back to local demo files:

- `frontend/public/data/demo/*.geojson`
- `frontend/public/data/demo/dem/0/0/0.png`
