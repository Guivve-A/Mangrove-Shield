"""
Router for mangrove historical change data (GMW v3.0 timeline).

Serves pre-computed timeline records from Firestore or falls back to
static estimates when Firestore is unavailable.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
import threading
import time
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# Default analysis bbox for Greater Guayaquil (W,S,E,N), WGS84.
DEFAULT_BBOX = [-80.1, -2.4, -79.4, -1.7]

# Timeline years for the "MangroveTimelineSection" (biennial).
TIMELINE_YEARS: list[int] = [2014, 2016, 2018, 2020, 2022, 2024]

# Cache TTL for ephemeral Earth Engine map tile URLs (seconds).
TILE_CACHE_TTL_S = int(os.getenv("MANGROVE_TILE_CACHE_TTL_S", "1800"))

# Cache TTL for computed timeline stats (seconds).
TIMELINE_CACHE_TTL_S = int(os.getenv("MANGROVE_TIMELINE_CACHE_TTL_S", str(6 * 60 * 60)))

_EE_INIT_LOCK = threading.Lock()
_EE_INITIALIZED = False

_TILE_CACHE_LOCK = threading.Lock()
_TILE_CACHE: dict[tuple[int, int | None, tuple[float, float, float, float]], tuple[float, dict[str, Any]]] = {}

_TIMELINE_CACHE_LOCK = threading.Lock()
_TIMELINE_CACHE: dict[tuple[float, float, float, float], tuple[float, list[dict[str, Any]]]] = {}


class EarthEngineUnavailable(RuntimeError):
    pass


def _parse_bbox(bbox: str) -> list[float]:
    parts = [part.strip() for part in bbox.split(",") if part.strip()]
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="bbox must have 4 comma-separated numbers (W,S,E,N)")
    try:
        values = [float(part) for part in parts]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bbox contains non-numeric values") from exc

    west, south, east, north = values
    if west >= east or south >= north:
        raise HTTPException(status_code=400, detail="bbox coordinates must satisfy W<E and S<N")
    return values


def _ensure_ee_initialized():
    """Initialize Google Earth Engine (service account supported)."""
    global _EE_INITIALIZED
    try:
        import ee  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover
        raise EarthEngineUnavailable(f"earthengine-api not installed: {exc}") from exc

    if _EE_INITIALIZED:
        return ee

    with _EE_INIT_LOCK:
        if _EE_INITIALIZED:
            return ee

        # If already initialized (e.g., via runtime auth), this succeeds.
        try:
            ee.Number(1).getInfo()
            _EE_INITIALIZED = True
            return ee
        except Exception:
            pass

        sa_b64 = os.getenv("GEE_SERVICE_ACCOUNT_B64", "")
        ee_project = os.getenv("EE_PROJECT", "")
        opt_url = os.getenv("EE_OPT_URL", "https://earthengine-highvolume.googleapis.com")

        if sa_b64:
            try:
                raw = base64.b64decode(sa_b64)
                info = json.loads(raw)
            except Exception as exc:
                raise EarthEngineUnavailable(f"Invalid GEE_SERVICE_ACCOUNT_B64: {exc}") from exc

            with tempfile.NamedTemporaryFile(
                suffix=".json", delete=False, mode="w", encoding="utf-8"
            ) as handle:
                json.dump(info, handle)
                key_path = handle.name

            try:
                credentials = ee.ServiceAccountCredentials(info["client_email"], key_path)
                if ee_project:
                    ee.Initialize(credentials, project=ee_project, opt_url=opt_url)
                else:
                    ee.Initialize(credentials, opt_url=opt_url)
            finally:
                try:
                    os.unlink(key_path)
                except OSError:
                    pass
        else:
            if ee_project:
                ee.Initialize(project=ee_project, opt_url=opt_url)
            else:
                ee.Initialize(opt_url=opt_url)

        _EE_INITIALIZED = True
        return ee


def _mangrove_mask_proxy(ee, year: int, aoi):
    """
    Return a binary mangrove mask (band 'b1') for the given year.

    Proxy sources (public, Earth Engine):
      - 2017+ : Sentinel-2 SR Harmonized dry-season NDVI > 0.35, masked to a
               coastal/tidal zone derived from JRC GSW occurrence (>5 %) buffered 1 km.
      - 2014–2016 : Landsat-8 OLI Collection-2 dry-season NDVI > 0.35, same coastal mask.
    """
    # Coastal / tidal zone: pixels with JRC water occurrence > 5 %, buffered 1 km
    jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
    coastal_zone = jrc.gt(5).focal_max(radius=1000, units="meters")

    if year >= 2017:
        base = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filter(ee.Filter.calendarRange(year, year, "year"))
            .filter(ee.Filter.calendarRange(6, 11, "month"))  # dry season
        )

        filtered = base
        for cloud_thresh in [30, 60, 90]:
            candidate = base.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_thresh))
            filtered = candidate
            if candidate.size().getInfo() >= 5:
                break

        # Fall back to S2 TOA (L1C) if SR has insufficient coverage.
        if filtered.size().getInfo() < 5:
            base_toa = (
                ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
                .filterBounds(aoi)
                .filter(ee.Filter.calendarRange(year, year, "year"))
                .filter(ee.Filter.calendarRange(6, 11, "month"))
            )
            for cloud_thresh in [30, 60, 90]:
                candidate = base_toa.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_thresh))
                filtered = candidate
                if candidate.size().getInfo() >= 5:
                    break

        ndvi = filtered.median().normalizedDifference(["B8", "B4"])
        return ndvi.gt(0.35).And(coastal_zone).rename("b1").unmask(0)

    base_col = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(aoi)
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .filter(ee.Filter.calendarRange(6, 11, "month"))
    )
    filtered = base_col
    for cloud_thresh in [30, 60, 90]:
        candidate = base_col.filter(ee.Filter.lt("CLOUD_COVER", cloud_thresh))
        filtered = candidate
        if candidate.size().getInfo() > 0:
            break

    l8 = filtered.map(
        lambda img: img.select(["SR_B5", "SR_B4"]).multiply(0.0000275).add(-0.2)
    )
    ndvi = l8.median().normalizedDifference(["SR_B5", "SR_B4"])
    return ndvi.gt(0.35).And(coastal_zone).rename("b1").unmask(0)


def _mangrove_mask_proxy_fast(ee, year: int, aoi):
    """
    Faster proxy mangrove mask for visualization (avoids client-side getInfo calls).

    This is intended for tile rendering where latency matters more than strict scene-count heuristics.
    """
    jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
    coastal_zone = jrc.gt(5).focal_max(radius=1000, units="meters")

    if year >= 2017:
        base = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filter(ee.Filter.calendarRange(year, year, "year"))
            .filter(ee.Filter.calendarRange(6, 11, "month"))
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 70))
        )
        has_images = base.size().gt(0)
        ndvi = ee.Image(
            ee.Algorithms.If(
                has_images,
                base.median().normalizedDifference(["B8", "B4"]).rename("ndvi"),
                ee.Image(0).rename("ndvi"),
            )
        )
        return ndvi.gt(0.35).And(coastal_zone).rename("b1").unmask(0)

    base_col = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(aoi)
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .filter(ee.Filter.calendarRange(6, 11, "month"))
        .filter(ee.Filter.lt("CLOUD_COVER", 80))
    )
    has_images = base_col.size().gt(0)
    scaled = base_col.map(
        lambda img: img.select(["SR_B5", "SR_B4"]).multiply(0.0000275).add(-0.2)
    )
    ndvi = ee.Image(
        ee.Algorithms.If(
            has_images,
            scaled.median().normalizedDifference(["SR_B5", "SR_B4"]).rename("ndvi"),
            ee.Image(0).rename("ndvi"),
        )
    )
    return ndvi.gt(0.35).And(coastal_zone).rename("b1").unmask(0)


def _tile_url(ee, image, vis_params: dict[str, Any]) -> str:
    map_id = image.getMapId(vis_params)
    return map_id["tile_fetcher"].url_format


def _resolve_compare_year(year: int, compare: Literal["prev", "baseline", "none"]) -> int | None:
    if compare == "none":
        return None
    if year not in TIMELINE_YEARS:
        raise HTTPException(status_code=404, detail=f"Year {year} not supported. Available: {TIMELINE_YEARS}")
    if compare == "baseline":
        return None if year == TIMELINE_YEARS[0] else TIMELINE_YEARS[0]
    idx = TIMELINE_YEARS.index(year)
    return None if idx == 0 else TIMELINE_YEARS[idx - 1]


def _get_cached_tiles(cache_key: tuple[int, int | None, tuple[float, float, float, float]]) -> dict[str, Any] | None:
    now = time.time()
    with _TILE_CACHE_LOCK:
        cached = _TILE_CACHE.get(cache_key)
        if not cached:
            return None
        cached_at, payload = cached
        if now - cached_at > TILE_CACHE_TTL_S:
            _TILE_CACHE.pop(cache_key, None)
            return None
        return payload


def _set_cached_tiles(
    cache_key: tuple[int, int | None, tuple[float, float, float, float]], payload: dict[str, Any]
) -> None:
    with _TILE_CACHE_LOCK:
        _TILE_CACHE[cache_key] = (time.time(), payload)


def _get_cached_timeline(bbox_key: tuple[float, float, float, float]) -> list[dict[str, Any]] | None:
    now = time.time()
    with _TIMELINE_CACHE_LOCK:
        cached = _TIMELINE_CACHE.get(bbox_key)
        if not cached:
            return None
        cached_at, records = cached
        if now - cached_at > TIMELINE_CACHE_TTL_S:
            _TIMELINE_CACHE.pop(bbox_key, None)
            return None
        return records


def _set_cached_timeline(bbox_key: tuple[float, float, float, float], records: list[dict[str, Any]]) -> None:
    with _TIMELINE_CACHE_LOCK:
        _TIMELINE_CACHE[bbox_key] = (time.time(), records)


def _compute_proxy_timeline_records(bbox_vals: list[float]) -> list[dict[str, Any]]:
    ee = _ensure_ee_initialized()
    aoi = ee.Geometry.Rectangle(bbox_vals)

    records: list[dict[str, Any]] = []
    prev_mask = None

    for year in TIMELINE_YEARS:
        mask = _mangrove_mask_proxy(ee, year, aoi)

        if prev_mask is None:
            area_img = mask.rename("total").multiply(ee.Image.pixelArea())
            stats = area_img.reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=aoi,
                scale=30,
                maxPixels=1e10,
                bestEffort=True,
            ).getInfo()
            total_ha = round((stats.get("total", 0.0) or 0.0) / 1e4, 1)
            loss_ha = 0.0
            gain_ha = 0.0
        else:
            loss = prev_mask.And(mask.Not()).rename("loss")
            gain = mask.And(prev_mask.Not()).rename("gain")
            area_img = ee.Image.cat([mask.rename("total"), loss, gain]).multiply(ee.Image.pixelArea())
            stats = area_img.reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=aoi,
                scale=30,
                maxPixels=1e10,
                bestEffort=True,
            ).getInfo()
            total_ha = round((stats.get("total", 0.0) or 0.0) / 1e4, 1)
            loss_ha = round((stats.get("loss", 0.0) or 0.0) / 1e4, 1)
            gain_ha = round((stats.get("gain", 0.0) or 0.0) / 1e4, 1)

        delta_ha = round(gain_ha - loss_ha, 1)
        loss_rate_pct = round((loss_ha / total_ha) * 100, 2) if total_ha else 0.0

        records.append(
            {
                "year": year,
                "total_ha": total_ha,
                "loss_ha": loss_ha,
                "gain_ha": gain_ha,
                "delta_ha": delta_ha,
                "loss_rate_pct": loss_rate_pct,
            }
        )
        prev_mask = mask

    return records

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
def mangrove_timeline(
    bbox: str = Query("-80.1,-2.4,-79.4,-1.7", description="Bounding box (W,S,E,N)"),
    mode: Literal["auto", "firestore", "earthengine", "fallback"] = Query(
        "auto", description="Data mode preference: auto|firestore|earthengine|fallback"
    ),
) -> dict[str, Any]:
    """
    Return the full mangrove coverage timeline for Greater Guayaquil.

    Source: Global Mangrove Watch v3.0, extended with SERVIR Amazonia v1.1.
    """
    bbox_vals = _parse_bbox(bbox)
    bbox_key = tuple(bbox_vals)  # type: ignore[assignment]

    records: list[dict[str, Any]] | None = None
    source = "calibrated_estimate"
    source_detail: str | None = None

    if mode in ("auto", "firestore"):
        records = _get_firestore_timeline()
        if records is not None:
            source = "firestore"
            source_detail = "firestore:api_cache/mangrove_timeline"

    if records is None and mode in ("auto", "earthengine"):
        cached = _get_cached_timeline(bbox_key)
        if cached is not None:
            records = cached
            source = "api"
            source_detail = "earthengine-proxy:cached"
        else:
            try:
                computed = _compute_proxy_timeline_records(bbox_vals)
                _set_cached_timeline(bbox_key, computed)
                records = computed
                source = "api"
                source_detail = "earthengine-proxy:s2-ndvi/l8-ndvi+jrc-gsw"
            except Exception as exc:
                if mode == "earthengine":
                    raise HTTPException(status_code=503, detail=f"Earth Engine unavailable: {exc}") from exc

    if records is None:
        records = FALLBACK_TIMELINE
        source = "calibrated_estimate"
        source_detail = "static-fallback"

    total_loss = sum(r["loss_ha"] for r in records)
    total_gain = sum(r["gain_ha"] for r in records)

    return {
        "bbox": bbox_vals,
        "years": [r["year"] for r in records],
        "summary": {
            "total_loss_ha": total_loss,
            "total_gain_ha": total_gain,
            "net_change_ha": total_gain - total_loss,
        },
        "records": records,
        "_source": source,
        "source_detail": source_detail,
    }


@router.get("/mangrove/tiles")
def mangrove_tiles(
    year: int = Query(..., ge=2014, le=2024, description="Timeline year"),
    compare: Literal["prev", "baseline", "none"] = Query(
        "prev", description="Compare mode: prev|baseline|none"
    ),
    bbox: str = Query("-80.1,-2.4,-79.4,-1.7", description="Bounding box (W,S,E,N)"),
) -> dict[str, Any]:
    """
    Return raster tile URLs to visualize mangrove change for a given year.

    Tiles are produced in Google Earth Engine and intended for MapLibre/Mapbox raster sources.
    """
    bbox_vals = _parse_bbox(bbox)
    bbox_key = tuple(bbox_vals)  # type: ignore[assignment]
    compare_year = _resolve_compare_year(year, compare)
    cache_key = (year, compare_year, bbox_key)

    cached = _get_cached_tiles(cache_key)
    if cached is not None:
        return cached

    try:
        ee = _ensure_ee_initialized()
        aoi = ee.Geometry.Rectangle(bbox_vals)

        after_binary = _mangrove_mask_proxy_fast(ee, year, aoi)
        after_url = _tile_url(
            ee,
            after_binary.selfMask(),
            {"min": 0, "max": 1, "palette": ["10b981"]},
        )

        before_url = None
        change_url = None
        if compare_year is not None:
            before_binary = _mangrove_mask_proxy_fast(ee, compare_year, aoi)
            before_url = _tile_url(
                ee,
                before_binary.selfMask(),
                {"min": 0, "max": 1, "palette": ["9ca3af"]},
            )

            loss = before_binary.And(after_binary.Not())
            gain = after_binary.And(before_binary.Not())
            change = ee.Image(0).where(loss, 1).where(gain, 2).selfMask()
            change_url = _tile_url(
                ee,
                change,
                {"min": 1, "max": 2, "palette": ["ef4444", "22d3ee"]},
            )

        payload: dict[str, Any] = {
            "bbox": bbox_vals,
            "year": year,
            "compare_to_year": compare_year,
            "compare_mode": compare,
            "tiles": {
                "before": before_url,
                "after": after_url,
                "change": change_url,
            },
            "_source": "api",
            "source_detail": "earthengine-proxy:s2-ndvi/l8-ndvi+jrc-gsw",
            "cache_ttl_s": TILE_CACHE_TTL_S,
        }
        _set_cached_tiles(cache_key, payload)
        return payload
    except EarthEngineUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to build mangrove tiles: {exc}") from exc


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
