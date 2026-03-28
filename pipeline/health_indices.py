"""
pipeline/health_indices.py
Compute monthly NDVI/NDWI from Sentinel-2 and reference NASA AGB v1.3
for mangrove health assessment in Greater Guayaquil.

Exports per-municipality zonal statistics and monthly time series to
Firebase Firestore (api_cache/mangrove_health_indices).

Usage:
    python pipeline/health_indices.py                     # last 24 months
    python pipeline/health_indices.py --year 2024 --month 6  # single month
    python pipeline/health_indices.py --dry-run            # skip Firestore
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import ee

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger(__name__)

# Greater Guayaquil bounding box (WGS84)
BBOX = [-80.1, -2.4, -79.4, -1.7]

# Municipality sub-regions for zonal stats
MUNICIPALITIES: dict[str, list[float]] = {
    "Guayaquil": [-79.98, -2.30, -79.82, -2.10],
    "Duran": [-79.86, -2.20, -79.78, -2.12],
    "Daule": [-80.00, -1.90, -79.84, -1.72],
    "Samborondon": [-79.90, -2.16, -79.82, -2.06],
}

SCALE_M = 10  # Sentinel-2 native resolution


def _ensure_ee_initialized() -> None:
    """Initialize Earth Engine using service-account or default auth."""
    try:
        ee.Number(1).getInfo()
        return
    except Exception:
        pass

    sa_b64 = os.getenv("GEE_SERVICE_ACCOUNT_B64", "")
    ee_project = os.getenv("EE_PROJECT", "")
    opt_url = os.getenv("EE_OPT_URL", "https://earthengine-highvolume.googleapis.com")

    if sa_b64:
        raw = base64.b64decode(sa_b64)
        info = json.loads(raw)
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            json.dump(info, f)
            key_path = f.name
        credentials = ee.ServiceAccountCredentials(info["client_email"], key_path)
        ee.Initialize(credentials, project=ee_project, opt_url=opt_url)
        logger.info("Earth Engine initialised with service account")
    else:
        ee.Initialize(project=ee_project, opt_url=opt_url)
        logger.info("Earth Engine initialised with default credentials")


def _aoi() -> ee.Geometry:
    return ee.Geometry.Rectangle(BBOX)


def _municipality_geom(name: str) -> ee.Geometry:
    return ee.Geometry.Rectangle(MUNICIPALITIES[name])


def _get_mangrove_mask() -> ee.Image:
    """Get GMW v3.0 mangrove mask for the most recent year."""
    gmw = ee.ImageCollection("projects/earthengine-legacy/assets/GMW/v3")
    return gmw.sort("year", False).first()


def compute_monthly_indices(year: int, month: int) -> dict[str, Any]:
    """Compute NDVI/NDWI stats for a single month over Greater Guayaquil."""
    aoi = _aoi()
    mask = _get_mangrove_mask()

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .filter(ee.Filter.calendarRange(month, month, "month"))
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .median()
    )

    ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI").updateMask(mask)
    ndwi = s2.normalizedDifference(["B3", "B8"]).rename("NDWI").updateMask(mask)

    # Regional mean
    ndvi_stats = ndvi.reduceRegion(
        reducer=ee.Reducer.mean().combine(ee.Reducer.stdDev(), sharedInputs=True),
        geometry=aoi,
        scale=SCALE_M,
        maxPixels=1e9,
    ).getInfo()

    ndwi_stats = ndwi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=SCALE_M,
        maxPixels=1e9,
    ).getInfo()

    # Per-municipality stats
    zones: dict[str, dict[str, float]] = {}
    for muni_name in MUNICIPALITIES:
        geom = _municipality_geom(muni_name)
        muni_ndvi = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geom,
            scale=SCALE_M,
            maxPixels=1e9,
        ).getInfo()
        zones[muni_name] = {
            "ndvi": round(muni_ndvi.get("NDVI", 0) or 0, 4),
        }

    return {
        "year": year,
        "month": month,
        "period": f"{year}-{month:02d}",
        "ndvi_mean": round(ndvi_stats.get("NDVI_mean", 0) or 0, 4),
        "ndvi_stddev": round(ndvi_stats.get("NDVI_stdDev", 0) or 0, 4),
        "ndwi_mean": round(ndwi_stats.get("NDWI_mean", 0) or 0, 4),
        "zones": zones,
    }


def build_health_dataset(months: int = 24) -> list[dict[str, Any]]:
    """Build monthly health indices for the last N months."""
    now = datetime.utcnow()
    records: list[dict[str, Any]] = []

    for offset in range(months - 1, -1, -1):
        # Step backwards from current month
        m = now.month - offset
        y = now.year
        while m <= 0:
            m += 12
            y -= 1

        logger.info("Computing indices for %d-%02d...", y, m)
        try:
            record = compute_monthly_indices(y, m)
            records.append(record)
            logger.info("  NDVI=%.4f  NDWI=%.4f", record["ndvi_mean"], record["ndwi_mean"])
        except Exception as exc:
            logger.warning("  Skipping %d-%02d: %s", y, m, exc)

    return records


def push_to_firestore(records: list[dict[str, Any]]) -> None:
    """Push health indices to Firestore api_cache collection."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        logger.warning("firebase-admin not installed, skipping Firestore push")
        return

    sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64", "")
    if not sa_b64:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_B64 not set, skipping")
        return

    raw = base64.b64decode(sa_b64)
    info = json.loads(raw)
    if not firebase_admin._apps:
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            json.dump(info, f)
            key_path = f.name
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    doc_ref = db.collection("api_cache").document("mangrove_health_indices")
    doc_ref.set({"records": records, "updated": firestore.SERVER_TIMESTAMP})
    logger.info("Pushed %d records to Firestore", len(records))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute mangrove health indices from Sentinel-2")
    parser.add_argument("--year", type=int)
    parser.add_argument("--month", type=int)
    parser.add_argument("--months", type=int, default=24, help="Lookback months (default 24)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    _ensure_ee_initialized()

    if args.year and args.month:
        record = compute_monthly_indices(args.year, args.month)
        print(json.dumps(record, indent=2))
        return

    records = build_health_dataset(args.months)
    out_path = Path(__file__).resolve().parent / "health_indices_output.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    logger.info("Saved to %s", out_path)

    if not args.dry_run:
        push_to_firestore(records)


if __name__ == "__main__":
    main()
