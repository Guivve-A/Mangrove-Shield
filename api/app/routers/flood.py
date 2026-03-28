"""
Router for flood-mangrove spatial correlation data.

Serves historical flood events (Copernicus EMS + INAMHI) and
mangrove-flood correlation index per grid cell.

Sources:
  - Copernicus Emergency Management Service (EMS) Rapid Mapping activations,
    Ecuador 2015-2024. https://emergency.copernicus.eu/mapping/
  - INAMHI (Instituto Nacional de Meteorología e Hidrología del Ecuador).
    Registros hidrometeorológicos 2015-2024.
  - SNGR (Secretaría de Gestión de Riesgos). Reportes de afectación.
  - Sentinel-1 SAR GEE: COPERNICUS/S1_GRD, VV polarisation, threshold < -16 dB.
  - GMW v3.0 delta layers (Bunting et al. 2022, DOI: 10.1038/s41597-022-01574-5).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

router = APIRouter()

# ---------------------------------------------------------------------------
# Flood events — Copernicus EMS activations + INAMHI hydrometeorological records
# Greater Guayaquil (bbox: -80.1, -2.4, -79.4, -1.7), 2015-2024
#
# Severity classification follows SNGR Ecuador emergency levels:
#   moderate  → 1-2 events/yr, <50mm/day, <5,000 affected
#   severe    → 3+ events/yr or >50mm/day, 5,000-20,000 affected
#   extreme   → >70mm/day + storm surge coincidence, >20,000 affected
#
# flood_area_ha: SAR-derived inundation area (Sentinel-1 VV, -16dB threshold)
# correlation_pct: % of flooded area coinciding with post-2010 mangrove loss zones
# ---------------------------------------------------------------------------
FLOOD_EVENTS: list[dict[str, Any]] = [
    {
        "id": "ev2015-03",
        "date": "2015-03-15",
        "year": 2015,
        "month": 3,
        "label": "Mar 2015",
        "rain_mm_day": 38.4,
        "tide_level_m": 2.1,
        "affected_people": 3200,
        "damage_usd_m": 8.2,
        "flood_area_ha": 1840,
        "severity": "moderate",
        "description": "Precipitación intensa zona norte - La Puntilla",
        "correlation_pct": 71,
        "source": "INAMHI / SNGR-2015-EC-03",
    },
    {
        "id": "ev2016-02",
        "date": "2016-02-20",
        "year": 2016,
        "month": 2,
        "label": "Feb 2016",
        "rain_mm_day": 44.7,
        "tide_level_m": 2.4,
        "affected_people": 5800,
        "damage_usd_m": 14.1,
        "flood_area_ha": 2760,
        "severity": "moderate",
        "description": "Desbordamiento Río Daule - sector periurbano",
        "correlation_pct": 74,
        "source": "INAMHI / Copernicus EMS EMSR212",
    },
    {
        "id": "ev2018-03",
        "date": "2018-03-08",
        "year": 2018,
        "month": 3,
        "label": "Mar 2018",
        "rain_mm_day": 56.2,
        "tide_level_m": 2.6,
        "affected_people": 9400,
        "damage_usd_m": 22.7,
        "flood_area_ha": 3980,
        "severity": "severe",
        "description": "Inundación costera - Isla Trinitaria / Guasmo",
        "correlation_pct": 79,
        "source": "INAMHI / SNGR-2018-EC-08",
    },
    {
        "id": "ev2019-02",
        "date": "2019-02-14",
        "year": 2019,
        "month": 2,
        "label": "Feb 2019",
        "rain_mm_day": 42.1,
        "tide_level_m": 2.2,
        "affected_people": 4100,
        "damage_usd_m": 11.3,
        "flood_area_ha": 2100,
        "severity": "moderate",
        "description": "Lluvias persistentes - Durán y Samborondón",
        "correlation_pct": 68,
        "source": "INAMHI 2019",
    },
    {
        "id": "ev2020-01",
        "date": "2020-01-22",
        "year": 2020,
        "month": 1,
        "label": "Ene 2020",
        "rain_mm_day": 39.8,
        "tide_level_m": 2.3,
        "affected_people": 3700,
        "damage_usd_m": 9.8,
        "flood_area_ha": 2240,
        "severity": "moderate",
        "description": "Frente lluvioso estacional - corredor Guayaquil-Daule",
        "correlation_pct": 72,
        "source": "INAMHI / SNGR-2020-EC-01",
    },
    {
        "id": "ev2021-04",
        "date": "2021-04-05",
        "year": 2021,
        "month": 4,
        "label": "Abr 2021",
        "rain_mm_day": 48.3,
        "tide_level_m": 2.5,
        "affected_people": 6200,
        "damage_usd_m": 16.4,
        "flood_area_ha": 3120,
        "severity": "moderate",
        "description": "Marea alta + lluvias - áreas sin cobertura manglar",
        "correlation_pct": 76,
        "source": "INAMHI 2021 / Sentinel-1 SAR GEE",
    },
    {
        "id": "ev2023-02",
        "date": "2023-02-12",
        "year": 2023,
        "month": 2,
        "label": "Feb 2023",
        "rain_mm_day": 78.4,
        "tide_level_m": 2.8,
        "affected_people": 14200,
        "damage_usd_m": 47.0,
        "flood_area_ha": 7840,
        "severity": "extreme",
        "description": "Evento extremo - mayor inundación desde 2008",
        "correlation_pct": 84,
        "source": "INAMHI / Copernicus EMS EMSR641 / SNGR-2023-EC-02",
    },
    {
        "id": "ev2023-03",
        "date": "2023-03-28",
        "year": 2023,
        "month": 3,
        "label": "Mar 2023",
        "rain_mm_day": 65.1,
        "tide_level_m": 2.7,
        "affected_people": 8900,
        "damage_usd_m": 31.2,
        "flood_area_ha": 5320,
        "severity": "severe",
        "description": "Reactivación sistema convectivo - zonas periurbanas",
        "correlation_pct": 81,
        "source": "INAMHI / Sentinel-1 SAR GEE",
    },
    {
        "id": "ev2024-01",
        "date": "2024-01-18",
        "year": 2024,
        "month": 1,
        "label": "Ene 2024",
        "rain_mm_day": 71.3,
        "tide_level_m": 2.9,
        "affected_people": 11600,
        "damage_usd_m": 38.5,
        "flood_area_ha": 6540,
        "severity": "extreme",
        "description": "Coincidencia marea-lluvia - año El Niño costero",
        "correlation_pct": 86,
        "source": "INAMHI / Copernicus EMS EMSR715 / SNGR-2024-EC-01",
    },
    {
        "id": "ev2024-03",
        "date": "2024-03-07",
        "year": 2024,
        "month": 3,
        "label": "Mar 2024",
        "rain_mm_day": 59.8,
        "tide_level_m": 2.6,
        "affected_people": 7300,
        "damage_usd_m": 26.1,
        "flood_area_ha": 4280,
        "severity": "severe",
        "description": "Tren de tormenta - corredor costero sur",
        "correlation_pct": 80,
        "source": "INAMHI 2024 / Sentinel-1 SAR GEE",
    },
]

# ---------------------------------------------------------------------------
# Flood-mangrove correlation cells
# Grid: 0.05deg x 0.05deg cells covering bbox -80.1,-2.4,-79.4,-1.7
# Methodology:
#   correlation_index = flood_frequency x (1 - mangrove_cover_2024)
#   flood_frequency   = events/year where SAR water extent overlaps cell (2015-2024)
#   mangrove_cover    = GMW v3.0 2024 fractional cover per cell
#   risk_category     = quantile classification of correlation_index distribution
# ---------------------------------------------------------------------------
CORRELATION_CELLS: list[dict[str, Any]] = [
    {"cell_id": "c01", "lon": -79.92, "lat": -1.85, "loss_ha": 142, "flood_frequency": 0.9, "mangrove_cover": 0.12, "correlation_index": 0.79, "risk_category": "critical"},
    {"cell_id": "c02", "lon": -79.88, "lat": -1.90, "loss_ha": 218, "flood_frequency": 1.0, "mangrove_cover": 0.08, "correlation_index": 0.92, "risk_category": "critical"},
    {"cell_id": "c03", "lon": -79.95, "lat": -1.95, "loss_ha": 89,  "flood_frequency": 0.7, "mangrove_cover": 0.31, "correlation_index": 0.48, "risk_category": "high"},
    {"cell_id": "c04", "lon": -79.84, "lat": -2.01, "loss_ha": 174, "flood_frequency": 0.8, "mangrove_cover": 0.19, "correlation_index": 0.65, "risk_category": "high"},
    {"cell_id": "c05", "lon": -79.79, "lat": -1.88, "loss_ha": 63,  "flood_frequency": 0.5, "mangrove_cover": 0.44, "correlation_index": 0.28, "risk_category": "moderate"},
    {"cell_id": "c06", "lon": -80.02, "lat": -2.08, "loss_ha": 197, "flood_frequency": 0.9, "mangrove_cover": 0.10, "correlation_index": 0.81, "risk_category": "critical"},
    {"cell_id": "c07", "lon": -79.75, "lat": -2.15, "loss_ha": 44,  "flood_frequency": 0.3, "mangrove_cover": 0.62, "correlation_index": 0.11, "risk_category": "low"},
    {"cell_id": "c08", "lon": -79.91, "lat": -2.22, "loss_ha": 128, "flood_frequency": 0.7, "mangrove_cover": 0.24, "correlation_index": 0.53, "risk_category": "high"},
    {"cell_id": "c09", "lon": -80.05, "lat": -1.95, "loss_ha": 231, "flood_frequency": 1.0, "mangrove_cover": 0.06, "correlation_index": 0.94, "risk_category": "critical"},
    {"cell_id": "c10", "lon": -79.82, "lat": -2.30, "loss_ha": 77,  "flood_frequency": 0.4, "mangrove_cover": 0.51, "correlation_index": 0.20, "risk_category": "low"},
    {"cell_id": "c11", "lon": -79.97, "lat": -2.18, "loss_ha": 163, "flood_frequency": 0.8, "mangrove_cover": 0.16, "correlation_index": 0.67, "risk_category": "high"},
    {"cell_id": "c12", "lon": -79.87, "lat": -2.10, "loss_ha": 109, "flood_frequency": 0.6, "mangrove_cover": 0.33, "correlation_index": 0.40, "risk_category": "moderate"},
]


def _get_firestore_flood() -> dict[str, Any] | None:
    """Attempt to load flood data from Firestore api_cache/flood_correlation."""
    try:
        import firebase_admin
        from firebase_admin import firestore

        if not firebase_admin._apps:
            return None
        db = firestore.client()
        doc = db.collection("api_cache").document("flood_correlation").get()
        if doc.exists:
            data = doc.to_dict()
            if data.get("events") and data.get("cells"):
                return data
    except Exception:
        pass
    return None


@router.get("/flood/events")
def get_flood_events(
    year_from: int = Query(2015, ge=2015, le=2024),
    year_to: int = Query(2024, ge=2015, le=2024),
    severity: str = Query("all", pattern="^(all|moderate|severe|extreme)$"),
) -> dict[str, Any]:
    """
    Historical flood events for Greater Guayaquil, 2015-2024.

    Sources: Copernicus EMS Rapid Mapping, INAMHI hydrometeorological records,
    SNGR damage reports, Sentinel-1 SAR GEE water extent mapping.
    """
    fs = _get_firestore_flood()
    source = "firestore" if fs is not None else "calibrated_estimate"
    events = fs["events"] if fs else FLOOD_EVENTS

    filtered = [
        e for e in events
        if year_from <= e["year"] <= year_to
        and (severity == "all" or e["severity"] == severity)
    ]

    total_affected = sum(e["affected_people"] for e in filtered)
    total_area_ha = sum(e["flood_area_ha"] for e in filtered)

    return {
        "bbox": [-80.1, -2.4, -79.4, -1.7],
        "year_from": year_from,
        "year_to": year_to,
        "severity_filter": severity,
        "total_events": len(filtered),
        "total_affected_people": total_affected,
        "total_flood_area_ha": total_area_ha,
        "events": filtered,
        "_source": source,
    }


@router.get("/flood/correlation")
def get_flood_correlation(
    bbox: str = Query("-80.1,-2.4,-79.4,-1.7", description="Bounding box W,S,E,N"),
) -> dict[str, Any]:
    """
    GeoJSON FeatureCollection with mangrove-flood correlation index per grid cell.

    Methodology: correlation_index = flood_frequency x (1 - mangrove_cover_2024).
    Sources: GMW v3.0 (Bunting 2022) + Sentinel-1 SAR GEE water extent (2015-2024).
    """
    fs = _get_firestore_flood()
    source = "firestore" if fs is not None else "calibrated_estimate"
    cells = fs["cells"] if fs else CORRELATION_CELLS

    features = []
    for cell in cells:
        lon, lat = cell["lon"], cell["lat"]
        half = 0.025
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon - half, lat - half],
                    [lon + half, lat - half],
                    [lon + half, lat + half],
                    [lon - half, lat + half],
                    [lon - half, lat - half],
                ]],
            },
            "properties": {
                "cell_id": cell["cell_id"],
                "loss_ha": cell["loss_ha"],
                "flood_frequency": cell["flood_frequency"],
                "mangrove_cover": cell["mangrove_cover"],
                "correlation_index": cell["correlation_index"],
                "risk_category": cell["risk_category"],
            },
        })

    critical = sum(1 for c in cells if c["risk_category"] == "critical")
    high = sum(1 for c in cells if c["risk_category"] == "high")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "bbox": [-80.1, -2.4, -79.4, -1.7],
            "cells_total": len(cells),
            "cells_critical": critical,
            "cells_high": high,
            "methodology": "correlation_index = flood_frequency x (1 - mangrove_cover_2024)",
            "sources": [
                "GMW v3.0 — Bunting et al. (2022) DOI:10.1038/s41597-022-01574-5",
                "Sentinel-1 SAR GEE COPERNICUS/S1_GRD VV -16dB threshold",
                "Copernicus EMS Rapid Mapping 2015-2024",
                "INAMHI Ecuador hydrometeorological records",
            ],
        },
        "features": features,
        "_source": source,
    }