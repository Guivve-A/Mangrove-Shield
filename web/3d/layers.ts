import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';

export type LayerKey = 'flood' | 'priorities' | 'mangrove_extent' | 'mangrove_hotspots';
export type DashboardTab = 'Flood' | 'Mangrove' | 'Priorities';

export const DEM_SOURCE_ID = 'dem';

export const SOURCE_IDS: Record<LayerKey, string> = {
  flood: 'flood-source',
  priorities: 'priority-source',
  mangrove_extent: 'mangrove-source',
  mangrove_hotspots: 'hotspot-source',
};

export const LAYER_IDS = {
  floodFill: 'flood-fill',
  floodOutline: 'flood-outline',
  priorityFill: 'priority-fill',
  priorityExtrusion: 'priority-extrusion',
  mangroveFill: 'mangrove-fill',
  mangroveOutline: 'mangrove-outline',
  mangroveExtrusion: 'mangrove-extent-extrusion',
  hotspotFill: 'hotspot-fill',
  hotspotExtrusion: 'mangrove-hotspots-extrusion',
} as const;

export const TERRAIN_EXAGGERATION = 1.8;
export const PRIORITY_HEIGHT_MULTIPLIER = 100;
export const HOTSPOT_HEIGHT_MULTIPLIER = 80;
export const MANGROVE_BAND_HEIGHT = 5;

export const PRIORITY_HEIGHT_EXPRESSION = [
  '*',
  ['coalesce', ['to-number', ['get', 'priority_score']], 0],
  PRIORITY_HEIGHT_MULTIPLIER,
] as const;

export const HOTSPOT_HEIGHT_EXPRESSION = [
  '*',
  ['coalesce', ['to-number', ['get', 'severity']], 0],
  HOTSPOT_HEIGHT_MULTIPLIER,
] as const;

export const DEFAULT_VIEW = {
  center: [-75.559, 10.417] as [number, number],
  zoom: 12.2,
  pitch2D: 0,
  pitch3D: 58,
  bearing2D: 0,
  bearing3D: -20,
};

export function ensureTerrainSource(map: MapboxMap, tilesUrl: string): void {
  if (map.getSource(DEM_SOURCE_ID)) {
    return;
  }

  map.addSource(DEM_SOURCE_ID, {
    type: 'raster-dem',
    tiles: [tilesUrl],
    tileSize: 256,
    maxzoom: 0,
    minzoom: 0,
    encoding: 'terrarium',
  } as any);
}

export function ensureGeoJsonSource(map: MapboxMap, sourceId: string, data: FeatureCollection): void {
  const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (existingSource && 'setData' in existingSource) {
    existingSource.setData(data as any);
    return;
  }

  map.addSource(sourceId, {
    type: 'geojson',
    data,
    promoteId: 'id',
  });
}

export function ensureBaseLayers(map: MapboxMap): void {
  if (!map.getLayer(LAYER_IDS.floodFill)) {
    map.addLayer({
      id: LAYER_IDS.floodFill,
      type: 'fill',
      source: SOURCE_IDS.flood,
      paint: {
        'fill-color': '#1f9be6',
        'fill-opacity': 0.45,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.floodOutline)) {
    map.addLayer({
      id: LAYER_IDS.floodOutline,
      type: 'line',
      source: SOURCE_IDS.flood,
      paint: {
        'line-color': '#0f5f9c',
        'line-width': 1.3,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.priorityFill)) {
    map.addLayer({
      id: LAYER_IDS.priorityFill,
      type: 'fill',
      source: SOURCE_IDS.priorities,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'priority_score']], 0],
          0,
          '#2a9d8f',
          0.5,
          '#f4a261',
          1,
          '#e63946',
        ],
        'fill-opacity': 0.62,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.mangroveFill)) {
    map.addLayer({
      id: LAYER_IDS.mangroveFill,
      type: 'fill',
      source: SOURCE_IDS.mangrove_extent,
      paint: {
        'fill-color': '#2f7f4f',
        'fill-opacity': 0.36,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.mangroveOutline)) {
    map.addLayer({
      id: LAYER_IDS.mangroveOutline,
      type: 'line',
      source: SOURCE_IDS.mangrove_extent,
      paint: {
        'line-color': '#14532d',
        'line-width': 1.4,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.hotspotFill)) {
    map.addLayer({
      id: LAYER_IDS.hotspotFill,
      type: 'fill',
      source: SOURCE_IDS.mangrove_hotspots,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'severity']], 0],
          0,
          '#238b45',
          0.4,
          '#7fbc41',
          0.7,
          '#f8961e',
          1,
          '#d62828',
        ],
        'fill-opacity': 0.7,
      },
    });
  }
}

export function ensure3DLayers(map: MapboxMap): void {
  if (!map.getLayer(LAYER_IDS.priorityExtrusion)) {
    map.addLayer({
      id: LAYER_IDS.priorityExtrusion,
      type: 'fill-extrusion',
      source: SOURCE_IDS.priorities,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'priority_score']], 0],
          0,
          '#2a9d8f',
          0.5,
          '#f4a261',
          1,
          '#c1121f',
        ],
        'fill-extrusion-height': PRIORITY_HEIGHT_EXPRESSION as any,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.mangroveExtrusion)) {
    map.addLayer({
      id: LAYER_IDS.mangroveExtrusion,
      type: 'fill-extrusion',
      source: SOURCE_IDS.mangrove_extent,
      paint: {
        'fill-extrusion-color': '#2f7f4f',
        'fill-extrusion-height': MANGROVE_BAND_HEIGHT,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.72,
      },
    });
  }

  if (!map.getLayer(LAYER_IDS.hotspotExtrusion)) {
    map.addLayer({
      id: LAYER_IDS.hotspotExtrusion,
      type: 'fill-extrusion',
      source: SOURCE_IDS.mangrove_hotspots,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'severity']], 0],
          0,
          '#2a9d8f',
          0.5,
          '#f8961e',
          1,
          '#b2182b',
        ],
        'fill-extrusion-height': HOTSPOT_HEIGHT_EXPRESSION as any,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
      },
    });
  }
}

export function remove3DLayers(map: MapboxMap): void {
  [LAYER_IDS.hotspotExtrusion, LAYER_IDS.mangroveExtrusion, LAYER_IDS.priorityExtrusion].forEach(
    (layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }
  );
}

function setVisibility(map: MapboxMap, layerId: string, visible: boolean): void {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

export function applyTabVisibility(map: MapboxMap, tab: DashboardTab, is3DEnabled: boolean): void {
  if (is3DEnabled) {
    setVisibility(map, LAYER_IDS.floodFill, true);
    setVisibility(map, LAYER_IDS.floodOutline, true);
    setVisibility(map, LAYER_IDS.priorityFill, false);
    setVisibility(map, LAYER_IDS.priorityExtrusion, true);
    setVisibility(map, LAYER_IDS.mangroveFill, true);
    setVisibility(map, LAYER_IDS.mangroveOutline, true);
    setVisibility(map, LAYER_IDS.mangroveExtrusion, true);
    setVisibility(map, LAYER_IDS.hotspotFill, false);
    setVisibility(map, LAYER_IDS.hotspotExtrusion, true);
    return;
  }

  setVisibility(map, LAYER_IDS.floodFill, tab === 'Flood');
  setVisibility(map, LAYER_IDS.floodOutline, tab === 'Flood');
  setVisibility(map, LAYER_IDS.priorityFill, tab === 'Priorities');
  setVisibility(map, LAYER_IDS.mangroveFill, tab === 'Mangrove');
  setVisibility(map, LAYER_IDS.mangroveOutline, tab === 'Mangrove');
  setVisibility(map, LAYER_IDS.hotspotFill, tab === 'Mangrove');

  setVisibility(map, LAYER_IDS.priorityExtrusion, false);
  setVisibility(map, LAYER_IDS.mangroveExtrusion, false);
  setVisibility(map, LAYER_IDS.hotspotExtrusion, false);
}

export function setTerrainMode(map: MapboxMap, enabled: boolean): void {
  map.setTerrain(enabled ? { source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION } : null);
}

export function resetCamera(map: MapboxMap, is3DEnabled: boolean): void {
  map.easeTo({
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    pitch: is3DEnabled ? DEFAULT_VIEW.pitch3D : DEFAULT_VIEW.pitch2D,
    bearing: is3DEnabled ? DEFAULT_VIEW.bearing3D : DEFAULT_VIEW.bearing2D,
    duration: 700,
  });
}

export function startFloodAnimation(map: MapboxMap): () => void {
  let frameId: number | null = null;
  let running = true;
  const start = performance.now();

  const tick = (): void => {
    if (!running) {
      return;
    }

    const elapsedSeconds = (performance.now() - start) / 1000;
    const animatedOpacity = 0.35 + ((Math.sin(elapsedSeconds * 2.2) + 1) / 2) * 0.35;

    if (map.getLayer(LAYER_IDS.floodFill)) {
      map.setPaintProperty(LAYER_IDS.floodFill, 'fill-opacity', animatedOpacity);
    }

    frameId = requestAnimationFrame(tick);
  };

  tick();

  return () => {
    running = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    if (map.getLayer(LAYER_IDS.floodFill)) {
      map.setPaintProperty(LAYER_IDS.floodFill, 'fill-opacity', 0.45);
    }
  };
}

export const INTERACTIVE_LAYER_IDS = [
  LAYER_IDS.priorityFill,
  LAYER_IDS.priorityExtrusion,
  LAYER_IDS.floodFill,
  LAYER_IDS.hotspotExtrusion,
  LAYER_IDS.mangroveExtrusion,
] as const;
