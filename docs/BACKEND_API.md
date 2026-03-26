# MangroveShield Backend API

Backend service exposes geospatial and climate-intelligence data for Greater Guayaquil, Ecuador.

## Base URL

- Local: `http://localhost:8000`
- Prefix: `/api/v1`

## Health and core geospatial routes

- `GET /health`
- `GET /api/v1/timeline`
- `GET /api/v1/layers/{layer_name}`
- `GET /api/v1/tiles/dem/{z}/{x}/{y}.png`
- `GET /api/v1/stats`

Valid `{layer_name}` values:

- `flood`
- `priorities`
- `mangrove_extent`
- `mangrove_hotspots`

## Intelligence routes

All intelligence endpoints support optional `date=YYYY-MM-DD`. If omitted, the API returns the latest available observation date.

- `GET /api/v1/mangroves`
- `GET /api/v1/flood-risk`
- `GET /api/v1/coastal-protection`
- `GET /api/v1/ecosystem-health`

### Shared response envelope

```json
{
  "region": {
    "id": "greater-guayaquil-ecuador",
    "name": "Greater Guayaquil",
    "country": "Ecuador",
    "focus": "Mangrove resilience and flood vulnerability"
  },
  "date": "2026-02-01",
  "...": "endpoint-specific payload"
}
```

### Data semantics

- All index values are normalized to `0..1`.
- `coverage_km2` is an approximate planar area from GeoJSON polygons.
- `zones`, `hotspots`, and `priority_interventions` are sorted descending by risk or severity.
- Trend direction (`improving`, `stable`, `declining`) compares selected date against the previous available date.
