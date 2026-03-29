import type {
  FloodCollection,
  FloodCorrelationResponse,
  FloodEventsResponse,
  HealthSummaryResponse,
  HealthTimeseriesResponse,
  HotspotCollection,
  LayerBundle,
  MangroveCollection,
  MangroveTimelineResponse,
  MangroveTilesResponse,
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

/**
 * Returns true only if every consecutive year-to-year total_ha change is ≤ 40 % of the
 * previous value. Larger swings indicate GEE cloud-cover artefacts, not real ecology.
 */
function isTimelinePlausible(records: MangroveYearRecord[]): boolean {
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1].total_ha;
    if (prev > 0 && Math.abs(records[i].total_ha - prev) / prev > 0.40) return false;
  }
  return true;
}

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
    const res = await safeJsonFetch<MangroveTimelineResponse>(
      `${API_BASE_URL}/api/v1/mangrove/timeline?mode=auto`,
    );
    // API may return Firestore data or its own fallback; tag if not already tagged
    if (!res._source) res._source = 'api';
    // Reject GEE artefacts (wild total_ha swings) — fall through to calibrated fallback
    if (!isTimelinePlausible(res.records)) throw new Error('implausible_gee_data');
    return res;
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
      _source: 'calibrated_estimate',
    };
  }
}

export async function loadMangroveTiles(
  year: number,
  compare: MangroveTilesResponse['compare_mode'] = 'prev',
): Promise<MangroveTilesResponse> {
  return safeJsonFetch<MangroveTilesResponse>(
    `${API_BASE_URL}/api/v1/mangrove/tiles?year=${encodeURIComponent(String(year))}&compare=${encodeURIComponent(compare)}`,
  );
}

// --- Mangrove health indices (Sentinel-2 + NASA AGB) ---

export async function loadHealthSummary(): Promise<HealthSummaryResponse> {
  try {
    const res = await safeJsonFetch<HealthSummaryResponse>(
      `${API_BASE_URL}/api/v1/health/summary`,
    );
    if (!res._source) res._source = 'api';
    return res;
  } catch {
    return {
      _source: 'calibrated_estimate',
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
    const res = await safeJsonFetch<HealthTimeseriesResponse>(
      `${API_BASE_URL}/api/v1/health/timeseries?months=${months}`,
    );
    if (!res._source) res._source = 'api';
    return res;
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

    return { municipalities: munis, months: monthLabels, series, regional_mean: regionalMean, _source: 'calibrated_estimate' };
  }
}

// --- Flood events & correlation (Copernicus EMS + INAMHI + Sentinel-1 SAR) ---

const FLOOD_EVENTS_FALLBACK: FloodEventsResponse = {
  bbox: [-80.1, -2.4, -79.4, -1.7],
  year_from: 2015,
  year_to: 2024,
  severity_filter: 'all',
  total_events: 10,
  total_affected_people: 74400,
  total_flood_area_ha: 46020,
  _source: 'calibrated_estimate',
  events: [
    { id: 'ev2015-03', date: '2015-03-15', year: 2015, month: 3, label: 'Mar 2015', rain_mm_day: 38.4, tide_level_m: 2.1,  affected_people: 3200,  damage_usd_m: 8.2,  flood_area_ha: 1840, severity: 'moderate', description: 'Precipitación intensa zona norte - La Puntilla',           correlation_pct: 71, source: 'INAMHI / SNGR-2015-EC-03' },
    { id: 'ev2016-02', date: '2016-02-20', year: 2016, month: 2, label: 'Feb 2016', rain_mm_day: 44.7, tide_level_m: 2.4,  affected_people: 5800,  damage_usd_m: 14.1, flood_area_ha: 2760, severity: 'moderate', description: 'Desbordamiento Río Daule - sector periurbano',           correlation_pct: 74, source: 'INAMHI / Copernicus EMS EMSR212' },
    { id: 'ev2018-03', date: '2018-03-08', year: 2018, month: 3, label: 'Mar 2018', rain_mm_day: 56.2, tide_level_m: 2.6,  affected_people: 9400,  damage_usd_m: 22.7, flood_area_ha: 3980, severity: 'severe',   description: 'Inundación costera - Isla Trinitaria / Guasmo',           correlation_pct: 79, source: 'INAMHI / SNGR-2018-EC-08' },
    { id: 'ev2019-02', date: '2019-02-14', year: 2019, month: 2, label: 'Feb 2019', rain_mm_day: 42.1, tide_level_m: 2.2,  affected_people: 4100,  damage_usd_m: 11.3, flood_area_ha: 2100, severity: 'moderate', description: 'Lluvias persistentes - Durán y Samborondón',             correlation_pct: 68, source: 'INAMHI 2019' },
    { id: 'ev2020-01', date: '2020-01-22', year: 2020, month: 1, label: 'Ene 2020', rain_mm_day: 39.8, tide_level_m: 2.3,  affected_people: 3700,  damage_usd_m: 9.8,  flood_area_ha: 2240, severity: 'moderate', description: 'Frente lluvioso estacional - corredor Guayaquil-Daule',   correlation_pct: 72, source: 'INAMHI / SNGR-2020-EC-01' },
    { id: 'ev2021-04', date: '2021-04-05', year: 2021, month: 4, label: 'Abr 2021', rain_mm_day: 48.3, tide_level_m: 2.5,  affected_people: 6200,  damage_usd_m: 16.4, flood_area_ha: 3120, severity: 'moderate', description: 'Marea alta + lluvias - áreas sin cobertura manglar',      correlation_pct: 76, source: 'INAMHI 2021 / Sentinel-1 SAR GEE' },
    { id: 'ev2023-02', date: '2023-02-12', year: 2023, month: 2, label: 'Feb 2023', rain_mm_day: 78.4, tide_level_m: 2.8,  affected_people: 14200, damage_usd_m: 47.0, flood_area_ha: 7840, severity: 'extreme',  description: 'Evento extremo - mayor inundación desde 2008',         correlation_pct: 84, source: 'INAMHI / Copernicus EMS EMSR641 / SNGR-2023-EC-02' },
    { id: 'ev2023-03', date: '2023-03-28', year: 2023, month: 3, label: 'Mar 2023', rain_mm_day: 65.1, tide_level_m: 2.7,  affected_people: 8900,  damage_usd_m: 31.2, flood_area_ha: 5320, severity: 'severe',   description: 'Reactivación sistema convectivo - zonas periurbanas',   correlation_pct: 81, source: 'INAMHI / Sentinel-1 SAR GEE' },
    { id: 'ev2024-01', date: '2024-01-18', year: 2024, month: 1, label: 'Ene 2024', rain_mm_day: 71.3, tide_level_m: 2.9,  affected_people: 11600, damage_usd_m: 38.5, flood_area_ha: 6540, severity: 'extreme',  description: 'Coincidencia marea-lluvia - año El Niño costero',      correlation_pct: 86, source: 'INAMHI / Copernicus EMS EMSR715 / SNGR-2024-EC-01' },
    { id: 'ev2024-03', date: '2024-03-07', year: 2024, month: 3, label: 'Mar 2024', rain_mm_day: 59.8, tide_level_m: 2.6,  affected_people: 7300,  damage_usd_m: 26.1, flood_area_ha: 4280, severity: 'severe',   description: 'Tren de tormenta - corredor costero sur',               correlation_pct: 80, source: 'INAMHI 2024 / Sentinel-1 SAR GEE' },
  ],
};

export async function loadFloodEvents(severity = 'all'): Promise<FloodEventsResponse> {
  try {
    const res = await safeJsonFetch<FloodEventsResponse>(
      `${API_BASE_URL}/api/v1/flood/events?severity=${severity}`,
    );
    if (!res._source) res._source = 'api';
    return res;
  } catch {
    const events = severity === 'all'
      ? FLOOD_EVENTS_FALLBACK.events
      : FLOOD_EVENTS_FALLBACK.events.filter((e) => e.severity === severity);
    return { ...FLOOD_EVENTS_FALLBACK, events, _source: 'calibrated_estimate' };
  }
}

export async function loadFloodCorrelation(): Promise<FloodCorrelationResponse> {
  try {
    const res = await safeJsonFetch<FloodCorrelationResponse>(
      `${API_BASE_URL}/api/v1/flood/correlation`,
    );
    if (!res._source) res._source = 'api';
    return res;
  } catch {
    return {
      type: 'FeatureCollection',
      metadata: {
        bbox: [-80.1, -2.4, -79.4, -1.7],
        cells_total: 0,
        cells_critical: 0,
        cells_high: 0,
        methodology: 'correlation_index = flood_frequency x (1 - mangrove_cover_2024)',
        sources: ['GMW v3.0', 'Sentinel-1 SAR GEE', 'Copernicus EMS', 'INAMHI'],
      },
      features: [],
      _source: 'calibrated_estimate',
    };
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
