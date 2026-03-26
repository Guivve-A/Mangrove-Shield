import type {
  FloodCollection,
  HotspotCollection,
  LayerBundle,
  MangroveCollection,
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
