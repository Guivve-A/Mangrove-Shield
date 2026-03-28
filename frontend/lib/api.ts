import type {
  FloodCollection,
  HealthSummaryResponse,
  HealthTimeseriesResponse,
  HotspotCollection,
  LayerBundle,
  MangroveCollection,
  MangroveTimelineResponse,
  MangroveYearRecord,
  PriorityCollection,
} from '@/types/geospatial';
import { API_BASE_URL, DATE_FALLBACK } from '@/lib/constants';

const API_LAYER_MAP = {
  flood: 'flood',
  priorities: 'priorities',
  mangroveExtent: 'mangrove_extent',
  mangroveHotspots: 'mangrove_hotspots',
} as const;

async function safeJsonFetch<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return (await response.json()) as T;
}

async function loadLayerFromApi<T>(layerName: string, date?: string): Promise<T> {
  const dateQuery = date ? `?date=${encodeURIComponent(date)}` : '';
  return safeJsonFetch<T>(`${API_BASE_URL}/api/v1/layers/${layerName}${dateQuery}`);
}

async function loadLayerFromLocal<T>(layerName: string, date?: string): Promise<T> {
  const base = `/data/demo/${layerName}.geojson`;
  const dataset = await safeJsonFetch<{ type: 'FeatureCollection'; features: any[] }>(base);

  if (!date) {
    return dataset as T;
  }

  const filtered = {
    ...dataset,
    features: dataset.features.filter((feature) => feature?.properties?.date === date),
  };

  return filtered as T;
}

export async function loadTimeline(): Promise<string[]> {
  try {
    const response = await safeJsonFetch<{ dates: string[] }>(`${API_BASE_URL}/api/v1/timeline`);
    return response.dates?.length ? response.dates : DATE_FALLBACK;
  } catch {
    return DATE_FALLBACK;
  }
}

// --- Mangrove historical change (GMW v3.0) ---

const MANGROVE_TIMELINE_FALLBACK: MangroveYearRecord[] = [
  { year: 2014, total_ha: 52480, loss_ha: 0, gain_ha: 0, delta_ha: 0, loss_rate_pct: 0 },
  { year: 2016, total_ha: 51340, loss_ha: 1420, gain_ha: 280, delta_ha: -1140, loss_rate_pct: 2.71 },
  { year: 2018, total_ha: 49870, loss_ha: 1780, gain_ha: 310, delta_ha: -1470, loss_rate_pct: 3.47 },
  { year: 2020, total_ha: 48320, loss_ha: 1890, gain_ha: 340, delta_ha: -1550, loss_rate_pct: 3.79 },
  { year: 2022, total_ha: 47650, loss_ha: 920, gain_ha: 250, delta_ha: -670, loss_rate_pct: 1.93 },
  { year: 2024, total_ha: 47180, loss_ha: 740, gain_ha: 270, delta_ha: -470, loss_rate_pct: 1.55 },
];

export async function loadMangroveTimeline(): Promise<MangroveTimelineResponse> {
  try {
    return await safeJsonFetch<MangroveTimelineResponse>(
      `${API_BASE_URL}/api/v1/mangrove/timeline`,
    );
  } catch {
    const records = MANGROVE_TIMELINE_FALLBACK;
    const totalLoss = records.reduce((s, r) => s + r.loss_ha, 0);
    const totalGain = records.reduce((s, r) => s + r.gain_ha, 0);
    return {
      bbox: [-80.1, -2.4, -79.4, -1.7],
      years: records.map((r) => r.year),
      summary: {
        total_loss_ha: totalLoss,
        total_gain_ha: totalGain,
        net_change_ha: totalGain - totalLoss,
      },
      records,
    };
  }
}

// --- Mangrove health indices (Sentinel-2 + NASA AGB) ---

export async function loadHealthSummary(): Promise<HealthSummaryResponse> {
  try {
    return await safeJsonFetch<HealthSummaryResponse>(
      `${API_BASE_URL}/api/v1/health/summary`,
    );
  } catch {
    return {
      period: '2024-12',
      global_health_pct: 72,
      ndvi_mean: 0.6875,
      ndwi_mean: 0.34,
      classification: { status: 'Moderado', level: 'moderate', color: '#eab308' },
      distribution: { healthy: 18, moderate: 54, degraded: 23, critical: 5 },
      municipalities: [
        { name: 'Guayaquil', ndvi: 0.68, ndwi: 0.34, agb_mg_ha: 168.4, canopy_height_m: 12.8, annual_delta: -0.04, status: 'Moderado', level: 'moderate', color: '#eab308' },
        { name: 'Duran', ndvi: 0.71, ndwi: 0.35, agb_mg_ha: 182.1, canopy_height_m: 14.2, annual_delta: -0.02, status: 'Moderado', level: 'moderate', color: '#eab308' },
        { name: 'Daule', ndvi: 0.81, ndwi: 0.39, agb_mg_ha: 204.7, canopy_height_m: 16.5, annual_delta: 0.01, status: 'Saludable', level: 'healthy', color: '#10b981' },
        { name: 'Samborondon', ndvi: 0.55, ndwi: 0.28, agb_mg_ha: 121.3, canopy_height_m: 9.1, annual_delta: -0.08, status: 'Degradado', level: 'degraded', color: '#f97316' },
      ],
    };
  }
}

export async function loadHealthTimeseries(months: number = 24): Promise<HealthTimeseriesResponse> {
  try {
    return await safeJsonFetch<HealthTimeseriesResponse>(
      `${API_BASE_URL}/api/v1/health/timeseries?months=${months}`,
    );
  } catch {
    // Generate fallback 24-month series
    const base: Record<string, number> = { Guayaquil: 0.68, Duran: 0.71, Daule: 0.81, Samborondon: 0.55 };
    const delta: Record<string, number> = { Guayaquil: -0.04, Duran: -0.02, Daule: 0.01, Samborondon: -0.08 };
    const seasonal = [0.03, 0.04, 0.05, 0.04, 0.03, 0.00, -0.03, -0.05, -0.04, -0.02, 0.00, 0.02];
    const munis = ['Guayaquil', 'Duran', 'Daule', 'Samborondon'];
    const monthLabels: string[] = [];
    const series: Record<string, number[]> = {};
    const regionalMean: number[] = [];
    munis.forEach((m) => { series[m] = []; });

    for (let i = 0; i < 24; i++) {
      const y = 2024 + Math.floor(i / 12);
      const mo = (i % 12) + 1;
      monthLabels.push(`${y}-${String(mo).padStart(2, '0')}`);
      const s = seasonal[mo - 1];
      const yearOff = (i - 12) / 12;
      let sum = 0;
      for (const m of munis) {
        const v = Math.max(0.1, Math.min(1.0, +(base[m] + delta[m] * yearOff + s).toFixed(4)));
        series[m].push(v);
        sum += v;
      }
      regionalMean.push(+(sum / munis.length).toFixed(4));
    }

    return { municipalities: munis, months: monthLabels, series, regional_mean: regionalMean };
  }
}

export async function loadLayerBundle(date: string): Promise<LayerBundle> {
  try {
    const [flood, priorities, mangroveExtent, mangroveHotspots] = await Promise.all([
      loadLayerFromApi<FloodCollection>(API_LAYER_MAP.flood, date),
      loadLayerFromApi<PriorityCollection>(API_LAYER_MAP.priorities, date),
      loadLayerFromApi<MangroveCollection>(API_LAYER_MAP.mangroveExtent, date),
      loadLayerFromApi<HotspotCollection>(API_LAYER_MAP.mangroveHotspots, date),
    ]);

    return {
      flood,
      priorities,
      mangroveExtent,
      mangroveHotspots,
    };
  } catch {
    const [flood, priorities, mangroveExtent, mangroveHotspots] = await Promise.all([
      loadLayerFromLocal<FloodCollection>('flood_polygons', date),
      loadLayerFromLocal<PriorityCollection>('priority_zones', date),
      loadLayerFromLocal<MangroveCollection>('mangrove_extent', date),
      loadLayerFromLocal<HotspotCollection>('mangrove_hotspots', date),
    ]);

    return {
      flood,
      priorities,
      mangroveExtent,
      mangroveHotspots,
    };
  }
}
