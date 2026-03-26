const env = require("../config/env");
const { clamp } = require("../utils/geo");
const { createRng, sampleRange } = require("../utils/random");

function nowIso() {
  return new Date().toISOString();
}

function tideProxy(timestamp, lon) {
  const date = new Date(timestamp);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const longitudinalShift = (lon + 80) * 0.4;
  return clamp((Math.sin(((hours + longitudinalShift) / 12.4) * Math.PI * 2) + 1) / 2, 0, 1);
}

class WeatherService {
  constructor({ dataMode = env.dataMode } = {}) {
    this.dataMode = dataMode;
  }

  _mockWeather({ lat, lon }) {
    const timestamp = nowIso();
    const seed = `${timestamp.slice(0, 13)}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    const rng = createRng(seed);

    const rainMmH = sampleRange(rng, 2.0, 28.0);
    const windKph = sampleRange(rng, 8.0, 37.0);
    const humidityPct = sampleRange(rng, 72.0, 96.0);
    const temperatureC = sampleRange(rng, 24.0, 32.0);

    const rainIntensity = clamp(rainMmH / 35, 0, 1);
    const saturation = clamp((0.6 * rainIntensity) + 0.4 * ((humidityPct - 65) / 35), 0, 1);
    const tidalStage = tideProxy(timestamp, lon);

    return {
      data_mode: "mock",
      source: "mock_guayaquil_estuary",
      timestamp,
      coordinates: { lat, lon },
      weather_now: {
        rain_mm_h: Number(rainMmH.toFixed(2)),
        wind_kph: Number(windKph.toFixed(2)),
        humidity_pct: Number(humidityPct.toFixed(1)),
        temperature_c: Number(temperatureC.toFixed(1)),
      },
      proxies: {
        rain_intensity: Number(rainIntensity.toFixed(3)),
        soil_saturation_proxy: Number(saturation.toFixed(3)),
        tidal_stage_proxy: Number(tidalStage.toFixed(3)),
      },
    };
  }

  async _liveWeather({ lat, lon }) {
    const url = new URL(env.openMeteoBaseUrl);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status}`);
    }

    const payload = await response.json();
    const current = payload.current || {};
    const timestamp = current.time ? new Date(current.time).toISOString() : nowIso();

    const rainMmH = Number(current.precipitation || 0);
    const humidityPct = Number(current.relative_humidity_2m || 0);
    const windKph = Number(current.wind_speed_10m || 0);
    const temperatureC = Number(current.temperature_2m || 0);

    const rainIntensity = clamp(rainMmH / 35, 0, 1);
    const saturation = clamp((0.65 * rainIntensity) + 0.35 * (humidityPct / 100), 0, 1);
    const tidalStage = tideProxy(timestamp, lon);

    return {
      data_mode: "live",
      source: "open-meteo",
      timestamp,
      coordinates: { lat, lon },
      weather_now: {
        rain_mm_h: Number(rainMmH.toFixed(2)),
        wind_kph: Number(windKph.toFixed(2)),
        humidity_pct: Number(humidityPct.toFixed(1)),
        temperature_c: Number(temperatureC.toFixed(1)),
      },
      proxies: {
        rain_intensity: Number(rainIntensity.toFixed(3)),
        soil_saturation_proxy: Number(saturation.toFixed(3)),
        tidal_stage_proxy: Number(tidalStage.toFixed(3)),
      },
    };
  }

  async getCurrentWeather({ lat, lon }) {
    try {
      return await this._liveWeather({ lat, lon });
    } catch (error) {
      console.error(`Weather live fetch failed: ${error.message}`);
      throw new Error("Live weather data currently unavailable. No mock fallback allowed.");
    }
  }
}

module.exports = {
  WeatherService,
};