const SUPPORTED_DATA_MODES = new Set(["mock", "live"]);
const DEFAULT_REGION_BBOX = [-80.2, -2.95, -79.68, -2.0];

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBboxEnv(raw) {
  if (!raw) {
    return DEFAULT_REGION_BBOX;
  }

  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    return DEFAULT_REGION_BBOX;
  }

  return values;
}

function loadEnv() {
  const dataMode = String(process.env.DATA_MODE || "mock").toLowerCase();
  if (!SUPPORTED_DATA_MODES.has(dataMode)) {
    throw new Error(`DATA_MODE must be one of: ${Array.from(SUPPORTED_DATA_MODES).join(", ")}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: toNumber(process.env.PORT, 8080),
    dataMode,
    cacheTtlSeconds: toNumber(process.env.CACHE_TTL_SECONDS, 90),
    weatherCacheTtlSeconds: toNumber(process.env.WEATHER_CACHE_TTL_SECONDS, 120),
    rateLimitWindowSeconds: toNumber(process.env.RATE_LIMIT_WINDOW_SECONDS, 60),
    rateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, 120),
    defaultScenesWindowDays: toNumber(process.env.DEFAULT_SCENES_WINDOW_DAYS, 21),
    regionName: process.env.REGION_NAME || "Guayaquil Estuarine System",
    regionId: process.env.REGION_ID || "guayaquil-ecuador-estuary",
    guayaquilBbox: parseBboxEnv(process.env.GUAYAQUIL_BBOX),
    openMeteoBaseUrl: process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast",
  };
}

module.exports = loadEnv();