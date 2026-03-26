const env = require("../config/env");
const { SarService } = require("../services/sarService");
const { MemoryCache } = require("../utils/cache");
const {
  parseBbox,
  requireBboxInRegion,
  parseDateRange,
  parseOptionalDate,
} = require("../utils/validation");

const sarService = new SarService();
const cache = new MemoryCache(env.cacheTtlSeconds * 1000);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

function cacheKey(req) {
  return `${req.path}?${JSON.stringify(req.query)}`;
}

function getScenes(req, res) {
  const bbox = parseBbox(req.query.bbox);
  requireBboxInRegion(bbox, env.guayaquilBbox, env.regionName);

  const range = parseDateRange({
    from: req.query.from,
    to: req.query.to,
    fallbackFrom: daysAgoIso(env.defaultScenesWindowDays),
    fallbackTo: todayIso(),
  });

  const key = cacheKey(req);
  const response = cache.getOrSet(key, () => sarService.getScenes({ bbox, from: range.from, to: range.to }));
  res.json(response);
}

function getWaterMask(req, res) {
  const bbox = parseBbox(req.query.bbox);
  requireBboxInRegion(bbox, env.guayaquilBbox, env.regionName);
  const date = parseOptionalDate(req.query.date, todayIso());

  const key = cacheKey(req);
  const response = cache.getOrSet(key, () => sarService.deriveWaterMask({ bbox, date }));
  res.json(response);
}

module.exports = {
  getScenes,
  getWaterMask,
};