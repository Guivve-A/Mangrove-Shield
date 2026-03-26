const { ApiError } = require("./errors");
const { isValidBbox, bboxIntersects, bboxCenter } = require("./geo");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBbox(raw, fieldName = "bbox") {
  if (!raw) {
    throw new ApiError(400, `Missing required query parameter '${fieldName}'`);
  }

  const parts = String(raw)
    .split(",")
    .map((part) => Number(part.trim()));

  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    throw new ApiError(400, `Invalid '${fieldName}' format. Expected minLon,minLat,maxLon,maxLat`);
  }

  if (!isValidBbox(parts)) {
    throw new ApiError(400, `Invalid '${fieldName}' values`);
  }

  return parts;
}

function parseOptionalBbox(raw, fallbackBbox) {
  if (!raw) {
    return fallbackBbox;
  }
  return parseBbox(raw);
}

function requireBboxInRegion(bbox, regionBbox, regionLabel = "Guayaquil") {
  if (!bboxIntersects(bbox, regionBbox)) {
    throw new ApiError(
      400,
      `bbox must intersect the supported region (${regionLabel})`,
      {
        supported_bbox: regionBbox,
      },
    );
  }
}

function parseDate(raw, fieldName) {
  if (!raw || typeof raw !== "string" || !ISO_DATE_PATTERN.test(raw)) {
    throw new ApiError(400, `Invalid '${fieldName}'. Expected format YYYY-MM-DD`);
  }

  const timestamp = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    throw new ApiError(400, `Invalid '${fieldName}' date`);
  }

  return raw;
}

function parseOptionalDate(raw, fallback = null) {
  if (!raw) {
    return fallback;
  }
  return parseDate(raw, "date");
}

function parseDateRange({ from, to, fallbackFrom, fallbackTo }) {
  const parsedFrom = from ? parseDate(from, "from") : fallbackFrom;
  const parsedTo = to ? parseDate(to, "to") : fallbackTo;

  if (!parsedFrom || !parsedTo) {
    throw new ApiError(400, "Missing date range. Provide from and to (YYYY-MM-DD)");
  }

  if (Date.parse(`${parsedFrom}T00:00:00Z`) > Date.parse(`${parsedTo}T00:00:00Z`)) {
    throw new ApiError(400, "Invalid date range: from must be before or equal to to");
  }

  return { from: parsedFrom, to: parsedTo };
}

function parseLatLonOrBboxCenter({ lat, lon, bbox }) {
  if (lat !== undefined && lon !== undefined) {
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      throw new ApiError(400, "Invalid 'lat'. Expected value between -90 and 90");
    }
    if (!Number.isFinite(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      throw new ApiError(400, "Invalid 'lon'. Expected value between -180 and 180");
    }

    return { lat: parsedLat, lon: parsedLon, source: "latlon" };
  }

  if (bbox !== undefined) {
    const parsedBbox = parseBbox(bbox);
    const [centerLon, centerLat] = bboxCenter(parsedBbox);
    return { lat: centerLat, lon: centerLon, source: "bbox", bbox: parsedBbox };
  }

  throw new ApiError(400, "Provide either lat/lon or bbox query parameters");
}

module.exports = {
  parseBbox,
  parseOptionalBbox,
  requireBboxInRegion,
  parseDate,
  parseOptionalDate,
  parseDateRange,
  parseLatLonOrBboxCenter,
};