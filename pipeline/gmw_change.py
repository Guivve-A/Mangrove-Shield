"""
pipeline/gmw_change.py
Export mangrove coverage change via Google Earth Engine for Greater Guayaquil.

Data sources (GMW v3.0 access pending; public fallbacks used):
  2021+ : ESA WorldCover v200 class 95 (mangrove), 10 m
  2017-2020 : Sentinel-2 SR dry-season NDVI > 0.35, coastal mask (JRC GSW)
  2014-2016 : Landsat-8 OLI dry-season NDVI > 0.35, coastal mask

When GMW v3.0 GEE access is granted, replace _get_mangrove_image() with:
    ee.ImageCollection("projects/earthengine-legacy/assets/GMW/v3")
      .filter(ee.Filter.eq("year", year)).first()

Usage:
    python pipeline/gmw_change.py              # export all year pairs
    python pipeline/gmw_change.py --year 2020  # export single year
    python pipeline/gmw_change.py --dry-run    # skip Firestore push
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Any

import ee

# Load .env from backend/ directory (service account keys live there)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger(__name__)

# Greater Guayaquil bounding box (WGS84)
BBOX = [-80.1, -2.4, -79.4, -1.7]

# Timeline years for the frontend section (biennial from 2014-2024)
TIMELINE_YEARS: list[int] = [2014, 2016, 2018, 2020, 2022, 2024]

# Actual source year used for each timeline year (maps to real satellite data)
# 2014/2016 → Landsat-8 | 2018/2020 → Sentinel-2 | 2022/2024 → WorldCover/S2
GMW_PROXY: dict[int, int] = {
    2014: 2014,
    2016: 2016,
    2018: 2018,
    2020: 2020,
    2022: 2022,
    2024: 2024,
}

# Pixel scale in metres for EE reductions
SCALE_M = 30


def _ensure_ee_initialized() -> None:
    """Initialize Earth Engine using service-account credentials or default auth."""
    try:
        ee.Number(1).getInfo()
        return
    except Exception:
        pass

    sa_b64 = os.getenv("GEE_SERVICE_ACCOUNT_B64", "")
    ee_project = os.getenv("EE_PROJECT", "")
    opt_url = os.getenv("EE_OPT_URL", "https://earthengine-highvolume.googleapis.com")

    if sa_b64:
        import base64
        import tempfile

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


def _guayaquil_aoi() -> ee.Geometry:
    return ee.Geometry.Rectangle(BBOX)


def _get_mangrove_image(year: int) -> ee.Image:
    """
    Return a binary mangrove mask (band 'b1') for the given year.

    Data source priority:
      2021+  → ESA WorldCover v200 class 95 (mangrove), 10 m, 2021 epoch.
               Source: Zanaga et al. (2022) ESA WorldCover 10m v200, DOI:10.5281/zenodo.7254221
      2017–2020 → Sentinel-2 SR Harmonized dry-season NDVI > 0.35, masked to
               coastal tidal zone (JRC GSW occurrence > 5 % buffered 1 km).
               Source: COPERNICUS/S2_SR_HARMONIZED, 10 m.
      2014–2016 → Landsat-8 OLI Collection-2 dry-season NDVI > 0.35, same
               coastal mask.  Source: LANDSAT/LC08/C02/T1_L2, 30 m.

    Note: GMW v3.0 (Bunting et al. 2022, DOI:10.1038/s41597-022-01574-5) is the
    preferred source but requires explicit GEE asset access not yet granted for
    this account.  The above datasets are fully public and yield comparable
    mangrove extents for Greater Guayaquil.
    """
    aoi = _guayaquil_aoi()

    # Coastal / tidal zone: pixels with JRC water occurrence > 5 %, buffered 1 km
    jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
    coastal_zone = jrc.gt(5).focal_max(radius=1000, units="meters")

    if year >= 2021:
        wc = ee.ImageCollection("ESA/WorldCover/v200").first()
        return wc.eq(95).rename("b1").selfMask()

    if year >= 2017:
        base = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filter(ee.Filter.calendarRange(year, year, "year"))
            .filter(ee.Filter.calendarRange(6, 11, "month"))  # dry season
        )
        # Relax cloud threshold progressively
        filtered = base
        for cloud_thresh in [30, 60, 90]:
            filtered = base.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_thresh))
            if filtered.size().getInfo() >= 5:
                break
        # Fall back to S2 TOA (L1C) if SR has insufficient coverage (e.g. 2017-2018 Ecuador)
        if filtered.size().getInfo() < 5:
            base_toa = (
                ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
                .filterBounds(aoi)
                .filter(ee.Filter.calendarRange(year, year, "year"))
                .filter(ee.Filter.calendarRange(6, 11, "month"))
            )
            for cloud_thresh in [30, 60, 90]:
                filtered = base_toa.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_thresh))
                if filtered.size().getInfo() >= 5:
                    logger.info("  %d: falling back to S2 TOA (cloud<%d%%)", year, cloud_thresh)
                    break
        ndvi = filtered.median().normalizedDifference(["B8", "B4"])
        return ndvi.gt(0.35).And(coastal_zone).rename("b1").selfMask()

    # 2014–2016: Landsat-8 OLI Collection-2
    base_col = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(aoi)
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .filter(ee.Filter.calendarRange(6, 11, "month"))
    )
    for cloud_thresh in [30, 60, 90]:
        filtered = base_col.filter(ee.Filter.lt("CLOUD_COVER", cloud_thresh))
        if filtered.size().getInfo() > 0:
            break
    l8 = filtered.map(lambda img: img.select(["SR_B5", "SR_B4"])
                      .multiply(0.0000275).add(-0.2))
    ndvi = l8.median().normalizedDifference(["SR_B5", "SR_B4"])
    return ndvi.gt(0.35).And(coastal_zone).rename("b1").selfMask()


def compute_coverage_ha(year: int) -> float:
    """Return mangrove area in hectares for a given source year."""
    aoi = _guayaquil_aoi()
    img = _get_mangrove_image(year)
    area_img = img.multiply(ee.Image.pixelArea())
    stats = area_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi,
        scale=SCALE_M,
        maxPixels=1e9,
    )
    area_m2 = stats.getInfo().get("b1", 0) or 0
    return round(area_m2 / 1e4, 1)


def compute_change(year_a: int, year_b: int) -> dict[str, float]:
    """Compute loss/gain hectares between two mangrove masks."""
    aoi = _guayaquil_aoi()
    img_a = _get_mangrove_image(year_a)
    img_b = _get_mangrove_image(year_b)

    loss = img_a.And(img_b.Not())  # present in A but absent in B
    gain = img_b.And(img_a.Not())  # present in B but absent in A

    loss_area = loss.multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=SCALE_M, maxPixels=1e9
    )
    gain_area = gain.multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=aoi, scale=SCALE_M, maxPixels=1e9
    )

    loss_ha = round((loss_area.getInfo().get("b1", 0) or 0) / 1e4, 1)
    gain_ha = round((gain_area.getInfo().get("b1", 0) or 0) / 1e4, 1)

    return {"loss_ha": loss_ha, "gain_ha": gain_ha}


def build_timeline_data() -> list[dict[str, Any]]:
    """Build the full timeline dataset for all TIMELINE_YEARS."""
    records: list[dict[str, Any]] = []

    for i, year in enumerate(TIMELINE_YEARS):
        src_year = GMW_PROXY[year]
        logger.info("Processing year %d (GMW source: %d)...", year, src_year)

        total_ha = compute_coverage_ha(src_year)

        if i == 0:
            loss_ha = 0.0
            gain_ha = 0.0
        else:
            prev_src = GMW_PROXY[TIMELINE_YEARS[i - 1]]
            if prev_src != src_year:
                change = compute_change(prev_src, src_year)
                loss_ha = change["loss_ha"]
                gain_ha = change["gain_ha"]
            else:
                loss_ha = 0.0
                gain_ha = 0.0

        delta_ha = round(gain_ha - loss_ha, 1)
        loss_rate = round((loss_ha / total_ha) * 100, 2) if total_ha > 0 else 0.0

        record = {
            "year": year,
            "total_ha": total_ha,
            "loss_ha": loss_ha,
            "gain_ha": gain_ha,
            "delta_ha": delta_ha,
            "loss_rate_pct": loss_rate,
            "gmw_source_year": src_year,
        }
        records.append(record)
        logger.info("  %d: %s ha total, %+.1f ha delta", year, total_ha, delta_ha)

    return records


def push_to_firestore(records: list[dict[str, Any]]) -> None:
    """Push timeline data to Firebase Firestore api_cache collection."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        logger.warning("firebase-admin not installed, skipping Firestore push")
        return

    sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64", "")
    if not sa_b64:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_B64 not set, skipping Firestore push")
        return

    import base64
    import tempfile

    raw = base64.b64decode(sa_b64)
    info = json.loads(raw)

    if not firebase_admin._apps:
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            json.dump(info, f)
            key_path = f.name
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    doc_ref = db.collection("api_cache").document("mangrove_timeline")
    doc_ref.set({"records": records, "updated": firestore.SERVER_TIMESTAMP})
    logger.info("Pushed %d records to Firestore api_cache/mangrove_timeline", len(records))


def main() -> None:
    parser = argparse.ArgumentParser(description="Export GMW v3.0 mangrove change data")
    parser.add_argument("--year", type=int, help="Process a single timeline year")
    parser.add_argument("--dry-run", action="store_true", help="Skip Firestore push")
    args = parser.parse_args()

    _ensure_ee_initialized()

    if args.year:
        if args.year not in TIMELINE_YEARS:
            logger.error("Year %d not in timeline: %s", args.year, TIMELINE_YEARS)
            sys.exit(1)
        idx = TIMELINE_YEARS.index(args.year)
        src = GMW_PROXY[args.year]
        total_ha = compute_coverage_ha(src)
        if idx > 0:
            prev_src = GMW_PROXY[TIMELINE_YEARS[idx - 1]]
            change = compute_change(prev_src, src) if prev_src != src else {"loss_ha": 0, "gain_ha": 0}
        else:
            change = {"loss_ha": 0, "gain_ha": 0}
        record = {
            "year": args.year,
            "total_ha": total_ha,
            "loss_ha": change["loss_ha"],
            "gain_ha": change["gain_ha"],
            "delta_ha": round(change["gain_ha"] - change["loss_ha"], 1),
            "loss_rate_pct": round((change["loss_ha"] / total_ha) * 100, 2) if total_ha else 0,
            "gmw_source_year": src,
        }
        print(json.dumps(record, indent=2))
        return

    records = build_timeline_data()

    # Save locally
    out_path = Path(__file__).resolve().parent / "gmw_timeline_output.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    logger.info("Saved to %s", out_path)

    if not args.dry_run:
        push_to_firestore(records)


if __name__ == "__main__":
    main()
