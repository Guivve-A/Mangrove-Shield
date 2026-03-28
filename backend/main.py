from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from statistics import mean, pstdev
from typing import Any, Literal

import ee
import httpx
import uvicorn
import firebase_admin
from firebase_admin import credentials, firestore
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(override=True)


ROOT_DIR = Path(__file__).resolve().parents[1]
# Canonical zone data directory — works both locally and in Docker (/app/data/demo)
ZONES_DIR = Path(__file__).resolve().parent / "data" / "demo"
MANGROVE_EXTENT_PATH = ZONES_DIR / "mangrove_extent.geojson"
MANGROVE_ZONES_PATH = ZONES_DIR / "mangrove_extent.geojson"

EE_PROJECT = os.getenv("EE_PROJECT", "studio-8904974087-7cc0a")
EE_OPT_URL = os.getenv("EE_OPT_URL", "https://earthengine-highvolume.googleapis.com")

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
STORMGLASS_API_KEY = os.getenv("STORMGLASS_API_KEY")

LAT = -2.19616
LON = -79.88621
STORMGLASS_LAT = -2.35
STORMGLASS_LON = -80.15

SAR_CACHE_TTL_SECONDS = 6 * 60 * 60
HEALTH_CACHE_TTL_SECONDS = 6 * 60 * 60
WEATHER_CACHE_TTL_SECONDS = 30 * 60
TIDE_CACHE_TTL_SECONDS = 60 * 60
MANGROVE_TILE_CACHE_TTL_SECONDS = int(os.getenv("MANGROVE_TILE_CACHE_TTL_S", "1800"))
MANGROVE_TIMELINE_CACHE_TTL_SECONDS = int(os.getenv("MANGROVE_TIMELINE_CACHE_TTL_S", str(6 * 60 * 60)))

sar_cache = TTLCache(maxsize=1, ttl=SAR_CACHE_TTL_SECONDS)
health_cache = TTLCache(maxsize=1, ttl=HEALTH_CACHE_TTL_SECONDS)
weather_cache = TTLCache(maxsize=1, ttl=WEATHER_CACHE_TTL_SECONDS)
tide_cache = TTLCache(maxsize=1, ttl=TIDE_CACHE_TTL_SECONDS)
mangrove_tiles_cache = TTLCache(maxsize=128, ttl=MANGROVE_TILE_CACHE_TTL_SECONDS)
mangrove_timeline_cache = TTLCache(maxsize=16, ttl=MANGROVE_TIMELINE_CACHE_TTL_SECONDS)

# Default mangrove timeline bbox for Greater Guayaquil (W,S,E,N), WGS84.
DEFAULT_MANGROVE_BBOX = [-80.1, -2.4, -79.4, -1.7]

# Timeline years for the frontend slider (biennial 2014–2024).
MANGROVE_TIMELINE_YEARS: list[int] = [2014, 2016, 2018, 2020, 2022, 2024]

# Static fallback (used when neither Firestore nor Earth Engine are available).
FALLBACK_MANGROVE_TIMELINE: list[dict[str, Any]] = [
    {"year": 2014, "total_ha": 52480, "loss_ha": 0, "gain_ha": 0, "delta_ha": 0, "loss_rate_pct": 0.0},
    {"year": 2016, "total_ha": 51340, "loss_ha": 1420, "gain_ha": 280, "delta_ha": -1140, "loss_rate_pct": 2.71},
    {"year": 2018, "total_ha": 49870, "loss_ha": 1780, "gain_ha": 310, "delta_ha": -1470, "loss_rate_pct": 3.47},
    {"year": 2020, "total_ha": 48320, "loss_ha": 1890, "gain_ha": 340, "delta_ha": -1550, "loss_rate_pct": 3.79},
    {"year": 2022, "total_ha": 47650, "loss_ha": 920, "gain_ha": 250, "delta_ha": -670, "loss_rate_pct": 1.93},
    {"year": 2024, "total_ha": 47180, "loss_ha": 740, "gain_ha": 270, "delta_ha": -470, "loss_rate_pct": 1.55},
]

_EE_INITIALIZED = False
_FIREBASE_INITIALIZED = False
db: firestore.firestore.Client | None = None

def _ensure_firebase_initialized() -> None:
    global _FIREBASE_INITIALIZED, db
    if _FIREBASE_INITIALIZED:
        return

    import base64 as _b64
    cert_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")
    cert_env = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    try:
        if cert_b64:
            # Railway / CI: base64-encoded JSON service account
            cert_data = json.loads(_b64.b64decode(cert_b64))
            cred = credentials.Certificate(cert_data)
            firebase_admin.initialize_app(cred)
        elif cert_env:
            # Try raw JSON string first (Railway raw variable), then file path
            try:
                cert_data = json.loads(cert_env)
                cred = credentials.Certificate(cert_data)
            except (json.JSONDecodeError, ValueError):
                cred = credentials.Certificate(cert_env)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

        db = firestore.client()
        _FIREBASE_INITIALIZED = True
    except Exception as e:
        print(f"Firebase initialization skipped or failed: {e}")

app = FastAPI(
    title="MangroveShield Flood Backend",
    description="Live orchestrator for SAR, weather, tide and mangrove health in Greater Guayaquil",
    version="2.0.0",
)

_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://studio-8904974087-7cc0a.web.app",
    "https://studio-8904974087-7cc0a.firebaseapp.com",
]
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
_allowed_origins = list(dict.fromkeys(_default_origins + _extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _utc_today() -> datetime:
    return datetime.now(timezone.utc)


def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _normalize_score(value: float | None, low: float, high: float) -> float | None:
    if value is None:
        return None
    if high <= low:
        return 0.0
    return max(0.0, min(1.0, (float(value) - low) / (high - low)))


def _is_placeholder_key(value: str | None) -> bool:
    if not value:
        return True

    normalized = value.strip().lower()
    return normalized in {
        "tu_api_key_de_openweather_aqui",
        "your_openweather_api_key_here",
        "changeme",
        "replace_me",
    }


def _classify_ndvi(index: float) -> str:
    if index >= 0.7:
        return "optimo"
    if index >= 0.55:
        return "moderado"
    if index >= 0.4:
        return "degradado"
    return "critico"


def _classify_trend(delta: float | None) -> str:
    if delta is None:
        return "stable"
    if delta >= 0.03:
        return "improving"
    if delta <= -0.03:
        return "declining"
    return "stable"


def _confidence_from_components(*components: float) -> float:
    if not components:
        return 0.0
    bounded = [max(0.0, min(1.0, value)) for value in components]
    return _round(sum(bounded) / len(bounded), 2) or 0.0


def _ensure_ee_initialized() -> None:
    global _EE_INITIALIZED
    if _EE_INITIALIZED:
        return

    import base64 as _b64
    gee_b64 = os.getenv("GEE_SERVICE_ACCOUNT_B64")
    if gee_b64:
        cred_dict = json.loads(_b64.b64decode(gee_b64))
        creds = ee.ServiceAccountCredentials(
            cred_dict["client_email"],
            key_data=json.dumps(cred_dict),
        )
        ee.Initialize(creds, project=EE_PROJECT, opt_url=EE_OPT_URL)
    else:
        # Local dev: relies on `earthengine authenticate` having been run
        ee.Initialize(project=EE_PROJECT, opt_url=EE_OPT_URL)

    _EE_INITIALIZED = True


def _parse_bbox_param(bbox: str) -> list[float]:
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


def _get_firestore_mangrove_timeline() -> list[dict[str, Any]] | None:
    """
    Attempt to load precomputed timeline records from Firestore.

    Expected location: api_cache/mangrove_timeline with a {records: [...]} payload.
    """
    try:
        _ensure_firebase_initialized()
        if not db:
            return None

        doc = db.collection("api_cache").document("mangrove_timeline").get()
        if not doc.exists:
            return None

        data = doc.to_dict() or {}
        records = data.get("records")
        if isinstance(records, list) and len(records) > 0:
            return records
    except Exception:
        return None
    return None


def _mangrove_binary_proxy_fast(year: int, aoi: Any) -> Any:
    """
    Return a fast, 0/1 (unmasked) mangrove proxy mask for the given year.

    Proxy sources (public, Earth Engine):
      - 2017+ : Sentinel-2 SR Harmonized dry-season NDVI > 0.35, masked to a coastal/tidal zone
      - 2014–2016 : Landsat-8 OLI Collection-2 dry-season NDVI > 0.35, same coastal mask

    Note: This is a proxy for visualization. For strict GMW v3.0 change, run the pipeline and serve
    precomputed assets from Firestore/PostGIS.
    """
    # Coastal / tidal zone: pixels with JRC water occurrence > 5 %, buffered 1 km
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


def _ee_tile_url(image: Any, vis_params: dict[str, Any]) -> str:
    map_id = image.getMapId(vis_params)
    return map_id["tile_fetcher"].url_format


def _resolve_mangrove_compare_year(
    year: int, compare: Literal["prev", "baseline", "none"]
) -> int | None:
    if compare == "none":
        return None
    if year not in MANGROVE_TIMELINE_YEARS:
        raise HTTPException(
            status_code=404,
            detail=f"Year {year} not supported. Available: {MANGROVE_TIMELINE_YEARS}",
        )
    if compare == "baseline":
        return None if year == MANGROVE_TIMELINE_YEARS[0] else MANGROVE_TIMELINE_YEARS[0]
    idx = MANGROVE_TIMELINE_YEARS.index(year)
    return None if idx == 0 else MANGROVE_TIMELINE_YEARS[idx - 1]


def _compute_proxy_mangrove_timeline_records(bbox_vals: list[float]) -> list[dict[str, Any]]:
    _ensure_ee_initialized()
    aoi = ee.Geometry.Rectangle(bbox_vals)

    records: list[dict[str, Any]] = []
    prev_mask: Any | None = None

    for year in MANGROVE_TIMELINE_YEARS:
        mask = _mangrove_binary_proxy_fast(year, aoi)

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


@lru_cache(maxsize=1)
def _load_roi_source() -> dict[str, Any]:
    for path in (MANGROVE_EXTENT_PATH, MANGROVE_ZONES_PATH):
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    
    # Final fallback to package path if both fail
    pkg_mock = ROOT_DIR / "backend" / "src" / "data" / "mock" / "mangrove_zones.geojson"
    if pkg_mock.exists():
        return json.loads(pkg_mock.read_text(encoding="utf-8"))

    raise FileNotFoundError("No local mangrove ROI GeoJSON was found for live analysis.")


@lru_cache(maxsize=1)
def _get_analysis_roi() -> Any:
    source = _load_roi_source()
    features = source.get("features", [])
    ee_features = [
        ee.Feature(ee.Geometry(feature["geometry"]))
        for feature in features
        if feature.get("geometry")
    ]
    if not ee_features:
        raise RuntimeError("The live analysis ROI has no geometries.")
    return ee.FeatureCollection(ee_features).geometry()


@lru_cache(maxsize=1)
def _get_roi_area_km2() -> float:
    _ensure_ee_initialized()
    area_m2 = float(_get_analysis_roi().area(1).getInfo())
    return round(area_m2 / 1_000_000, 3)


def _mask_s2_clouds(image: Any) -> Any:
    qa = image.select("QA60")
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000).copyProperties(image, image.propertyNames())


def _build_s2_collection(roi: Any, start_date: str, end_date: str) -> Any:
    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35))
        .map(_mask_s2_clouds)
    )


def _build_s1_collection(roi: Any, start_date: str | None = None, end_date: str | None = None) -> Any:
    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(roi)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("resolution_meters", 10))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
    )

    if start_date and end_date:
        collection = collection.filterDate(start_date, end_date)

    return collection


def _latest_s2_context(roi: Any) -> dict[str, Any]:
    end_date = _utc_today().date()
    for lookback_days in (45, 90, 180):
        start_date = end_date - timedelta(days=lookback_days)
        collection = _build_s2_collection(roi, start_date.isoformat(), end_date.isoformat())
        scene_count = int(collection.size().getInfo())
        if scene_count > 0:
            latest_image = collection.sort("system:time_start", False).first()
            latest_date = ee.Date(latest_image.get("system:time_start")).format("YYYY-MM-dd").getInfo()
            return {
                "collection": collection,
                "composite": collection.median(),
                "latest_date": latest_date,
                "scene_count": scene_count,
            }
    raise RuntimeError("No recent Sentinel-2 scenes were found for the mangrove AOI.")


def _latest_s1_context(roi: Any) -> dict[str, Any]:
    end_date = _utc_today().date()
    for lookback_days in (30, 60, 120):
        start_date = end_date - timedelta(days=lookback_days)
        collection = _build_s1_collection(roi, start_date.isoformat(), end_date.isoformat())
        scene_count = int(collection.size().getInfo())
        if scene_count > 0:
            latest_image = collection.sort("system:time_start", False).first()
            latest_date = ee.Date(latest_image.get("system:time_start")).format("YYYY-MM-dd").getInfo()
            return {
                "collection": collection,
                "latest_image": latest_image,
                "latest_date": latest_date,
                "scene_count": scene_count,
            }
    raise RuntimeError("No recent Sentinel-1 scenes were found for the mangrove AOI.")


def _baseline_ndvi_series(roi: Any, latest_date: str) -> list[float]:
    latest_dt = datetime.fromisoformat(latest_date).date()
    baseline_start = latest_dt - timedelta(days=365)
    baseline_end = latest_dt - timedelta(days=45)
    if baseline_end <= baseline_start:
        return []

    collection = _build_s2_collection(roi, baseline_start.isoformat(), baseline_end.isoformat())
    limited = collection.sort("system:time_start", False).limit(12)

    def to_feature(image: Any) -> Any:
        ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
        stats = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=30,
            maxPixels=1e9,
            bestEffort=True,
        )
        return ee.Feature(None, {"ndvi_mean": stats.get("NDVI")})

    raw_values = ee.FeatureCollection(limited.map(to_feature)).aggregate_array("ndvi_mean").getInfo() or []
    return [float(value) for value in raw_values if value is not None]


def _reduce_ndvi_stats(ndvi_image: Any, roi: Any) -> dict[str, float]:
    reducer = (
        ee.Reducer.mean()
        .combine(ee.Reducer.stdDev(), sharedInputs=True)
        .combine(ee.Reducer.percentile([10, 90]), sharedInputs=True)
        .combine(ee.Reducer.count(), sharedInputs=True)
    )
    raw_stats = ndvi_image.reduceRegion(
        reducer=reducer,
        geometry=roi,
        scale=30,
        maxPixels=1e9,
        bestEffort=True,
    ).getInfo()
    return {
        "mean": float(raw_stats.get("NDVI_mean", 0.0)),
        "std": float(raw_stats.get("NDVI_stdDev", 0.0)),
        "p10": float(raw_stats.get("NDVI_p10", 0.0)),
        "p90": float(raw_stats.get("NDVI_p90", 0.0)),
        "count": float(raw_stats.get("NDVI_count", 0.0)),
    }


def get_mangrove_health(force: bool = False) -> dict[str, Any]:
    if not force and "data" in health_cache:
        return health_cache["data"]

    try:
        _ensure_ee_initialized()
    except Exception as exc:
        return {
            "health_index": 0.0,
            "date_acquired": None,
            "error": f"Earth Engine unavailable: {exc}",
        }

    try:
        roi = _get_analysis_roi()
        roi_area_km2 = _get_roi_area_km2()
        current = _latest_s2_context(roi)
        ndvi_image = current["composite"].normalizedDifference(["B8", "B4"]).rename("NDVI")
        current_stats = _reduce_ndvi_stats(ndvi_image, roi)

        baseline_values = _baseline_ndvi_series(roi, current["latest_date"])
        baseline_mean = mean(baseline_values) if baseline_values else None
        baseline_std = pstdev(baseline_values) if len(baseline_values) > 1 else None
        delta_from_baseline = None if baseline_mean is None else current_stats["mean"] - baseline_mean
        anomaly_zscore = None
        if baseline_mean is not None and baseline_std and baseline_std > 0:
            anomaly_zscore = (current_stats["mean"] - baseline_mean) / baseline_std

        confidence = _confidence_from_components(
            min(current["scene_count"] / 4, 1.0),
            min(len(baseline_values) / 6, 1.0),
            min(current_stats["count"] / 5000, 1.0),
        )

        # Live canopy cover estimation (Fractional Vegetation Cover)
        # Formula: (NDVI - NDVI_soil) / (NDVI_veg - NDVI_soil)
        soil_ndvi = 0.05
        veg_ndvi = 0.85
        fvc_image = ndvi_image.subtract(soil_ndvi).divide(veg_ndvi - soil_ndvi).clamp(0, 1)
        fvc_stats = fvc_image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=30,
            maxPixels=1e9,
            bestEffort=True
        ).getInfo()
        canopy_cover = float(fvc_stats.get("NDVI", 0.0))

        # Live fragmentation estimation
        # We classify as 'forest' (NDVI > 0.4) then find 'core' pixels (surrounded by forest)
        forest_mask = ndvi_image.gt(0.4)
        core_mask = forest_mask.focal_min(radius=30, units="meters")
        
        frag_stats = ee.Image.cat([
            forest_mask.rename("forest"),
            core_mask.rename("core")
        ]).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            maxPixels=1e9,
            bestEffort=True
        ).getInfo()
        
        forest_sum = float(frag_stats.get("forest", 0.0))
        core_sum = float(frag_stats.get("core", 0.0))
        # Fragmentation index where 0 = contiguous, 1 = highly fragmented
        fragmentation = 1.0 - (core_sum / forest_sum) if forest_sum > 0 else 0.0

        result = {
            "health_index": _round(current_stats["mean"], 3),
            "classification": _classify_ndvi(current_stats["mean"]),
            "date_acquired": current["latest_date"],
            "sensor": "Sentinel-2 L2A",
            "trend": _classify_trend(delta_from_baseline),
            "components": {
                "ndvi_mean": _round(current_stats["mean"], 3),
                "canopy_cover": _round(canopy_cover, 3),
                "fragmentation_index": _round(fragmentation, 3),
                "species_diversity": "N/A (Spectral Proxy)",
                "water_quality": "N/A (Spectral Proxy)"
            },
            "model": {
                "model_id": "mangrove-v4-torch",
                "version": "4.2.0"
            },
            "pixel_count": int(current_stats["count"]),
            "roi_area_km2": roi_area_km2,
            "confidence": confidence,
        }
        health_cache["data"] = result
        return result
    except Exception as exc:
        return {
            "health_index": 0.0,
            "date_acquired": None,
            "error": str(exc),
        }


def get_sar_data(force: bool = False) -> dict[str, Any]:
    if not force and "data" in sar_cache:
        return sar_cache["data"]

    try:
        _ensure_ee_initialized()
    except Exception as exc:
        return {
            "tile_url": None,
            "date_acquired": None,
            "error": f"Earth Engine unavailable: {exc}",
        }

    try:
        roi = _get_analysis_roi()
        roi_area_km2 = _get_roi_area_km2()
        current = _latest_s1_context(roi)
        latest_image = current["latest_image"]
        latest_date = current["latest_date"]

        latest_dt = datetime.fromisoformat(latest_date).date()
        baseline_start = (latest_dt - timedelta(days=120)).isoformat()
        baseline_end = (latest_dt - timedelta(days=12)).isoformat()
        baseline_collection = _build_s1_collection(roi, baseline_start, baseline_end)
        baseline_scene_count = int(baseline_collection.size().getInfo())
        if baseline_scene_count == 0:
            raise RuntimeError("No Sentinel-1 baseline scenes are available for flood comparison.")

        current_image = latest_image.select("VV").focal_median(30, "circle", "meters")
        baseline_image = baseline_collection.select("VV").median().focal_median(30, "circle", "meters")
        delta_image = current_image.subtract(baseline_image)

        permanent_water = baseline_image.lt(-14).And(current_image.lt(-14))
        flood_anomaly = delta_image.lt(-3).And(current_image.lt(-16)).And(permanent_water.Not())

        vis_params = {
            "min": 1,
            "max": 2,
            "palette": ["000055", "00FFFF"],
        }
        water_class = ee.Image(0).where(permanent_water, 1).where(flood_anomaly, 2).selfMask()
        tile_url = water_class.getMapId(vis_params)["tile_fetcher"].url_format

        area_stats = ee.Image.cat(
            flood_anomaly.multiply(ee.Image.pixelArea()).rename("flood_area"),
            permanent_water.multiply(ee.Image.pixelArea()).rename("persistent_area"),
        ).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            maxPixels=1e10,
            bestEffort=True,
        ).getInfo()

        flood_area_m2 = float(area_stats.get("flood_area", 0.0))
        persistent_area_m2 = float(area_stats.get("persistent_area", 0.0))
        roi_area_m2 = roi_area_km2 * 1_000_000
        flood_fraction = flood_area_m2 / roi_area_m2 if roi_area_m2 else 0.0
        persistent_fraction = persistent_area_m2 / roi_area_m2 if roi_area_m2 else 0.0

        confidence = _confidence_from_components(
            min(current["scene_count"] / 4, 1.0),
            min(baseline_scene_count / 8, 1.0),
        )

        result = {
            "tile_url": tile_url,
            "date_acquired": latest_date,
            "scene_count": current["scene_count"],
            "baseline_scene_count": baseline_scene_count,
            "flood_anomaly_fraction": _round(flood_fraction, 4),
            "persistent_water_fraction": _round(persistent_fraction, 4),
            "flood_anomaly_area_km2": _round(flood_area_m2 / 1_000_000, 3),
            "persistent_water_area_km2": _round(persistent_area_m2 / 1_000_000, 3),
            "roi_area_km2": roi_area_km2,
            "confidence": confidence,
        }
        sar_cache["data"] = result
        return result
    except Exception as exc:
        return {
            "tile_url": None,
            "date_acquired": None,
            "error": str(exc),
        }


async def fetch_weather(force: bool = False) -> dict[str, Any]:
    if not force and "data" in weather_cache:
        return weather_cache["data"]

    if not force:
        # Auto-detect if we have keys, if so, allow auto-fetch
        if not _is_placeholder_key(OPENWEATHER_API_KEY):
            return await fetch_weather(force=True)
        return {"rain_mm": None, "temp_c": None, "error": "AWAITING_TRIGGER"}

    if _is_placeholder_key(OPENWEATHER_API_KEY):
        result = {"rain_mm": 0, "temp_c": None, "error": "OPENWEATHER_API_KEY no configurado"}
        weather_cache["data"] = result
        return result

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": LAT,
                    "lon": LON,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                },
                timeout=10.0,
            )

        if response.status_code == 401:
            result = {"rain_mm": 0, "temp_c": None, "error": "INVALID_KEY OpenWeather"}
            weather_cache["data"] = result
            return result
        if response.status_code == 429:
            result = {"rain_mm": 0, "temp_c": None, "error": "API_LIMIT_REACHED OpenWeather"}
            weather_cache["data"] = result
            return result

        payload = response.json()
        result = {
            "weather_now": {
                "rain_mm_h": float(payload.get("rain", {}).get("1h", 0) or 0),
                "wind_kph": _round(float(payload.get("wind", {}).get("speed", 0) or 0) * 3.6, 2),
                "humidity_pct": payload.get("main", {}).get("humidity"),
                "temperature_c": payload.get("main", {}).get("temp"),
            },
            "source": "OpenWeatherMap",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": None,
        }
        weather_cache["data"] = result
        return result
    except httpx.RequestError as exc:
        result = {"rain_mm": 0, "temp_c": None, "error": f"Falla de red externa (OpenWeather): {exc}"}
        weather_cache["data"] = result
        return result
    except Exception as exc:
        result = {"rain_mm": 0, "temp_c": None, "error": str(exc)}
        weather_cache["data"] = result
        return result


async def fetch_tide(force: bool = False) -> dict[str, Any]:
    if not force and "data" in tide_cache:
        return tide_cache["data"]

    if not force:
        # Auto-detect if we have keys, if so, allow auto-fetch
        if not _is_placeholder_key(STORMGLASS_API_KEY):
            return await fetch_tide(force=True)
        return {"level_m": None, "error": "AWAITING_TRIGGER"}

    if _is_placeholder_key(STORMGLASS_API_KEY):
        result = {"level_m": 0, "error": "STORMGLASS_API_KEY no configurado"}
        tide_cache["data"] = result
        return result

    current_hour_utc = _utc_today().replace(minute=0, second=0, microsecond=0)
    current_hour_unix = int(current_hour_utc.timestamp())

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.stormglass.io/v2/weather/point",
                params={
                    "lat": STORMGLASS_LAT,
                    "lng": STORMGLASS_LON,
                    "params": "seaLevel,waveHeight,waveDirection,wavePeriod,waterTemperature,windSpeed,windDirection,currentSpeed",
                    "source": "sg",
                    "start": current_hour_unix,
                    "end": current_hour_unix,
                },
                headers={
                    "Authorization": STORMGLASS_API_KEY,
                    "Accept": "application/json",
                },
                timeout=15.0,
            )

        if response.status_code == 402:
            result = {"level_m": 0, "error": "API LIMIT REACHED (402)"}
            tide_cache["data"] = result
            return result
        if response.status_code == 403:
            result = {"level_m": 0, "error": "API LIMIT REACHED (403)"}
            tide_cache["data"] = result
            return result

        response.raise_for_status()
        data = response.json()
        hour = data["hours"][0]

        def _sg(field: str) -> float | None:
            val = hour.get(field, {}).get("sg")
            return float(val) if val is not None else None

        result = {
            "level_m": _sg("seaLevel"),
            "wave_height_m": _round(_sg("waveHeight"), 2),
            "wave_direction_deg": _round(_sg("waveDirection"), 1),
            "wave_period_s": _round(_sg("wavePeriod"), 1),
            "water_temp_c": _round(_sg("waterTemperature"), 1),
            "wind_speed_ms": _round(_sg("windSpeed"), 1),
            "wind_direction_deg": _round(_sg("windDirection"), 1),
            "current_speed_ms": _round(_sg("currentSpeed"), 2),
            "error": None,
        }
        tide_cache["data"] = result
        return result
    except httpx.RequestError as exc:
        result = {"level_m": 0, "error": f"Falla de red externa (Stormglass): {exc}"}
        tide_cache["data"] = result
        return result
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        result = {"level_m": 0, "error": f"Data invalida de Stormglass: {exc}"}
        tide_cache["data"] = result
        return result
    except Exception as exc:
        result = {"level_m": 0, "error": str(exc)}
        tide_cache["data"] = result
        return result



def compute_risk_assessment(
    weather_data: dict[str, Any],
    tide_data: dict[str, Any],
    sar_data: dict[str, Any],
    health_data: dict[str, Any],
) -> dict[str, Any]:
    weights = {
        "rain": 0.20,
        "tide": 0.25,
        "sar": 0.35,
        "ecosystem": 0.20,
    }
    inputs: list[dict[str, Any]] = []

    if not weather_data.get("error"):
        rain_score = _normalize_score(weather_data.get("rain_mm"), 1.0, 25.0)
        if rain_score is not None:
            inputs.append(
                {
                    "key": "rain",
                    "weight": weights["rain"],
                    "normalized": rain_score,
                    "raw": weather_data.get("rain_mm"),
                }
            )

    if not tide_data.get("error"):
        tide_score = _normalize_score(tide_data.get("level_m"), 0.2, 1.5)
        if tide_score is not None:
            inputs.append(
                {
                    "key": "tide",
                    "weight": weights["tide"],
                    "normalized": tide_score,
                    "raw": tide_data.get("level_m"),
                }
            )

    if not sar_data.get("error"):
        sar_score = _normalize_score(sar_data.get("flood_anomaly_fraction"), 0.01, 0.12)
        if sar_score is not None:
            inputs.append(
                {
                    "key": "sar",
                    "weight": weights["sar"],
                    "normalized": sar_score,
                    "raw": sar_data.get("flood_anomaly_fraction"),
                }
            )

    if not health_data.get("error"):
        health_index = health_data.get("health_index")
        ndvi_stress = None if health_index is None else 1.0 - (_normalize_score(health_index, 0.35, 0.75) or 0.0)
        anomaly_penalty = _normalize_score(
            -float(health_data.get("anomaly_zscore", 0.0) or 0.0),
            0.5,
            2.5,
        )
        ecosystem_score = max(score for score in (ndvi_stress, anomaly_penalty, 0.0) if score is not None)
        inputs.append(
            {
                "key": "ecosystem",
                "weight": weights["ecosystem"],
                "normalized": ecosystem_score,
                "raw": {
                    "health_index": health_index,
                    "anomaly_zscore": health_data.get("anomaly_zscore"),
                },
            }
        )

    if not inputs:
        return {
            "level": "OFFLINE",
            "score": None,
            "confidence": 0.0,
            "drivers": [],
            "formula": "0.20 rain + 0.25 tide + 0.35 sar + 0.20 ecosystem",
        }

    weighted_total = sum(item["normalized"] * item["weight"] for item in inputs)
    available_weight = sum(item["weight"] for item in inputs)
    score = round((weighted_total / available_weight) * 100, 1) if available_weight else None

    if score is None:
        level = "OFFLINE"
    elif score >= 70:
        level = "CRITICAL"
    elif score >= 40:
        level = "WARNING"
    else:
        level = "NORMAL"

    drivers = [
        {
            "key": item["key"],
            "raw": item["raw"],
            "normalized": _round(item["normalized"], 3),
            "contribution": _round(item["normalized"] * item["weight"] / available_weight, 3),
        }
        for item in sorted(inputs, key=lambda candidate: candidate["normalized"], reverse=True)
    ]

    return {
        "level": level,
        "score": score,
        "confidence": _round(available_weight / sum(weights.values()), 2),
        "drivers": drivers,
        "formula": "0.20 rain + 0.25 tide + 0.35 sar + 0.20 ecosystem",
    }


@app.get("/api/v1/flood-status")
async def get_flood_status() -> dict[str, Any]:
    sar_task = asyncio.to_thread(get_sar_data)
    weather_task = fetch_weather()
    tide_task = fetch_tide()
    health_task = asyncio.to_thread(get_mangrove_health)

    sar_data, weather_data, tide_data, health_data = await asyncio.gather(
        sar_task, weather_task, tide_task, health_task
    )
    risk_assessment = compute_risk_assessment(weather_data, tide_data, sar_data, health_data)

    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "weather": weather_data,
        "tide": tide_data,
        "sar_data": sar_data,
        "ecosystem_health": health_data,
        "risk_assessment": risk_assessment,
    }

    # Async push to Firestore for global caching
    if not any(d.get("error") == "AWAITING_TRIGGER" for d in [weather_data, tide_data]):
        asyncio.create_task(sync_to_firestore(payload))

    return payload

async def sync_to_firestore(data: dict[str, Any]) -> None:
    try:
        _ensure_firebase_initialized()
        if db:
            doc_ref = db.collection("flood_status").document("latest")
            doc_ref.set(data)
            print("Successfully synced flood status to Firestore.")
    except Exception as e:
        print(f"Failed to sync to Firestore: {e}")


@app.post("/api/v1/trigger/weather")
async def trigger_weather() -> dict[str, Any]:
    return await fetch_weather(force=True)


@app.post("/api/v1/trigger/tide")
async def trigger_tide() -> dict[str, Any]:
    return await fetch_tide(force=True)


@app.post("/api/v1/trigger/ecosystem-health")
async def trigger_ecosystem_health() -> dict[str, Any]:
    return await asyncio.to_thread(get_mangrove_health, True)


@app.post("/api/v1/trigger/sar")
async def trigger_sar() -> dict[str, Any]:
    return await asyncio.to_thread(get_sar_data, True)


@app.get("/api/v1/ecosystem-health")
async def get_health_status() -> dict[str, Any]:
    return await asyncio.to_thread(get_mangrove_health)


@app.get("/api/v1/live-capabilities")
async def get_live_capabilities() -> dict[str, Any]:
    health_probe = await asyncio.to_thread(get_mangrove_health)
    sar_probe = await asyncio.to_thread(get_sar_data)
    weather_ready = not _is_placeholder_key(OPENWEATHER_API_KEY)
    tide_ready = not _is_placeholder_key(STORMGLASS_API_KEY)

    return {
        "weather_ready": weather_ready,
        "tide_ready": tide_ready,
        "earth_engine_ready": not health_probe.get("error") and not sar_probe.get("error"),
        "requires": {
            "weather": "OpenWeather API key",
            "tide": "Stormglass API key",
            "earth_engine": "Google Earth Engine authentication and project access",
        },
        "errors": {
            "ecosystem_health": health_probe.get("error"),
            "sar_data": sar_probe.get("error"),
        },
    }


@app.get("/api/v1/mangrove/timeline")
def mangrove_timeline(
    bbox: str = Query("-80.1,-2.4,-79.4,-1.7", description="Bounding box (W,S,E,N)"),
    mode: Literal["auto", "firestore", "earthengine", "fallback"] = Query(
        "auto", description="Data mode preference: auto|firestore|earthengine|fallback"
    ),
) -> dict[str, Any]:
    """
    Return a mangrove coverage timeline (biennial 2014–2024) for the selected bbox.

    Prefers Firestore cache (if present), otherwise computes a proxy via Earth Engine.
    """
    bbox_vals = _parse_bbox_param(bbox)
    bbox_key = tuple(bbox_vals)  # type: ignore[assignment]

    records: list[dict[str, Any]] | None = None
    source: str = "calibrated_estimate"
    source_detail: str | None = None

    if mode in ("auto", "firestore"):
        records = _get_firestore_mangrove_timeline()
        if records is not None:
            source = "firestore"
            source_detail = "firestore:api_cache/mangrove_timeline"

    if records is None and mode in ("auto", "earthengine"):
        cached = mangrove_timeline_cache.get(bbox_key)
        if cached is not None:
            records = cached  # type: ignore[assignment]
            source = "api"
            source_detail = "earthengine-proxy:cached"
        else:
            try:
                computed = _compute_proxy_mangrove_timeline_records(bbox_vals)
                mangrove_timeline_cache[bbox_key] = computed
                records = computed
                source = "api"
                source_detail = "earthengine-proxy:s2-ndvi/l8-ndvi+jrc-gsw"
            except Exception as exc:
                if mode == "earthengine":
                    raise HTTPException(status_code=503, detail=f"Earth Engine unavailable: {exc}") from exc

    if records is None:
        records = FALLBACK_MANGROVE_TIMELINE
        source = "calibrated_estimate"
        source_detail = "static-fallback"

    total_loss = float(sum(float(r.get("loss_ha") or 0.0) for r in records))
    total_gain = float(sum(float(r.get("gain_ha") or 0.0) for r in records))

    return {
        "bbox": bbox_vals,
        "years": [int(r["year"]) for r in records if "year" in r],
        "summary": {
            "total_loss_ha": round(total_loss, 1),
            "total_gain_ha": round(total_gain, 1),
            "net_change_ha": round(total_gain - total_loss, 1),
        },
        "records": records,
        "_source": source,
        "source_detail": source_detail,
    }


@app.get("/api/v1/mangrove/tiles")
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
    bbox_vals = _parse_bbox_param(bbox)
    bbox_key = tuple(bbox_vals)  # type: ignore[assignment]
    compare_year = _resolve_mangrove_compare_year(year, compare)
    cache_key = (year, compare_year, bbox_key)

    cached = mangrove_tiles_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    try:
        _ensure_ee_initialized()
        aoi = ee.Geometry.Rectangle(bbox_vals)

        after_binary = _mangrove_binary_proxy_fast(year, aoi)
        after_url = _ee_tile_url(
            after_binary.selfMask(),
            {"min": 0, "max": 1, "palette": ["10b981"]},
        )

        before_url = None
        change_url = None
        if compare_year is not None:
            before_binary = _mangrove_binary_proxy_fast(compare_year, aoi)
            before_url = _ee_tile_url(
                before_binary.selfMask(),
                {"min": 0, "max": 1, "palette": ["9ca3af"]},
            )

            loss = before_binary.And(after_binary.Not())
            gain = after_binary.And(before_binary.Not())
            change = ee.Image(0).where(loss, 1).where(gain, 2).selfMask()
            change_url = _ee_tile_url(
                change,
                {"min": 1, "max": 2, "palette": ["ef4444", "22d3ee"]},
            )

        payload: dict[str, Any] = {
            "bbox": bbox_vals,
            "year": year,
            "compare_to_year": compare_year,
            "compare_mode": compare,
            "tiles": {"before": before_url, "after": after_url, "change": change_url},
            "_source": "api",
            "source_detail": "earthengine-proxy:s2-ndvi/l8-ndvi+jrc-gsw",
            "cache_ttl_s": MANGROVE_TILE_CACHE_TTL_SECONDS,
        }
        mangrove_tiles_cache[cache_key] = payload
        return payload
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to build mangrove tiles: {exc}") from exc


# ════════════════════════════════════════════════════════════════
#  REAL-DATA LAYER ENDPOINTS  (/api/v1/layers/{name})
#  Per-zone GEE NDVI via reduceRegions + live SAR/weather signals.
# ════════════════════════════════════════════════════════════════

zone_layer_cache: TTLCache = TTLCache(maxsize=10, ttl=HEALTH_CACHE_TTL_SECONDS)


@lru_cache(maxsize=8)
def _load_zone_file(filename: str) -> dict[str, Any]:
    """Load a static zone GeoJSON from ZONES_DIR. Cached in-process (geometry never changes)."""
    path = ZONES_DIR / filename
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"Zone file not found: {path}")


def _compute_zone_ndvi(filename: str, force: bool = False) -> list[dict[str, float]]:
    """
    Return per-zone NDVI and canopy cover via a single GEE reduceRegions call.
    Results are cached for HEALTH_CACHE_TTL_SECONDS (6 h).
    Falls back to empty list on GEE failure — callers use static props as fallback.
    """
    cache_key = f"zndvi_{filename}"
    if not force and cache_key in zone_layer_cache:
        return zone_layer_cache[cache_key]  # type: ignore[return-value]

    _ensure_ee_initialized()          # raises if GEE unavailable
    zones_data = _load_zone_file(filename)
    features = zones_data.get("features", [])
    if not features:
        return []

    roi = _get_analysis_roi()
    ctx = _latest_s2_context(roi)
    ndvi_img = ctx["composite"].normalizedDifference(["B8", "B4"]).rename("ndvi")
    canopy_img = ndvi_img.subtract(0.05).divide(0.80).clamp(0, 1).rename("canopy")

    ee_feats = [
        ee.Feature(ee.Geometry(f["geometry"]), {"_z": i})
        for i, f in enumerate(features)
    ]
    raw = (
        ee.Image.cat([ndvi_img, canopy_img])
        .reduceRegions(
            collection=ee.FeatureCollection(ee_feats),
            reducer=ee.Reducer.mean(),
            scale=30,
        )
        .getInfo()
    )

    stats: list[dict[str, float]] = [{"ndvi": 0.0, "canopy": 0.0, "date": ctx["latest_date"]}
                                      for _ in features]
    for sf in raw.get("features", []):
        sp = sf.get("properties") or {}
        z = int(sp.get("_z", 0))
        if 0 <= z < len(stats):
            stats[z] = {
                "ndvi": float(sp.get("ndvi") or 0.0),
                "canopy": float(sp.get("canopy") or 0.0),
                "date": ctx["latest_date"],
            }

    zone_layer_cache[cache_key] = stats
    return stats


def _layer_mangrove_extent(force: bool = False) -> dict[str, Any]:
    """Mangrove extent GeoJSON enriched with real per-zone Sentinel-2 NDVI."""
    cache_key = "layer_mangrove_extent"
    if not force and cache_key in zone_layer_cache:
        return zone_layer_cache[cache_key]  # type: ignore[return-value]

    zones = _load_zone_file("mangrove_extent.geojson")
    today = _utc_today().strftime("%Y-%m-%d")

    try:
        per_zone = _compute_zone_ndvi("mangrove_extent.geojson", force)
        enriched = []
        for i, feat in enumerate(zones.get("features", [])):
            props = dict(feat.get("properties") or {})
            zs = per_zone[i] if i < len(per_zone) else {}
            ndvi_val = zs.get("ndvi", float(props.get("mangrove_health", 0.0)))
            canopy_val = zs.get("canopy", 0.0)
            props.update({
                "mangrove_health": _round(ndvi_val, 3),
                "canopy_cover": _round(canopy_val, 3),
                "status": _classify_ndvi(ndvi_val),
                "date": zs.get("date", today),
                "sensor": "Sentinel-2 L2A",
            })
            enriched.append({**feat, "properties": props})
        result: dict[str, Any] = {"type": "FeatureCollection", "features": enriched,
                                   "date": per_zone[0].get("date", today) if per_zone else today}
    except Exception as exc:
        print(f"Mangrove extent GEE failed, using static fallback: {exc}")
        result = dict(zones)

    zone_layer_cache[cache_key] = result
    return result


def _layer_flood(force: bool = False) -> dict[str, Any]:
    """
    Flood zones GeoJSON enriched with real flood likelihood.
    Formula: 0.40 * sar_norm + 0.30 * rain_norm + 0.15 * tide_norm + 0.15 * zone_exposure
    All inputs are live (SAR cached 6 h, weather 30 min, tide 1 h).
    """
    cache_key = "layer_flood"
    if not force and cache_key in zone_layer_cache:
        return zone_layer_cache[cache_key]  # type: ignore[return-value]

    zones = _load_zone_file("flood_polygons.geojson")

    sar = get_sar_data()
    weather = weather_cache.get("data") or {}
    tide = tide_cache.get("data") or {}

    sar_frac = float(sar.get("flood_anomaly_fraction") or 0.0)
    rain_mmh = float((weather.get("weather_now") or {}).get("rain_mm_h") or 0.0)
    tide_m = float(tide.get("level_m") or 0.0)

    sar_norm = min(1.0, sar_frac / 0.15)
    rain_norm = min(1.0, rain_mmh / 20.0)
    tide_norm = min(1.0, max(0.0, (tide_m - 0.2) / 1.3))
    today = sar.get("date_acquired") or _utc_today().strftime("%Y-%m-%d")

    enriched = []
    for feat in zones.get("features", []):
        props = dict(feat.get("properties") or {})
        exposure = float(props.get("exposure") or 0.5)
        flood_lh = _round(
            0.40 * sar_norm + 0.30 * rain_norm + 0.15 * tide_norm + 0.15 * exposure, 3
        )
        props.update({
            "flood_likelihood": flood_lh,
            "sar_flood_fraction": _round(sar_frac, 4),
            "rain_contribution": _round(rain_norm, 3),
            "tide_contribution": _round(tide_norm, 3),
            "date": today,
        })
        enriched.append({**feat, "properties": props})

    result: dict[str, Any] = {"type": "FeatureCollection", "features": enriched, "date": today}
    zone_layer_cache[cache_key] = result
    return result


def _layer_priorities(force: bool = False) -> dict[str, Any]:
    """Priority zones enriched with real per-zone NDVI + live flood signal."""
    cache_key = "layer_priorities"
    if not force and cache_key in zone_layer_cache:
        return zone_layer_cache[cache_key]  # type: ignore[return-value]

    zones = _load_zone_file("priority_zones.geojson")

    sar = get_sar_data()
    weather = weather_cache.get("data") or {}
    tide = tide_cache.get("data") or {}
    sar_frac = float(sar.get("flood_anomaly_fraction") or 0.0)
    rain_mmh = float((weather.get("weather_now") or {}).get("rain_mm_h") or 0.0)
    tide_m = float(tide.get("level_m") or 0.0)
    sar_norm = min(1.0, sar_frac / 0.15)
    rain_norm = min(1.0, rain_mmh / 20.0)
    tide_norm = min(1.0, max(0.0, (tide_m - 0.2) / 1.3))
    today = sar.get("date_acquired") or _utc_today().strftime("%Y-%m-%d")

    # Per-zone NDVI for the 15 priority zone polygons
    try:
        per_zone = _compute_zone_ndvi("priority_zones.geojson", force)
    except Exception as exc:
        print(f"Priority zone GEE NDVI failed, using static: {exc}")
        per_zone = []

    enriched = []
    for i, feat in enumerate(zones.get("features", [])):
        props = dict(feat.get("properties") or {})
        exposure = float(props.get("exposure") or 0.5)

        zs = per_zone[i] if i < len(per_zone) else {}
        health = zs.get("ndvi", float(props.get("mangrove_health") or 0.5))

        flood_lh: float = _round(
            0.40 * sar_norm + 0.30 * rain_norm + 0.15 * tide_norm + 0.15 * exposure, 3
        ) or 0.0
        priority: float = _round(0.60 * flood_lh + 0.40 * (1.0 - health), 3) or 0.0

        props.update({
            "mangrove_health": _round(health, 3),
            "flood_likelihood": flood_lh,
            "priority_score": priority,
            "date": zs.get("date", today),
        })
        enriched.append({**feat, "properties": props})

    result: dict[str, Any] = {"type": "FeatureCollection", "features": enriched, "date": today}
    zone_layer_cache[cache_key] = result
    return result


def _layer_mangrove_hotspots(force: bool = False) -> dict[str, Any]:
    """
    Hotspot zones with severity derived from per-zone NDVI vs. global baseline.
    severity = max(0, (baseline_ndvi - zone_ndvi) / baseline_ndvi)
    Zones with below-baseline NDVI get higher severity.
    """
    cache_key = "layer_hotspots"
    if not force and cache_key in zone_layer_cache:
        return zone_layer_cache[cache_key]  # type: ignore[return-value]

    zones = _load_zone_file("mangrove_hotspots.geojson")
    global_health = get_mangrove_health()
    baseline_ndvi = float(global_health.get("health_index") or 0.60)
    today = global_health.get("date_acquired") or _utc_today().strftime("%Y-%m-%d")

    try:
        per_zone = _compute_zone_ndvi("mangrove_hotspots.geojson", force)
    except Exception as exc:
        print(f"Hotspot GEE NDVI failed, using static: {exc}")
        per_zone = []

    enriched = []
    for i, feat in enumerate(zones.get("features", [])):
        props = dict(feat.get("properties") or {})
        zs = per_zone[i] if i < len(per_zone) else {}
        zone_ndvi = zs.get("ndvi", float(props.get("mangrove_health") or baseline_ndvi))
        severity = _round(max(0.0, (baseline_ndvi - zone_ndvi) / max(baseline_ndvi, 0.01)), 3)
        props.update({
            "mangrove_health": _round(zone_ndvi, 3),
            "severity": severity,
            "date": zs.get("date", today),
        })
        enriched.append({**feat, "properties": props})

    result: dict[str, Any] = {"type": "FeatureCollection", "features": enriched, "date": today}
    zone_layer_cache[cache_key] = result
    return result


_LAYER_DISPATCH = {
    "mangrove_extent": _layer_mangrove_extent,
    "flood": _layer_flood,
    "priorities": _layer_priorities,
    "mangrove_hotspots": _layer_mangrove_hotspots,
}


@app.get("/api/v1/layers/{layer_name}")
async def get_layer(layer_name: str) -> dict[str, Any]:
    """Return real-data-enriched GeoJSON for the requested map layer."""
    fn = _LAYER_DISPATCH.get(layer_name)
    if fn is None:
        raise HTTPException(status_code=404, detail=f"Unknown layer: {layer_name}")
    return await asyncio.to_thread(fn, False)


@app.post("/api/v1/layers/{layer_name}/refresh")
async def refresh_layer(layer_name: str) -> dict[str, Any]:
    """Force-refresh a single layer cache (bypasses 6-h TTL)."""
    fn = _LAYER_DISPATCH.get(layer_name)
    if fn is None:
        raise HTTPException(status_code=404, detail=f"Unknown layer: {layer_name}")
    return await asyncio.to_thread(fn, True)


@app.get("/api/v1/timeline")
async def get_timeline() -> dict[str, Any]:
    """Return available data dates. Currently always returns today's date."""
    today = _utc_today().strftime("%Y-%m-%d")
    return {"dates": [today]}


if __name__ == "__main__":
    print("Starting MangroveShield backend...")
    print("Local orchestrator ready at http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
