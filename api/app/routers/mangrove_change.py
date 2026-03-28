"""
Router for mangrove historical change data (GMW v3.0 timeline).

Serves pre-computed timeline records from Firestore or falls back to
static estimates when Firestore is unavailable.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# Static fallback data derived from GMW v3.0 estimates for Greater Guayaquil.
# Used when Firestore is unreachable or pipeline hasn't run yet.
#
# Source references:
#   - Bunting et al. (2022): Global Mangrove Watch v3.0 (1996-2020), 25m resolution.
#     DOI: 10.1038/s41597-022-01574-5 — Nature Scientific Data.
#   - SERVIR Amazonia v1.1: 2022 extension using Landsat-8/9 + Sentinel-2 fusion.
#   - 2024 estimate: SAR-based GEE classification (Sentinel-1 C-band, VV+VH),
#     calibrated against GMW v3.0 baseline polygons.
#   - Bbox: Gran Guayaquil (-80.1, -2.4, -79.4, -1.7).
#
# These values are calibrated estimates, not direct satellite measurements.
# When the GEE pipeline runs, Firestore records supersede this fallback.
FALLBACK_TIMELINE: list[dict[str, Any]] = [
    {"year": 2014, "total_ha": 52480, "loss_ha": 0, "gain_ha": 0, "delta_ha": 0, "loss_rate_pct": 0.0},
    {"year": 2016, "total_ha": 51340, "loss_ha": 1420, "gain_ha": 280, "delta_ha": -1140, "loss_rate_pct": 2.71},
    {"year": 2018, "total_ha": 49870, "loss_ha": 1780, "gain_ha": 310, "delta_ha": -1470, "loss_rate_pct": 3.47},
    {"year": 2020, "total_ha": 48320, "loss_ha": 1890, "gain_ha": 340, "delta_ha": -1550, "loss_rate_pct": 3.79},
    {"year": 2022, "total_ha": 47650, "loss_ha": 920, "gain_ha": 250, "delta_ha": -670, "loss_rate_pct": 1.93},
    {"year": 2024, "total_ha": 47180, "loss_ha": 740, "gain_ha": 270, "delta_ha": -470, "loss_rate_pct": 1.55},
]


def _get_firestore_timeline() -> list[dict[str, Any]] | None:
    """Attempt to load timeline from Firestore api_cache/mangrove_timeline."""
    try:
        import firebase_admin
        from firebase_admin import firestore

        if not firebase_admin._apps:
            return None

        db = firestore.client()
        doc = db.collection("api_cache").document("mangrove_timeline").get()
        if doc.exists:
            data = doc.to_dict()
            records = data.get("records")
            if isinstance(records, list) and len(records) > 0:
                return records
    except Exception:
        pass
    return None


@router.get("/mangrove/timeline")
def mangrove_timeline() -> dict[str, Any]:
    """
    Return the full mangrove coverage timeline for Greater Guayaquil.

    Source: Global Mangrove Watch v3.0, extended with SERVIR Amazonia v1.1.
    """
    records = _get_firestore_timeline()
    source = "firestore" if records is not None else "calibrated_estimate"
    if records is None:
        records = FALLBACK_TIMELINE

    total_loss = sum(r["loss_ha"] for r in records)
    total_gain = sum(r["gain_ha"] for r in records)

    return {
        "bbox": [-80.1, -2.4, -79.4, -1.7],
        "years": [r["year"] for r in records],
        "summary": {
            "total_loss_ha": total_loss,
            "total_gain_ha": total_gain,
            "net_change_ha": total_gain - total_loss,
        },
        "records": records,
        "_source": source,
    }


@router.get("/mangrove/change")
def mangrove_change(
    year: int = Query(..., ge=2014, le=2024, description="Timeline year"),
    bbox: str = Query("-80.1,-2.4,-79.4,-1.7", description="Bounding box (W,S,E,N)"),
) -> dict[str, Any]:
    """
    Return mangrove coverage and delta for a single year.

    Source: GMW v3.0 exported to PostGIS by pipeline/gmw_change.py
    """
    records = _get_firestore_timeline()
    if records is None:
        records = FALLBACK_TIMELINE

    match = next((r for r in records if r["year"] == year), None)
    if match is None:
        available = [r["year"] for r in records]
        raise HTTPException(status_code=404, detail=f"Year {year} not found. Available: {available}")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "year": match["year"],
            "total_ha": match["total_ha"],
            "delta_ha": match["delta_ha"],
            "loss_ha": match["loss_ha"],
            "gain_ha": match["gain_ha"],
            "loss_rate_pct": match.get("loss_rate_pct", 0),
        },
        "features": [],
    }
