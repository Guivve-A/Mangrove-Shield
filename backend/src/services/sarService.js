const env = require("../config/env");
const { ApiError } = require("../utils/errors");
const {
  bboxIntersects,
  buildGrid,
  pointInFeature,
  featureCollection,
  clamp,
} = require("../utils/geo");
const { createRng, sampleRange } = require("../utils/random");
const { loadJson } = require("./dataLoaderService");

const ZONE_WATER_SENSITIVITY = {
  mangrove_core: 0.95,
  estuarine_buffer: 0.88,
  mangrove_front: 0.93,
  urban_mangrove_interface: 0.81,
  wetland_channel: 0.86,
  estuarine_channel: 0.9,
};

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toTimestamp(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

function dayOfYear(date) {
  const now = new Date(`${date}T00:00:00Z`);
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const diff = now - start;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

class SarService {
  constructor({ dataMode = env.dataMode } = {}) {
    this.dataMode = dataMode;
    // Mock paths are now optional for testing only
    this.scenes = [];
    this.mangroveZones = [];
    
    try {
      this.scenes = loadJson("data/mock/sar_scenes.json");
      this.mangroveZones = loadJson("data/mock/mangrove_zones.geojson").features || [];
    } catch (e) {
      console.warn("SAR Mock data not found, will rely on live mode or return empty.");
    }
  }

  _mockScenes({ bbox, from, to }) {
    if (!this.scenes.length) return [];
    const fromTs = toTimestamp(from);
    const toTs = Date.parse(`${to}T23:59:59Z`);

    return this.scenes
      .filter((scene) => bboxIntersects(scene.bbox, bbox))
      .filter((scene) => {
        const ts = Date.parse(scene.acquired_at);
        return ts >= fromTs && ts <= toTs;
      })
      .sort((a, b) => Date.parse(a.acquired_at) - Date.parse(b.acquired_at));
  }

  _liveScenes({ bbox, from, to }) {
    // In a production environment, this would call SentinelHub or Google Earth Engine API directly.
    // For this context, we ensure that if dataMode is live, we don't just return mock without a label.
    throw new ApiError(501, "Live SAR catalog integration via Node.js is deprecated. Use the Python/GEE orchestrator.");
  }

  getScenes({ bbox, from, to }) {
    const scenes =
      this.dataMode === "live"
        ? this._liveScenes({ bbox, from, to })
        : this._mockScenes({ bbox, from, to });

    return {
      data_mode: this.dataMode,
      region: {
        id: env.regionId,
        name: env.regionName,
      },
      bbox,
      from,
      to,
      scenes_count: scenes.length,
      scenes,
    };
  }

  _sceneForDate({ bbox, date }) {
    const scenes = this._mockScenes({ bbox, from: date, to: date });
    if (scenes.length > 0) {
      return scenes[0];
    }

    const allScenes = this._mockScenes({ bbox, from: "2026-01-01", to: "2026-12-31" });
    if (!allScenes.length) {
      throw new ApiError(404, "No SAR scenes found for the provided bbox");
    }

    const targetTs = toTimestamp(date);
    return allScenes
      .slice()
      .sort((a, b) => Math.abs(Date.parse(a.acquired_at) - targetTs) - Math.abs(Date.parse(b.acquired_at) - targetTs))[0];
  }

  deriveWaterMask({ bbox, date }) {
    const selectedDate = date || formatDate(new Date());
    const scene = this._sceneForDate({ bbox, date: selectedDate });
    const grid = buildGrid(bbox, 14, 14);

    const rng = createRng(`${scene.scene_id}:${selectedDate}:${bbox.join(",")}`);
    const features = [];
    let mangroveCells = 0;
    let waterCells = 0;

    const yearDay = dayOfYear(selectedDate);
    const tidePulse = (Math.sin((2 * Math.PI * yearDay) / 13.8) + 1) / 2;

    for (const cell of grid) {
      const zone = this.mangroveZones.find((feature) => pointInFeature(cell.center, feature));
      if (!zone) {
        continue;
      }

      const zoneType = zone.properties?.zone_type || "mangrove_core";
      const zoneName = zone.properties?.zone_name || "Mangrove Zone";
      const zoneSensitivity = ZONE_WATER_SENSITIVITY[zoneType] || 0.85;

      mangroveCells += 1;

      const backscatterDb = -13.3 - zoneSensitivity * 4.1 - tidePulse * 2.7 + sampleRange(rng, -2.2, 2.2);
      const thresholdDb = -17.6 + zoneSensitivity * 0.9;
      const waterProbability = clamp((thresholdDb - backscatterDb + 3.4) / 6.2, 0, 1);
      const isWater = waterProbability >= 0.5;

      if (isWater) {
        waterCells += 1;
      }

      features.push({
        type: "Feature",
        geometry: cell.geometry,
        properties: {
          row: cell.row,
          col: cell.col,
          zone_id: zone.id,
          zone_name: zoneName,
          zone_type: zoneType,
          backscatter_db: Number(backscatterDb.toFixed(2)),
          threshold_db: Number(thresholdDb.toFixed(2)),
          water_probability: Number(waterProbability.toFixed(3)),
          is_water: isWater,
        },
      });
    }

    if (mangroveCells === 0) {
      throw new ApiError(404, "No mangrove cells intersect the provided bbox");
    }

    const maskFeatures = features.filter((feature) => feature.properties.is_water);

    return {
      data_mode: this.dataMode,
      bbox,
      date: selectedDate,
      scene: {
        scene_id: scene.scene_id,
        acquired_at: scene.acquired_at,
        orbit_pass: scene.orbit_pass,
        polarization: scene.polarization,
      },
      stats: {
        mangrove_cells: mangroveCells,
        water_cells: waterCells,
        water_extent_ratio: Number((waterCells / mangroveCells).toFixed(3)),
      },
      geometry: featureCollection(maskFeatures),
      analysis_grid: featureCollection(features),
    };
  }
}

module.exports = {
  SarService,
};