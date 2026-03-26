from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from statistics import mean, pstdev
from typing import Any

import ee
import httpx
import uvicorn
import firebase_admin
from firebase_admin import credentials, firestore
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(override=True)


ROOT_DIR = Path(__file__).resolve().parents[1]
MANGROVE_EXTENT_PATH = ROOT_DIR / "data" / "demo" / "mangrove_extent.geojson"
MANGROVE_ZONES_PATH = ROOT_DIR / "data" / "demo" / "mangrove_extent.geojson"

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

sar_cache = TTLCache(maxsize=1, ttl=SAR_CACHE_TTL_SECONDS)
health_cache = TTLCache(maxsize=1, ttl=HEALTH_CACHE_TTL_SECONDS)
weather_cache = TTLCache(maxsize=1, ttl=WEATHER_CACHE_TTL_SECONDS)
tide_cache = TTLCache(maxsize=1, ttl=TIDE_CACHE_TTL_SECONDS)

_EE_INITIALIZED = False
_FIREBASE_INITIALIZED = False
db: firestore.firestore.Client | None = None

def _ensure_firebase_initialized() -> None:
    global _FIREBASE_INITIALIZED, db
    if _FIREBASE_INITIALIZED:
        return
    
    cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    try:
        if cert_path and Path(cert_path).exists():
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback to default credentials if path not found
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
    ee.Initialize(project=EE_PROJECT, opt_url=EE_OPT_URL)
    _EE_INITIALIZED = True


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


if __name__ == "__main__":
    print("Starting MangroveShield backend...")
    print("Local orchestrator ready at http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
