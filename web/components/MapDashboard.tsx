import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import mapboxgl, { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';

import {
  DEFAULT_VIEW,
  INTERACTIVE_LAYER_IDS,
  SOURCE_IDS,
  DashboardTab,
  applyTabVisibility,
  ensure3DLayers,
  ensureBaseLayers,
  ensureGeoJsonSource,
  ensureTerrainSource,
  remove3DLayers,
  resetCamera,
  setTerrainMode,
  startFloodAnimation,
} from '../3d/layers';

type LayerPayload = {
  flood: FeatureCollection;
  priorities: FeatureCollection;
  mangrove_extent: FeatureCollection;
  mangrove_hotspots: FeatureCollection;
};

type TooltipState = {
  x: number;
  y: number;
  floodLikelihood: string;
  exposure: string;
  mangroveHealth: string;
  priorityScore: string;
};

const DEFAULT_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const EMPTY_LAYERS: LayerPayload = {
  flood: DEFAULT_COLLECTION,
  priorities: DEFAULT_COLLECTION,
  mangrove_extent: DEFAULT_COLLECTION,
  mangrove_hotspots: DEFAULT_COLLECTION,
};

const TABS: DashboardTab[] = ['Flood', 'Mangrove', 'Priorities'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

async function fetchLayer(layerName: keyof LayerPayload, date: string | null): Promise<FeatureCollection> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/v1/layers/${layerName}${suffix}`);
  if (!response.ok) {
    throw new Error(`Layer request failed for ${layerName}`);
  }
  return (await response.json()) as FeatureCollection;
}

function formatMetric(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    return value;
  }
  return 'n/a';
}

interface MapDashboardProps {
  initial3DEnabled?: boolean;
}

export default function MapDashboard({ initial3DEnabled = false }: MapDashboardProps): JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const floodAnimationStopRef = useRef<null | (() => void)>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [is3DEnabled, setIs3DEnabled] = useState(initial3DEnabled);
  const [activeTab, setActiveTab] = useState<DashboardTab>('Flood');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [layerData, setLayerData] = useState<LayerPayload>(EMPTY_LAYERS);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDate = useMemo(() => {
    if (!dates.length) {
      return null;
    }
    return dates[Math.min(selectedDateIndex, dates.length - 1)];
  }, [dates, selectedDateIndex]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'local-dem-mode';

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'osm-raster',
            type: 'raster',
            source: 'osm-raster',
          },
        ],
      },
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      pitch: DEFAULT_VIEW.pitch2D,
      bearing: DEFAULT_VIEW.bearing2D,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('load', () => {
      setIsLoaded(true);
    });

    const handleMouseMove = (event: MapMouseEvent): void => {
      const availableLayers = INTERACTIVE_LAYER_IDS.filter((layerId) => map.getLayer(layerId));
      if (!availableLayers.length) {
        setTooltip(null);
        return;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: availableLayers as string[],
      });

      if (!features.length) {
        setTooltip(null);
        return;
      }

      const properties = (features[0].properties || {}) as Record<string, unknown>;
      setTooltip({
        x: event.point.x,
        y: event.point.y,
        floodLikelihood: formatMetric(properties.flood_likelihood),
        exposure: formatMetric(properties.exposure),
        mangroveHealth: formatMetric(properties.mangrove_health),
        priorityScore: formatMetric(properties.priority_score),
      });
    };

    const handleMouseLeave = (): void => setTooltip(null);

    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);

    return () => {
      if (floodAnimationStopRef.current) {
        floodAnimationStopRef.current();
        floodAnimationStopRef.current = null;
      }
      map.off('mousemove', handleMouseMove);
      map.off('mouseleave', handleMouseLeave);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadTimeline = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/timeline`);
        if (!response.ok) {
          throw new Error('Timeline request failed');
        }
        const payload = (await response.json()) as { dates: string[] };
        const timeline = payload.dates || [];
        setDates(timeline);
        setSelectedDateIndex(0);
      } catch (timelineError) {
        setError(`Timeline error: ${(timelineError as Error).message}`);
        setDates(['2026-01-01', '2026-01-15', '2026-02-01']);
        setSelectedDateIndex(0);
      }
    };

    void loadTimeline();
  }, []);

  useEffect(() => {
    const loadLayers = async (): Promise<void> => {
      try {
        const [flood, priorities, mangroveExtent, hotspots] = await Promise.all([
          fetchLayer('flood', selectedDate),
          fetchLayer('priorities', selectedDate),
          fetchLayer('mangrove_extent', selectedDate),
          fetchLayer('mangrove_hotspots', selectedDate),
        ]);

        setLayerData({
          flood,
          priorities,
          mangrove_extent: mangroveExtent,
          mangrove_hotspots: hotspots,
        });
        setError(null);
      } catch (layerError) {
        setError(`Layer loading error: ${(layerError as Error).message}`);
      }
    };

    void loadLayers();
  }, [selectedDate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) {
      return;
    }

    ensureTerrainSource(map, `${API_BASE_URL}/api/v1/tiles/dem/{z}/{x}/{y}.png`);
    ensureGeoJsonSource(map, SOURCE_IDS.flood, layerData.flood);
    ensureGeoJsonSource(map, SOURCE_IDS.priorities, layerData.priorities);
    ensureGeoJsonSource(map, SOURCE_IDS.mangrove_extent, layerData.mangrove_extent);
    ensureGeoJsonSource(map, SOURCE_IDS.mangrove_hotspots, layerData.mangrove_hotspots);
    ensureBaseLayers(map);

    applyTabVisibility(map, activeTab, is3DEnabled);
  }, [isLoaded, layerData, activeTab, is3DEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) {
      return;
    }

    if (is3DEnabled) {
      ensure3DLayers(map);
      setTerrainMode(map, true);
      if (!floodAnimationStopRef.current) {
        floodAnimationStopRef.current = startFloodAnimation(map);
      }
      map.easeTo({
        pitch: DEFAULT_VIEW.pitch3D,
        bearing: DEFAULT_VIEW.bearing3D,
        duration: 700,
      });
    } else {
      if (floodAnimationStopRef.current) {
        floodAnimationStopRef.current();
        floodAnimationStopRef.current = null;
      }
      setTerrainMode(map, false);
      remove3DLayers(map);
      map.easeTo({
        pitch: DEFAULT_VIEW.pitch2D,
        bearing: DEFAULT_VIEW.bearing2D,
        duration: 700,
      });
    }

    applyTabVisibility(map, activeTab, is3DEnabled);
  }, [isLoaded, is3DEnabled, activeTab]);

  const onResetCamera = (): void => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    resetCamera(map, is3DEnabled);
  };

  return (
    <main className="dashboard-shell">
      <section className="panel controls-panel">
        <h1>MangroveShield</h1>
        <p className="subtitle">Risk intelligence for flood resilience and mangrove protection.</p>

        <div className="controls-row">
          <label className="toggle" htmlFor="toggle-3d">
            <input
              id="toggle-3d"
              type="checkbox"
              checked={is3DEnabled}
              onChange={(event) => setIs3DEnabled(event.target.checked)}
            />
            <span>{is3DEnabled ? '3D View' : '2D View'}</span>
          </label>

          <button type="button" className="reset-btn" onClick={onResetCamera}>
            Reset Camera
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="Layer tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab}
              role="tab"
              aria-selected={tab === activeTab}
              className={tab === activeTab ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="timeline">
          <label htmlFor="timeline-range">Timeline</label>
          <input
            id="timeline-range"
            type="range"
            min={0}
            max={Math.max(0, dates.length - 1)}
            value={selectedDateIndex}
            disabled={!dates.length}
            onChange={(event) => setSelectedDateIndex(Number(event.target.value))}
          />
          <div className="timeline-value">{selectedDate || 'No date available'}</div>
        </div>

        {error ? <div className="error">{error}</div> : null}
      </section>

      <section className="panel map-panel">
        <div ref={mapContainerRef} className="map-container" data-testid="map-container" />
        {tooltip ? (
          <div
            className="tooltip"
            style={{ left: `${tooltip.x + 16}px`, top: `${tooltip.y + 16}px` }}
            data-testid="layer-tooltip"
          >
            <strong>Risk Metrics</strong>
            <div>flood likelihood: {tooltip.floodLikelihood}</div>
            <div>exposure: {tooltip.exposure}</div>
            <div>mangrove health: {tooltip.mangroveHealth}</div>
            <div>priority_score: {tooltip.priorityScore}</div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
