import { API_BASE_URL } from "./constants";
import type {
    FloodStatusResponse,
    WeatherNowResponse,
    VulnerabilityNowResponse,
    SarWaterMaskResponse,
    EcosystemHealthResponse,
    EcosystemTimeseriesResponse,
    EcosystemAnomaliesResponse,
} from "@/types/liveTypes";
import { db } from "./firebase_config";
import { doc, getDoc } from "firebase/firestore";

const STATIC_FALLBACK_URL = "/data/api_cache.json";

const BBOX: number[] = [-80.1, -2.4, -79.7, -2.0];
const COORDS = { lat: -2.19616, lon: -79.88621 };
const REGION = { id: 'guayaquil-estero-salado', name: 'Estero Salado, Guayaquil' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_FC: any = { type: 'FeatureCollection', features: [] };

export async function getFloodStatus(): Promise<FloodStatusResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/flood-status`);

        if (response.ok) {
            return (await response.json()) as FloodStatusResponse;
        }

        console.warn(`Local API returned ${response.status}, attempting Firestore fallback...`);
    } catch (error) {
        console.warn("Local API fetch failed, attempting Firestore fallback...");
    }

    // Firestore Fallback (Cloud Cache)
    try {
        const docRef = doc(db, "flood_status", "latest");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Real-time data retrieved from Firestore cache.");
            return docSnap.data() as FloodStatusResponse;
        }
    } catch (fsError) {
        console.error("Firestore fallback failed:", fsError);
    }

    // Final Static Fallback
    console.warn("Global cache unavailable, using static fallback.");
    return await fetchStaticFallback<FloodStatusResponse>(STATIC_FALLBACK_URL);
}

async function fetchStaticFallback<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load static fallback: ${url}`);
    }
    return (await response.json()) as T;
}

async function fromFirestore<T>(collection: string, docId: string): Promise<T | null> {
    try {
        const snap = await getDoc(doc(db, collection, docId));
        if (snap.exists()) return snap.data() as T;
    } catch {}
    return null;
}

export async function fetchWeatherNow(): Promise<WeatherNowResponse> {
    const status = await getFloodStatus();
    const w = status.weather;
    const rain = w.weather_now?.rain_mm_h ?? 0;
    const humidity = w.weather_now?.humidity_pct ?? 0;
    const tideLevel = status.tide?.level_m;
    return {
        data_mode: w.error ? 'fallback' : 'live',
        source: w.source ?? 'OpenWeatherMap',
        timestamp: w.timestamp ?? new Date().toISOString(),
        coordinates: COORDS,
        region: REGION,
        weather_now: w.weather_now,
        proxies: {
            rain_intensity: Math.min(1, rain / 25),
            soil_saturation_proxy: humidity / 100,
            tidal_stage_proxy: tideLevel != null
                ? Math.min(1, Math.max(0, (tideLevel - 0.2) / 1.3))
                : 0.5,
        },
    };
}

export async function fetchVulnerabilityNow(): Promise<VulnerabilityNowResponse> {
    const cached = await fromFirestore<VulnerabilityNowResponse>('api_cache', 'vulnerability_now');
    if (cached) return cached;

    const status = await getFloodStatus();
    const risk = status.risk_assessment;
    const sar = status.sar_data;
    const weather = status.weather;
    const score = risk.score ?? 0;
    const level: VulnerabilityNowResponse['level'] =
        score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'moderate' : 'low';

    return {
        bbox: BBOX,
        date: new Date().toISOString().split('T')[0],
        vulnerability_index: score / 100,
        vulnerability_index_100: score,
        level,
        drivers: {
            rain_intensity: Math.min(1, (weather.weather_now?.rain_mm_h ?? 0) / 25),
            soil_saturation_proxy: (weather.weather_now?.humidity_pct ?? 0) / 100,
            tidal_stage_proxy: status.tide?.level_m != null
                ? Math.min(1, Math.max(0, (status.tide.level_m - 0.2) / 1.3))
                : 0.5,
            sar_water_extent: sar?.flood_anomaly_fraction ?? 0,
            wind_exposure: Math.min(1, (weather.weather_now?.wind_kph ?? 0) / 60),
        },
        sar_context: {
            scene_id: sar?.date_acquired ?? 'unknown',
            acquired_at: sar?.date_acquired ?? new Date().toISOString(),
            water_cells: 0,
            mangrove_cells: 0,
        },
        weather_context: {
            data_mode: weather.error ? 'fallback' : 'live',
            source: weather.source ?? 'OpenWeatherMap',
            timestamp: weather.timestamp ?? new Date().toISOString(),
            coordinates: COORDS,
            region: REGION,
            weather_now: weather.weather_now,
            proxies: {
                rain_intensity: Math.min(1, (weather.weather_now?.rain_mm_h ?? 0) / 25),
                soil_saturation_proxy: (weather.weather_now?.humidity_pct ?? 0) / 100,
                tidal_stage_proxy: 0.5,
            },
        },
        geometry: EMPTY_FC,
    };
}

export async function fetchSarWaterMask(): Promise<SarWaterMaskResponse> {
    const cached = await fromFirestore<SarWaterMaskResponse>('api_cache', 'sar_water_mask');
    if (cached) return cached;

    const status = await getFloodStatus();
    const sar = status.sar_data;
    return {
        data_mode: sar?.error ? 'fallback' : 'live',
        bbox: BBOX,
        date: sar?.date_acquired ?? new Date().toISOString().split('T')[0],
        scene: {
            scene_id: sar?.date_acquired ?? 'unknown',
            acquired_at: sar?.date_acquired ?? new Date().toISOString(),
            orbit_pass: 'DESCENDING',
            polarization: 'VV',
        },
        stats: {
            mangrove_cells: 0,
            water_cells: 0,
            water_extent_ratio: sar?.flood_anomaly_fraction ?? 0,
        },
        geometry: EMPTY_FC,
        analysis_grid: EMPTY_FC,
    };
}

export async function fetchEcosystemHealth(): Promise<EcosystemHealthResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/ecosystem-health`);
        if (response.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = await response.json();
            return {
                bbox: BBOX,
                date: data.date_acquired ?? new Date().toISOString().split('T')[0],
                health_index: data.health_index ?? 0,
                classification: data.classification ?? 'unknown',
                trend: data.trend ?? 'stable',
                components: data.components ?? {
                    ndvi_mean: 0,
                    canopy_cover: null,
                    fragmentation_index: null,
                    species_diversity: 'N/A',
                    water_quality: 'N/A',
                },
                zone_summaries: data.zone_summaries ?? [],
                alerts: data.alerts ?? [],
                model: data.model ?? { model_id: 'mangrove-v4-torch', version: '4.2.0' },
            };
        }
    } catch {}

    const cached = await fromFirestore<EcosystemHealthResponse>('api_cache', 'ecosystem_health');
    if (cached) return cached;

    // Derive from unified flood status as last resort
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h: any = (await getFloodStatus()).ecosystem_health;
    return {
        bbox: BBOX,
        date: h.date_acquired ?? h.date ?? new Date().toISOString().split('T')[0],
        health_index: h.health_index ?? 0,
        classification: h.classification ?? 'unknown',
        trend: h.trend ?? 'stable',
        components: h.components ?? {
            ndvi_mean: 0,
            canopy_cover: null,
            fragmentation_index: null,
            species_diversity: 'N/A',
            water_quality: 'N/A',
        },
        zone_summaries: h.zone_summaries ?? [],
        alerts: h.alerts ?? [],
        model: h.model ?? { model_id: 'mangrove-v4-torch', version: '4.2.0' },
    };
}

export async function fetchEcosystemTimeseries(): Promise<EcosystemTimeseriesResponse> {
    const cached = await fromFirestore<EcosystemTimeseriesResponse>('api_cache', 'ecosystem_timeseries');
    if (cached) return cached;

    const health = await fetchEcosystemHealth();
    const today = health.date;
    return {
        bbox: BBOX,
        from: today,
        to: today,
        timeseries: [{
            date: today,
            health_index: health.health_index,
            ndvi_mean: health.components.ndvi_mean,
            canopy_cover: (health.components.canopy_cover as number) ?? 0,
            fragmentation_index: (health.components.fragmentation_index as number) ?? 0,
        }],
        zone_series: (health.zone_summaries ?? []).map(z => ({
            zone_id: z.zone_id,
            zone_name: z.zone_name,
            series: [{
                date: today,
                health_index: z.health_index,
                ndvi_mean: z.ndvi,
                canopy_cover: z.canopy_cover,
                fragmentation_index: z.fragmentation,
            }],
        })),
    };
}

export async function fetchEcosystemAnomalies(): Promise<EcosystemAnomaliesResponse> {
    const cached = await fromFirestore<EcosystemAnomaliesResponse>('api_cache', 'ecosystem_anomalies');
    if (cached) return cached;

    const health = await fetchEcosystemHealth();
    const today = health.date;
    return {
        bbox: BBOX,
        from: today,
        to: today,
        anomalies: (health.alerts ?? [])
            .filter(a => a.severity !== 'info')
            .map((alert, i) => ({
                id: `${alert.zone_id}-${i}`,
                date: today,
                zone_id: alert.zone_id,
                zone_name: alert.zone_name,
                anomaly_type: alert.alert_type,
                severity: alert.severity as 'warning' | 'critical',
                metric: alert.alert_type,
                observed_value: 0,
                expected_range: [0, 1] as [number, number],
                deviation_sigma: 0,
                description: alert.message,
                location: COORDS,
            })),
    };
}

/**
 * Triggers a full data refresh on all backend sources in parallel.
 * Used by the Navbar SYNC button.
 */
export async function syncAllData(): Promise<void> {
    await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/trigger/weather`, { method: 'POST' }),
        fetch(`${API_BASE_URL}/api/v1/trigger/tide`, { method: 'POST' }),
        fetch(`${API_BASE_URL}/api/v1/trigger/sar`, { method: 'POST' }),
        fetch(`${API_BASE_URL}/api/v1/trigger/ecosystem-health`, { method: 'POST' }),
    ]);
}

export async function triggerManualUpdate(type: "weather" | "tide" | "sar" | "ecosystem-health"): Promise<unknown> {
    const endpoint = `/api/v1/trigger/${type}`;
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
        });
        return await response.json();
    } catch (error) {
        console.error(`Local trigger failed for ${type}:`, error);
        throw error;
    }
}
