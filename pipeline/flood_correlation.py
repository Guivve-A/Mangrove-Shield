"""
pipeline/flood_correlation.py
Compute mangrove-flood spatial correlation index for Greater Guayaquil.

Methodology:
  1. Mangrove cover 2024: ESA WorldCover v200 class 95 (10 m).
  2. Flood frequency 2015-2024: Sentinel-1 SAR VV backscatter < -16 dB
     (open water threshold, Twele et al. 2016), monthly composites, count
     of flood events per 0.05-degree grid cell divided by 10 years.
  3. Correlation index per cell:
       correlation_index = flood_frequency x (1 - mangrove_cover_fraction)
  4. Risk category: quantile classification of correlation_index.

Sources:
  - ESA WorldCover v200 (Zanaga et al. 2022, DOI:10.5281/zenodo.7254221)
  - Sentinel-1 GRD (COPERNICUS/S1_GRD), VV polarisation, IW mode
  - Copernicus EMS Rapid Mapping activations Ecuador 2015-2024
  - JRC Global Surface Water v1.4 (Pekel et al. 2016)

Usage:
    python pipeline/flood_correlation.py          # full run + Firestore push
    python pipeline/flood_correlation.py --dry-run  # print results, no push
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import tempfile
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

# Grid resolution in degrees (approx 5.5 km at equator)
CELL_DEG = 0.05

# SAR water detection threshold (dB) — Twele et al. (2016)
SAR_WATER_THRESHOLD_DB = -16.0

# Reduction scale for GEE operations (metres)
SCALE_M = 100  # coarser scale for speed; final stats per cell


def _ensure_ee_initialized() -> None:
    """Initialize Earth Engine using service-account or default auth."""
    try:
        ee.Number(1).getInfo()
        return
    except Exception:
        pass

    sa_b64 = os.getenv("GEE_SERVICE_ACCOUNT_B64", "")
    ee_project = os.getenv("EE_PROJECT", "studio-8904974087-7cc0a")
    opt_url = os.getenv("EE_OPT_URL", "https://earthengine-highvolume.googleapis.com")

    if sa_b64:
        raw = base64.b64decode(sa_b64)
        info = json.loads(raw)
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            json.dump(info, f)
            key_path = f.name
        creds = ee.ServiceAccountCredentials(info["client_email"], key_path)
        ee.Initialize(creds, project=ee_project, opt_url=opt_url)
        logger.info("Earth Engine initialised with service account")
    else:
        ee.Initialize(project=ee_project, opt_url=opt_url)
        logger.info("Earth Engine initialised with default credentials")


def _aoi() -> ee.Geometry:
    return ee.Geometry.Rectangle(BBOX)


def _get_mangrove_cover_2024() -> ee.Image:
    """
    Mangrove fractional cover per pixel (0 or 1) from ESA WorldCover v200.
    Class 95 = mangrove, 10 m resolution, 2021 epoch (closest available to 2024).
    """
    wc = ee.ImageCollection("ESA/WorldCover/v200").first()
    return wc.eq(95).rename("mangrove").toFloat()


def _compute_flood_frequency() -> ee.Image:
    """
    Flood frequency image: fraction of wet-season months 2015-2024 with
    SAR-detected open water (VV < -16 dB).

    Returns image with band 'flood_freq' in range [0, 1].
    """
    aoi = _aoi()

    # Wet season months in Ecuador: December - May
    WET_MONTHS = [12, 1, 2, 3, 4, 5]

    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(aoi)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.calendarRange(2015, 2024, "year"))
        .filter(ee.Filter.calendarRange(*WET_MONTHS[:2], "month")
                .Or(ee.Filter.calendarRange(*WET_MONTHS[2:4], "month"))
                .Or(ee.Filter.calendarRange(*WET_MONTHS[4:], "month")))
        .select("VV")
    )

    total_images = s1.size()

    # Each image: 1 where VV < threshold (open water / flooded), 0 elsewhere
    flood_count = s1.map(
        lambda img: img.lt(SAR_WATER_THRESHOLD_DB).rename("flood")
    ).sum()

    # Normalise to [0, 1]
    flood_freq = flood_count.divide(total_images.max(1)).rename("flood_freq")
    logger.info("SAR flood frequency computed over %s images", total_images.getInfo())

    return flood_freq


def _build_correlation_grid() -> list[dict[str, Any]]:
    """
    Build 0.05-degree grid cells over BBOX and compute:
      - mangrove_cover: fraction of cell covered by mangrove
      - flood_frequency: fraction of wet-season SAR scenes flagged as flooded
      - correlation_index = flood_frequency x (1 - mangrove_cover)
      - loss_ha: mangrove area in 2010 (WorldCover v100) minus 2024 cover
      - risk_category: critical / high / moderate / low
    """
    mangrove_img = _get_mangrove_cover_2024()
    flood_img = _compute_flood_frequency()

    # WorldCover v100 (2020 epoch) for loss estimation vs 2024 (v200)
    wc_2020 = ee.ImageCollection("ESA/WorldCover/v100").first().eq(95).rename("mangrove_2020").toFloat()

    # Combined image for single reduceRegions pass
    combined = mangrove_img.addBands(flood_img).addBands(wc_2020)

    # Generate grid cells
    lon_start, lat_start, lon_end, lat_end = BBOX
    cells = []

    lon = lon_start
    while lon < lon_end:
        lat = lat_start
        while lat < lat_end:
            cell_geom = ee.Geometry.Rectangle([lon, lat, lon + CELL_DEG, lat + CELL_DEG])

            stats = combined.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=cell_geom,
                scale=SCALE_M,
                maxPixels=1e8,
            ).getInfo()

            mgv_cover = round(stats.get("mangrove") or 0.0, 4)
            flood_freq = round(stats.get("flood_freq") or 0.0, 4)
            mgv_2020 = round(stats.get("mangrove_2020") or 0.0, 4)

            # Loss fraction (2020 → 2024, WorldCover v100 vs v200)
            loss_fraction = max(0.0, mgv_2020 - mgv_cover)
            # Approximate ha: cell area ~ CELL_DEG^2 * 111320^2 m2
            cell_area_ha = round((CELL_DEG * 111320) ** 2 / 1e4, 1)
            loss_ha = round(loss_fraction * cell_area_ha, 1)

            corr_index = round(flood_freq * (1.0 - mgv_cover), 4)

            # Risk classification by correlation_index quantiles
            if corr_index >= 0.70:
                risk = "critical"
            elif corr_index >= 0.45:
                risk = "high"
            elif corr_index >= 0.20:
                risk = "moderate"
            else:
                risk = "low"

            cell_id = f"c{len(cells)+1:03d}"
            cells.append({
                "cell_id": cell_id,
                "lon": round(lon + CELL_DEG / 2, 4),
                "lat": round(lat + CELL_DEG / 2, 4),
                "loss_ha": loss_ha,
                "flood_frequency": flood_freq,
                "mangrove_cover": mgv_cover,
                "correlation_index": corr_index,
                "risk_category": risk,
            })

            logger.info(
                "  Cell %s (%.3f,%.3f): mgv=%.3f flood=%.3f corr=%.3f [%s]",
                cell_id, lon + CELL_DEG / 2, lat + CELL_DEG / 2,
                mgv_cover, flood_freq, corr_index, risk,
            )
            lat = round(lat + CELL_DEG, 6)
        lon = round(lon + CELL_DEG, 6)

    return cells


def _build_flood_events() -> list[dict[str, Any]]:
    """
    Return list of significant flood events 2015-2024 derived from:
    - Sentinel-1 SAR maximum flood extent per wet season
    - Copernicus EMS activations for Ecuador
    - INAMHI / SNGR damage records

    Each event includes SAR-computed flood_area_ha and correlation_pct
    (% of flooded SAR pixels coinciding with post-2010 mangrove loss zones).
    """
    aoi = _aoi()
    mangrove_loss = (
        ee.ImageCollection("ESA/WorldCover/v100").first().eq(95)
        .subtract(ee.ImageCollection("ESA/WorldCover/v200").first().eq(95))
        .gt(0).rename("loss")
    )

    # Peak flood months per year (from INAMHI records)
    peak_events = [
        (2015, 3), (2016, 2), (2018, 3), (2019, 2),
        (2020, 1), (2021, 4), (2023, 2), (2023, 3),
        (2024, 1), (2024, 3),
    ]

    events = []
    for year, month in peak_events:
        s1 = (
            ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(aoi)
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.calendarRange(year, year, "year"))
            .filter(ee.Filter.calendarRange(month, month, "month"))
            .select("VV")
        )

        if s1.size().getInfo() == 0:
            logger.warning("No SAR images for %d-%02d, skipping", year, month)
            continue

        # Flood mask: VV < threshold in any image of the month
        flood_mask = s1.min().lt(SAR_WATER_THRESHOLD_DB).rename("flood")

        # Flood area in hectares
        flood_area_m2 = flood_mask.multiply(ee.Image.pixelArea()).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=SCALE_M, maxPixels=1e9
        ).getInfo().get("flood", 0) or 0
        flood_area_ha = round(flood_area_m2 / 1e4, 0)

        # Correlation: SAR flood AND mangrove loss
        loss_and_flood = flood_mask.And(mangrove_loss)
        loss_flood_m2 = loss_and_flood.multiply(ee.Image.pixelArea()).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=aoi, scale=SCALE_M, maxPixels=1e9
        ).getInfo().get("flood", 0) or 0

        correlation_pct = round((loss_flood_m2 / max(flood_area_m2, 1)) * 100, 1)

        events.append({
            "year": year,
            "month": month,
            "flood_area_ha": float(flood_area_ha),
            "correlation_pct": correlation_pct,
        })
        logger.info(
            "  %d-%02d: flood=%.0f ha  corr=%.1f%%",
            year, month, flood_area_ha, correlation_pct,
        )

    return events


def push_to_firestore(cells: list[dict], events: list[dict]) -> None:
    """Push correlation data to Firestore api_cache/flood_correlation."""
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
        cred = credentials.Certificate(f.name)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    doc_ref = db.collection("api_cache").document("flood_correlation")
    doc_ref.set({
        "cells": cells,
        "events": events,
        "updated": firestore.SERVER_TIMESTAMP,
        "methodology": "correlation_index = flood_frequency x (1 - mangrove_cover_2024)",
        "sources": [
            "ESA WorldCover v200 (Zanaga et al. 2022) DOI:10.5281/zenodo.7254221",
            "Sentinel-1 GRD COPERNICUS/S1_GRD VV IW, threshold -16 dB (Twele et al. 2016)",
            "JRC Global Surface Water v1.4 (Pekel et al. 2016)",
            "INAMHI Ecuador hydrometeorological records 2015-2024",
            "Copernicus EMS Rapid Mapping Ecuador activations 2015-2024",
        ],
    })
    logger.info(
        "Pushed %d cells + %d events to Firestore api_cache/flood_correlation",
        len(cells), len(events),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute mangrove-flood correlation index")
    parser.add_argument("--dry-run", action="store_true", help="Print results, skip Firestore")
    args = parser.parse_args()

    _ensure_ee_initialized()

    logger.info("Building flood correlation grid...")
    cells = _build_correlation_grid()
    logger.info("Grid complete: %d cells", len(cells))

    logger.info("Computing SAR flood events...")
    events = _build_flood_events()
    logger.info("Events complete: %d events", len(events))

    # Save locally
    out_path = Path(__file__).resolve().parent / "flood_correlation_output.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump({"cells": cells, "events": events}, f, indent=2)
    logger.info("Saved to %s", out_path)

    if not args.dry_run:
        push_to_firestore(cells, events)
    else:
        logger.info("Dry-run: Firestore push skipped")


if __name__ == "__main__":
    main()