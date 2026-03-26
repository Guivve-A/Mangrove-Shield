process.env.DATA_MODE = "mock";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");

const BBOX = "-80.15,-2.35,-79.75,-1.95";

test("GET /health returns backend status", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "mangroveshield-web-agent-backend");
  assert.equal(response.body.data_mode, "mock");
});

test("GET /api/weather/now returns current weather payload", async () => {
  const response = await request(app)
    .get("/api/weather/now")
    .query({ bbox: BBOX });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data_mode, "mock");
  assert.ok(typeof response.body.weather_now?.rain_mm_h === "number");
  assert.ok(typeof response.body.proxies?.soil_saturation_proxy === "number");
});

test("GET /api/vulnerability/now returns vulnerability geometry", async () => {
  const response = await request(app)
    .get("/api/vulnerability/now")
    .query({ bbox: BBOX, date: "2026-01-15" });

  assert.equal(response.statusCode, 200);
  assert.ok(typeof response.body.vulnerability_index === "number");
  assert.equal(response.body.geometry?.type, "FeatureCollection");
  assert.ok(Array.isArray(response.body.geometry?.features));
});

test("GET /api/sar/water-mask returns SAR-derived mask", async () => {
  const response = await request(app)
    .get("/api/sar/water-mask")
    .query({ bbox: BBOX, date: "2026-01-15" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.geometry?.type, "FeatureCollection");
  assert.ok(response.body.scene?.scene_id);
  assert.ok(typeof response.body.stats?.water_extent_ratio === "number");
});
