const env = require("../config/env");
const { WeatherService } = require("../services/weatherService");
const { MemoryCache } = require("../utils/cache");
const { ApiError } = require("../utils/errors");
const {
  parseLatLonOrBboxCenter,
  requireBboxInRegion,
} = require("../utils/validation");

const weatherService = new WeatherService();
const cache = new MemoryCache(env.weatherCacheTtlSeconds * 1000);

function inRegion(lat, lon, regionBbox) {
  const [minLon, minLat, maxLon, maxLat] = regionBbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

async function getWeatherNow(req, res) {
  const location = parseLatLonOrBboxCenter({
    lat: req.query.lat,
    lon: req.query.lon,
    bbox: req.query.bbox,
  });

  if (location.bbox) {
    requireBboxInRegion(location.bbox, env.guayaquilBbox, env.regionName);
  }

  if (!inRegion(location.lat, location.lon, env.guayaquilBbox)) {
    throw new ApiError(400, "Coordinates must be inside the supported Guayaquil region", {
      supported_bbox: env.guayaquilBbox,
    });
  }

  const key = `${req.path}?${location.lat.toFixed(4)},${location.lon.toFixed(4)}:${env.dataMode}`;
  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const weather = await weatherService.getCurrentWeather({ lat: location.lat, lon: location.lon });

  const response = {
    region: {
      id: env.regionId,
      name: env.regionName,
    },
    location_source: location.source,
    ...weather,
  };

  cache.set(key, response);
  return res.json(response);
}

module.exports = {
  getWeatherNow,
};