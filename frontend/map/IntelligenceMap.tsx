import { useEffect, useMemo, useRef, useState } from 'react';

import centroid from '@turf/centroid';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { ColumnLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { gsap } from 'gsap';
import type { FeatureCollection } from 'geojson';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';

import { DEFAULT_CAMERA, HOTSPOT_CAMERA_PRESETS, SCENE_CAMERA_PRESETS } from '@/lib/constants';
import type { CameraState, LayerBundle, ScenarioConfig, UIScene, ZoneInspection } from '@/types/geospatial';
import type { LayerToggleState } from '@/components/ui/LayerToggles';

interface MapViewportProps {
  mapId: string;
  title: string;
  bundle: LayerBundle;
  scenario: ScenarioConfig;
  scene: UIScene;
  terrainMode: boolean;
  stormIntensity: number;
  selectedZoneId: string | null;
  selectedZone: ZoneInspection | null;
  onSelectZone: (id: string) => void;
  cameraState: CameraState;
  cameraSource: string;
  onCameraChange: (mapId: string, camera: CameraState) => void;
  waterMaskGeoJson?: FeatureCollection | null;
  vulnerabilityGeoJson?: FeatureCollection | null;
  layerToggles?: LayerToggleState;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  values: Array<{ label: string; value: string }>;
}

interface DataPoint {
  position: [number, number];
  weight: number;
  value?: number;
}

type MapPointerEvent = maplibregl.MapMouseEvent;

function featureCentroid(feature: any): [number, number] {
  const center = centroid(feature);
  return [Number(center.geometry.coordinates[0]), Number(center.geometry.coordinates[1])];
}

function mapSources(mapId: string) {
  return {
    flood: `${mapId}-flood-source`,
    priorities: `${mapId}-priority-source`,
    mangrove: `${mapId}-mangrove-source`,
    hotspots: `${mapId}-hotspot-source`,
    dem: `${mapId}-dem-source`,
    waterMask: `${mapId}-water-mask-source`,
    vulnerability: `${mapId}-vulnerability-source`,
  };
}

function mapLayers(mapId: string) {
  return {
    floodFill: `${mapId}-flood-fill`,
    floodOutline: `${mapId}-flood-outline`,
    floodWaterExtrusion: `${mapId}-flood-water-extrusion`,
    mangroveFill: `${mapId}-mangrove-fill`,
    mangroveOutline: `${mapId}-mangrove-outline`,
    mangroveExtrusion: `${mapId}-mangrove-extrusion`,
    urbanHeat: `${mapId}-urban-heat`,
    priorityOutline: `${mapId}-priority-outline`,
    priorityHit: `${mapId}-priority-hit`,
    priorityExtrusion: `${mapId}-priority-extrusion`,
    priorityHighlight: `${mapId}-priority-highlight`,
    hotspotCircle: `${mapId}-hotspot-circle`,
    hotspotExtrusion: `${mapId}-hotspot-extrusion`,
    waterMaskFill: `${mapId}-water-mask-fill`,
    vulnerabilityFill: `${mapId}-vulnerability-fill`,
  };
}

function hotspotRadiusExpression(hoverBoost = 0): any {
  return [
    '+',
    3,
    ['*', ['coalesce', ['to-number', ['get', 'severity']], 0], 14],
    ['case', ['boolean', ['feature-state', 'hover'], false], hoverBoost, 0],
  ];
}

function toDataPoints(bundle: LayerBundle): { flood: DataPoint[]; urban: DataPoint[]; hotspots: DataPoint[] } {
  const flood = bundle.flood.features.map((feature) => ({
    position: featureCentroid(feature),
    weight: Number(feature.properties?.flood_likelihood || 0),
  }));

  const urban = bundle.priorities.features.map((feature) => ({
    position: featureCentroid(feature),
    weight: Number(feature.properties?.exposure || 0),
    value: Number(feature.properties?.priority_score || 0),
  }));

  const hotspots = bundle.mangroveHotspots.features.map((feature) => ({
    position: featureCentroid(feature),
    weight: Number(feature.properties?.severity || 0),
  }));

  return { flood, urban, hotspots };
}

function getTooltipPayload(feature: maplibregl.MapGeoJSONFeature): TooltipState['values'] {
  const p = feature.properties || {};
  const values: TooltipState['values'] = [];

  if (p.flood_likelihood !== undefined) {
    values.push({ label: 'flood likelihood', value: Number(p.flood_likelihood || 0).toFixed(2) });
  }
  if (p.exposure !== undefined) {
    values.push({ label: 'urban exposure', value: Number(p.exposure || 0).toFixed(2) });
  }
  if (p.mangrove_health !== undefined) {
    values.push({ label: 'mangrove health', value: Number(p.mangrove_health || 0).toFixed(2) });
  }
  if (p.priority_score !== undefined) {
    values.push({ label: 'priority score', value: Number(p.priority_score || 0).toFixed(2) });
  }

  if (p.severity !== undefined && p.severity !== null) {
    values.push({ label: 'hotspot severity', value: Number(p.severity || 0).toFixed(2) });
  }

  return values;
}

function setZoneHighlight(map: MapLibreMap, layerId: string, selectedZoneId: string | null): void {
  if (!map.getLayer(layerId)) {
    return;
  }

  if (!selectedZoneId) {
    map.setFilter(layerId, ['==', ['id'], '']);
    return;
  }

  map.setFilter(layerId, ['==', ['id'], selectedZoneId]);
}

function configureBaseMap(map: MapLibreMap, mapId: string, bundle: LayerBundle): void {
  const sources = mapSources(mapId);
  const layers = mapLayers(mapId);

  if (!map.getSource(sources.flood)) {
    map.addSource(sources.flood, {
      type: 'geojson',
      data: bundle.flood as any,
      promoteId: 'id',
    });
  }

  if (!map.getSource(sources.priorities)) {
    map.addSource(sources.priorities, {
      type: 'geojson',
      data: bundle.priorities as any,
      promoteId: 'id',
    });
  }

  if (!map.getSource(sources.mangrove)) {
    map.addSource(sources.mangrove, {
      type: 'geojson',
      data: bundle.mangroveExtent as any,
      promoteId: 'id',
    });
  }

  if (!map.getSource(sources.hotspots)) {
    map.addSource(sources.hotspots, {
      type: 'geojson',
      data: bundle.mangroveHotspots as any,
      promoteId: 'id',
    });
  }

  if (!map.getLayer(layers.floodFill)) {
    map.addLayer({
      id: layers.floodFill,
      type: 'fill',
      source: sources.flood,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'flood_likelihood']], 0],
          0,
          '#1d4ed8',
          1,
          '#93c5fd',
        ],
        'fill-opacity': 0.24,
      },
    });
  }

  if (!map.getLayer(layers.floodOutline)) {
    map.addLayer({
      id: layers.floodOutline,
      type: 'line',
      source: sources.flood,
      paint: {
        'line-color': '#8cc8ff',
        'line-width': 1,
        'line-opacity': 0.75,
      },
    });
  }

  if (!map.getLayer(layers.mangroveFill)) {
    map.addLayer({
      id: layers.mangroveFill,
      type: 'fill',
      source: sources.mangrove,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'mangrove_health']], 0],
          0,
          '#b91c1c',
          0.5,
          '#f59e0b',
          1,
          '#16a34a',
        ],
        'fill-opacity': 0.42,
      },
    });
  }

  if (!map.getLayer(layers.mangroveOutline)) {
    map.addLayer({
      id: layers.mangroveOutline,
      type: 'line',
      source: sources.mangrove,
      paint: {
        'line-color': '#22c55e',
        'line-opacity': 0.9,
        'line-width': 1.2,
      },
    });
  }

  if (!map.getLayer(layers.urbanHeat)) {
    map.addLayer({
      id: layers.urbanHeat,
      type: 'heatmap',
      source: sources.priorities,
      paint: {
        'heatmap-weight': ['coalesce', ['to-number', ['get', 'exposure']], 0],
        'heatmap-intensity': 1.1,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(255, 237, 160, 0)',
          0.3,
          '#fbbf24',
          0.65,
          '#f97316',
          1,
          '#9a3412',
        ],
        'heatmap-radius': 22,
        'heatmap-opacity': 0.6,
      },
    });
  }

  if (!map.getLayer(layers.priorityOutline)) {
    map.addLayer({
      id: layers.priorityOutline,
      type: 'line',
      source: sources.priorities,
      paint: {
        'line-color': '#d4a15f',
        'line-opacity': 0.7,
        'line-width': 1,
      },
    });
  }

  if (!map.getLayer(layers.priorityHit)) {
    map.addLayer({
      id: layers.priorityHit,
      type: 'fill',
      source: sources.priorities,
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': 0,
      },
    });
  }

  if (!map.getLayer(layers.priorityHighlight)) {
    map.addLayer({
      id: layers.priorityHighlight,
      type: 'line',
      source: sources.priorities,
      paint: {
        'line-color': '#38bdf8',
        'line-width': 2.4,
        'line-opacity': 0.95,
      },
      filter: ['==', ['id'], ''],
    });
  }

  if (!map.getLayer(layers.hotspotCircle)) {
    map.addLayer({
      id: layers.hotspotCircle,
      type: 'circle',
      source: sources.hotspots,
      paint: {
        'circle-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'severity']], 0],
          0,
          '#22c55e',
          0.5,
          '#f59e0b',
          1,
          '#ef4444',
        ],
        'circle-radius': hotspotRadiusExpression(0),
        'circle-opacity': 0.95,
        'circle-stroke-color': '#e5f2ff',
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.8, 0.5],
      },
    });
  }

  /* ─── Live overlay sources + layers ─── */

  const emptyFc: any = { type: 'FeatureCollection', features: [] };

  if (!map.getSource(sources.waterMask)) {
    map.addSource(sources.waterMask, { type: 'geojson', data: emptyFc });
  }

  if (!map.getLayer(layers.waterMaskFill)) {
    map.addLayer({
      id: layers.waterMaskFill,
      type: 'fill',
      source: sources.waterMask,
      paint: {
        'fill-color': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'water_probability']], 0],
          0, 'rgba(25,211,218,0.06)',
          0.5, 'rgba(25,211,218,0.22)',
          1, 'rgba(25,211,218,0.44)',
        ],
        'fill-opacity': 0.7,
      },
      layout: { visibility: 'none' },
    });
  }

  if (!map.getSource(sources.vulnerability)) {
    map.addSource(sources.vulnerability, { type: 'geojson', data: emptyFc });
  }

  if (!map.getLayer(layers.vulnerabilityFill)) {
    map.addLayer({
      id: layers.vulnerabilityFill,
      type: 'fill',
      source: sources.vulnerability,
      paint: {
        'fill-color': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'vulnerability_score']], 0],
          0, '#1fa763',
          0.4, '#f2a838',
          0.65, '#f28c38',
          1, '#e63946',
        ],
        'fill-opacity': 0.55,
      },
      layout: { visibility: 'none' },
    });
  }
}

function updateSourceData(map: MapLibreMap, mapId: string, bundle: LayerBundle): void {
  const sources = mapSources(mapId);
  (map.getSource(sources.flood) as maplibregl.GeoJSONSource | undefined)?.setData(bundle.flood as any);
  (map.getSource(sources.priorities) as maplibregl.GeoJSONSource | undefined)?.setData(bundle.priorities as any);
  (map.getSource(sources.mangrove) as maplibregl.GeoJSONSource | undefined)?.setData(bundle.mangroveExtent as any);
  (map.getSource(sources.hotspots) as maplibregl.GeoJSONSource | undefined)?.setData(bundle.mangroveHotspots as any);
}

function updateOverlaySources(
  map: MapLibreMap,
  mapId: string,
  waterMask: FeatureCollection | null | undefined,
  vulnerability: FeatureCollection | null | undefined,
  toggles: LayerToggleState | undefined,
): void {
  const sources = mapSources(mapId);
  const layers = mapLayers(mapId);
  const emptyFc: any = { type: 'FeatureCollection', features: [] };

  if (waterMask) {
    (map.getSource(sources.waterMask) as maplibregl.GeoJSONSource | undefined)?.setData(waterMask as any);
  }
  if (vulnerability) {
    (map.getSource(sources.vulnerability) as maplibregl.GeoJSONSource | undefined)?.setData(vulnerability as any);
  }

  if (map.getLayer(layers.waterMaskFill)) {
    map.setLayoutProperty(layers.waterMaskFill, 'visibility', toggles?.sarWaterMask ? 'visible' : 'none');
  }
  if (map.getLayer(layers.vulnerabilityFill)) {
    map.setLayoutProperty(layers.vulnerabilityFill, 'visibility', toggles?.vulnerability ? 'visible' : 'none');
  }
}

function configureTerrain(map: MapLibreMap, mapId: string, terrainMode: boolean, stormIntensity: number): void {
  const sources = mapSources(mapId);
  const layers = mapLayers(mapId);

  if (!map.getSource(sources.dem)) {
    map.addSource(sources.dem, {
      type: 'raster-dem',
      tiles: ['/api/dem/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
    } as any);
  }

  const ensureExtrusion = (id: string, source: string, paint: any) => {
    if (!map.getLayer(id)) {
      map.addLayer({ id, type: 'fill-extrusion', source, paint });
    }
  };

  if (terrainMode) {
    map.setTerrain({ source: sources.dem, exaggeration: 1.8 });

    ensureExtrusion(layers.priorityExtrusion, sources.priorities, {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'priority_score']], 0],
        0,
        '#3b82f6',
        0.6,
        '#f59e0b',
        1,
        '#ef4444',
      ],
      'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'priority_score']], 0], 120],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.84,
    });
    map.setPaintProperty(layers.priorityExtrusion, 'fill-extrusion-height', [
      '*',
      ['coalesce', ['to-number', ['get', 'priority_score']], 0],
      120,
    ]);

    ensureExtrusion(layers.floodWaterExtrusion, sources.flood, {
      'fill-extrusion-color': '#60a5fa',
      'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'flood_likelihood']], 0], 28 * stormIntensity],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.45,
    });
    map.setPaintProperty(layers.floodWaterExtrusion, 'fill-extrusion-height', [
      '*',
      ['coalesce', ['to-number', ['get', 'flood_likelihood']], 0],
      28 * stormIntensity,
    ]);

    ensureExtrusion(layers.mangroveExtrusion, sources.mangrove, {
      'fill-extrusion-color': '#22c55e',
      'fill-extrusion-height': 5,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.58,
    });
    map.setPaintProperty(layers.mangroveExtrusion, 'fill-extrusion-height', 5);

    ensureExtrusion(layers.hotspotExtrusion, sources.hotspots, {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'severity']], 0],
        0,
        '#4ade80',
        0.5,
        '#f59e0b',
        1,
        '#dc2626',
      ],
      'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'severity']], 0], 80],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.87,
    });
    map.setPaintProperty(layers.hotspotExtrusion, 'fill-extrusion-height', [
      '*',
      ['coalesce', ['to-number', ['get', 'severity']], 0],
      80,
    ]);
  } else {
    map.setTerrain(null);
    [layers.hotspotExtrusion, layers.mangroveExtrusion, layers.floodWaterExtrusion, layers.priorityExtrusion].forEach((layer) => {
      if (map.getLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }
}

function applyLayerVisibility(map: MapLibreMap, mapId: string, scene: UIScene): void {
  const layers = mapLayers(mapId);
  const visibilityByScene: Record<UIScene, string[]> = {
    hero: [layers.floodFill, layers.floodOutline, layers.mangroveFill, layers.mangroveOutline],
    operational: [
      layers.floodFill,
      layers.floodOutline,
      layers.mangroveFill,
      layers.mangroveOutline,
      layers.urbanHeat,
      layers.hotspotCircle,
      layers.priorityOutline,
      layers.priorityHit,
    ],
    inspector: [
      layers.floodFill,
      layers.floodOutline,
      layers.mangroveFill,
      layers.mangroveOutline,
      layers.urbanHeat,
      layers.hotspotCircle,
      layers.priorityOutline,
      layers.priorityHit,
      layers.priorityHighlight,
    ],
    simulation: [layers.floodFill, layers.floodOutline, layers.mangroveFill, layers.mangroveOutline, layers.priorityOutline, layers.urbanHeat, layers.priorityHit],
    comparison: [layers.floodFill, layers.floodOutline, layers.mangroveFill, layers.mangroveOutline, layers.priorityOutline, layers.urbanHeat, layers.hotspotCircle, layers.priorityHit],
  };

  const active = new Set(visibilityByScene[scene]);
  Object.values(layers).forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', active.has(layerId) ? 'visible' : 'none');
    }
  });
}

function cameraPresetForZone(zoneId: string | null | undefined): CameraState | null {
  if (!zoneId) {
    return null;
  }
  const presetKey = Object.keys(HOTSPOT_CAMERA_PRESETS).find((key) => zoneId.startsWith(key));
  return presetKey ? HOTSPOT_CAMERA_PRESETS[presetKey] : null;
}

function MapViewport({
  mapId,
  title,
  bundle,
  scenario,
  scene,
  terrainMode,
  stormIntensity,
  selectedZoneId,
  selectedZone,
  onSelectZone,
  cameraState,
  cameraSource,
  onCameraChange,
  waterMaskGeoJson,
  vulnerabilityGeoJson,
  layerToggles,
}: MapViewportProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const isApplyingExternalCamera = useRef(false);
  const hoveredHotspotId = useRef<string | number | null>(null);
  const hotspotPulse = useRef({ value: 0 });
  const hotspotPulseTween = useRef<gsap.core.Tween | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const pointData = useMemo(() => toDataPoints(bundle), [bundle]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: cameraState.center,
      zoom: cameraState.zoom,
      pitch: cameraState.pitch,
      bearing: cameraState.bearing,
      maxPitch: 85,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      configureBaseMap(map, mapId, bundle);
      setMapLoaded(true);

      const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
      overlayRef.current = overlay;
      map.addControl(overlay as any);
    });

    map.on('moveend', () => {
      if (isApplyingExternalCamera.current) {
        return;
      }
      onCameraChange(mapId, {
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    const layers = mapLayers(mapId);
    const sources = mapSources(mapId);
    let hoverFrame: number | null = null;
    let queuedHoverEvent: MapPointerEvent | null = null;

    const applyHotspotHoverRadius = (hoverBoost: number) => {
      if (map.getLayer(layers.hotspotCircle)) {
        map.setPaintProperty(layers.hotspotCircle, 'circle-radius', hotspotRadiusExpression(hoverBoost));
      }
    };

    const clearHotspotState = () => {
      const currentHotspot = hoveredHotspotId.current;
      if (currentHotspot !== null && map.getSource(sources.hotspots)) {
        map.setFeatureState(
          {
            source: sources.hotspots,
            id: currentHotspot,
          },
          { hover: false }
        );
      }
      hoveredHotspotId.current = null;
    };

    const stopHotspotPulse = () => {
      hotspotPulseTween.current?.kill();
      hotspotPulseTween.current = null;
      hotspotPulse.current.value = 0;
      applyHotspotHoverRadius(0);
    };

    const startHotspotPulse = () => {
      if (hotspotPulseTween.current) {
        return;
      }

      hotspotPulse.current.value = 2.6;
      hotspotPulseTween.current = gsap.to(hotspotPulse.current, {
        value: 7.4,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        onUpdate: () => {
          applyHotspotHoverRadius(hotspotPulse.current.value);
        },
      });
    };

    const handleMouseMove = (event: MapPointerEvent) => {
      queuedHoverEvent = event;
      if (hoverFrame !== null) {
        return;
      }

      hoverFrame = window.requestAnimationFrame(() => {
        hoverFrame = null;
        const nextEvent = queuedHoverEvent;
        if (!nextEvent) {
          return;
        }

      const queryLayers = [layers.priorityHit, layers.floodFill, layers.hotspotCircle, layers.priorityExtrusion].filter((id) =>
        Boolean(map.getLayer(id))
      );
      const features = map.queryRenderedFeatures(nextEvent.point, {
        layers: queryLayers,
      });

      if (!features.length) {
        setTooltip(null);
        map.getCanvas().style.cursor = '';
        clearHotspotState();
        stopHotspotPulse();
        return;
      }

      map.getCanvas().style.cursor = 'pointer';
      const feature = features[0];
      const hotspotFeature = features.find((item) => item.layer.id === layers.hotspotCircle);

      if (hotspotFeature?.id !== undefined && map.getSource(sources.hotspots)) {
        if (hoveredHotspotId.current !== hotspotFeature.id) {
          clearHotspotState();
          map.setFeatureState(
            {
              source: sources.hotspots,
              id: hotspotFeature.id,
            },
            { hover: true }
          );
          hoveredHotspotId.current = hotspotFeature.id;
        }
        startHotspotPulse();
      } else {
        clearHotspotState();
        stopHotspotPulse();
      }

      setTooltip({
        x: nextEvent.point.x,
        y: nextEvent.point.y,
        title: String(feature.properties?.zone_name || feature.properties?.hotspot_name || 'Risk cell'),
        values: getTooltipPayload(feature),
      });
      });
    };

    const handleMouseLeave = () => {
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      queuedHoverEvent = null;
      setTooltip(null);
      map.getCanvas().style.cursor = '';
      clearHotspotState();
      stopHotspotPulse();
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);

    map.on('click', (event) => {
      const queryLayers = [layers.priorityHit, layers.priorityExtrusion].filter((id) => Boolean(map.getLayer(id)));
      const features = map.queryRenderedFeatures(event.point, {
        layers: queryLayers,
      });
      const selected = features[0];
      if (selected && selected.id) {
        onSelectZone(String(selected.id));
      }
    });

    return () => {
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
      }
      clearHotspotState();
      stopHotspotPulse();
      overlayRef.current?.finalize();
      overlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [bundle, cameraState.center, cameraState.zoom, cameraState.pitch, cameraState.bearing, mapId, onCameraChange, onSelectZone]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) {
      return;
    }

    updateSourceData(map, mapId, bundle);
  }, [mapLoaded, mapId, bundle]);

  // Live overlay data
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    updateOverlaySources(map, mapId, waterMaskGeoJson, vulnerabilityGeoJson, layerToggles);
  }, [mapLoaded, mapId, waterMaskGeoJson, vulnerabilityGeoJson, layerToggles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) {
      return;
    }

    const applyTerrain = () => {
      try {
        configureTerrain(map, mapId, terrainMode, stormIntensity);
      } catch {
        return;
      }
    };

    if (!map.isStyleLoaded()) {
      map.once('styledata', applyTerrain);
      return () => {
        map.off('styledata', applyTerrain);
      };
    }

    applyTerrain();

    if (terrainMode) {
      map.easeTo({ pitch: 58, bearing: -24, duration: 800 });
    } else {
      map.easeTo({ pitch: 30, bearing: -8, duration: 800 });
    }
  }, [mapLoaded, mapId, terrainMode, stormIntensity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) {
      return;
    }

    applyLayerVisibility(map, mapId, scene);
    const preset = SCENE_CAMERA_PRESETS[scene];
    if (preset) {
      map.easeTo({
        center: preset.center,
        zoom: preset.zoom,
        pitch: terrainMode ? Math.max(preset.pitch, 42) : preset.pitch,
        bearing: preset.bearing,
        duration: 900,
      });
    }
  }, [mapLoaded, mapId, scene, terrainMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) {
      return;
    }

    const layers = mapLayers(mapId);
    setZoneHighlight(map, layers.priorityHighlight, selectedZoneId);

    if (selectedZone) {
      const zonePreset = cameraPresetForZone(selectedZoneId);
      if (zonePreset) {
        map.flyTo({
          center: zonePreset.center,
          zoom: zonePreset.zoom,
          pitch: zonePreset.pitch,
          bearing: zonePreset.bearing,
          duration: 900,
        });
      } else {
        map.flyTo({ center: selectedZone.centroid, duration: 900, zoom: Math.max(map.getZoom(), 13.2) });
      }
    }
  }, [mapLoaded, mapId, selectedZoneId, selectedZone]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || cameraSource === mapId) {
      return;
    }

    isApplyingExternalCamera.current = true;
    map.jumpTo({
      center: cameraState.center,
      zoom: cameraState.zoom,
      pitch: cameraState.pitch,
      bearing: cameraState.bearing,
    });

    const timeout = window.setTimeout(() => {
      isApplyingExternalCamera.current = false;
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [cameraSource, cameraState, mapLoaded, mapId]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) {
      return;
    }

    const layers = mapLayers(mapId);
    const map = mapRef.current;

    if (!isVisible || !map) {
      if (map?.getLayer(layers.floodFill)) {
        map.setPaintProperty(layers.floodFill, 'fill-opacity', 0.24);
      }
      return;
    }

    let phase = 0;
    const interval = window.setInterval(() => {
      const activeMap = mapRef.current;
      if (!activeMap || document.hidden) {
        return;
      }

      phase += 0.28;
      const floodOpacity = 0.2 + ((Math.sin(phase * 0.7) + 1) / 2) * (0.34 + stormIntensity * 0.08);

      if (activeMap.getLayer(layers.floodFill)) {
        activeMap.setPaintProperty(layers.floodFill, 'fill-opacity', floodOpacity);
      }
    }, 90);

    return () => {
      window.clearInterval(interval);
      const activeMap = mapRef.current;
      if (!activeMap) {
        return;
      }
      if (activeMap.getLayer(layers.floodFill)) {
        activeMap.setPaintProperty(layers.floodFill, 'fill-opacity', 0.24);
      }
    };
  }, [isVisible, mapLoaded, mapId, stormIntensity]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !mapLoaded) {
      return;
    }

    overlay.setProps({
      layers: [
        new HeatmapLayer<DataPoint>({
          id: `${mapId}-flood-heatmap`,
          data: pointData.flood,
          getPosition: (d) => d.position,
          getWeight: (d) => d.weight * stormIntensity,
          radiusPixels: terrainMode ? 54 : 42,
          intensity: 1.2,
          threshold: 0.04,
          colorRange: [
            [11, 52, 109, 30],
            [35, 89, 167, 90],
            [70, 130, 180, 150],
            [129, 191, 255, 185],
            [191, 225, 255, 220],
            [224, 242, 255, 245],
          ],
        }),
        new ScatterplotLayer<DataPoint>({
          id: `${mapId}-urban-scatter`,
          data: pointData.urban,
          getPosition: (d) => d.position,
          getRadius: (d) => 55 + (d.weight * 120),
          radiusUnits: 'meters',
          getFillColor: (d) => [250, 130, 20, Math.round(100 + (d.weight * 120))],
          opacity: 0.35,
          pickable: false,
        }),
        new ColumnLayer<DataPoint>({
          id: `${mapId}-hotspot-columns`,
          data: pointData.hotspots,
          getPosition: (d) => d.position,
          getFillColor: (d) => [
            20 + Math.round(d.weight * 220),
            240 - Math.round(d.weight * 120),
            85,
            190,
          ],
          radius: 46,
          getElevation: (d) => d.weight * 1600 * (terrainMode ? 1 : 0.4),
          elevationScale: terrainMode ? 1 : 0.2,
          extruded: true,
          pickable: false,
        }),
      ],
    });
  }, [mapId, mapLoaded, pointData, stormIntensity, terrainMode]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700/40">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-500/45 bg-black/55 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-200">
        {title} | {scenario.label}
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-20 min-w-[170px] rounded-md border border-slate-600/75 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="mb-1 text-xs font-semibold text-cyan-300">{tooltip.title}</div>
          <div className="space-y-0.5">
            {tooltip.values.map((item) => (
              <div key={item.label} className="flex justify-between gap-4">
                <span className="text-slate-400">{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface IntelligenceMapProps {
  bundle: LayerBundle;
  compareBundle: LayerBundle;
  scenario: ScenarioConfig;
  compareScenario: ScenarioConfig;
  scene: UIScene;
  terrainMode: boolean;
  comparisonMode: boolean;
  stormIntensity: number;
  selectedZoneId: string | null;
  selectedZone: ZoneInspection | null;
  onSelectZone: (id: string) => void;
  waterMaskGeoJson?: FeatureCollection | null;
  vulnerabilityGeoJson?: FeatureCollection | null;
  layerToggles?: LayerToggleState;
}

export function IntelligenceMap({
  bundle,
  compareBundle,
  scenario,
  compareScenario,
  scene,
  terrainMode,
  comparisonMode,
  stormIntensity,
  selectedZoneId,
  selectedZone,
  onSelectZone,
  waterMaskGeoJson,
  vulnerabilityGeoJson,
  layerToggles,
}: IntelligenceMapProps): JSX.Element {
  const [cameraState, setCameraState] = useState<CameraState>(DEFAULT_CAMERA);
  const [cameraSource, setCameraSource] = useState('primary');

  const handleCameraChange = (source: string, camera: CameraState): void => {
    setCameraSource(source);
    setCameraState(camera);
  };

  const handleResetCamera = (): void => {
    setCameraSource('reset');
    setCameraState(DEFAULT_CAMERA);
  };

  return (
    <section className="relative h-full rounded-xl border border-slate-700/40 bg-panel shadow-panel">
      <button
        type="button"
        onClick={handleResetCamera}
        className="absolute right-3 top-3 z-30 rounded-lg border border-slate-500/65 bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-cyan-400/70 hover:text-cyan-200"
      >
        Reset Camera
      </button>

      {comparisonMode ? (
        <div className="grid h-full grid-cols-2 gap-1 p-1">
          <MapViewport
            mapId="primary"
            title="Baseline"
            bundle={bundle}
            scenario={scenario}
            scene={scene}
            terrainMode={terrainMode}
            stormIntensity={stormIntensity}
            selectedZoneId={selectedZoneId}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            cameraState={cameraState}
            cameraSource={cameraSource}
            onCameraChange={handleCameraChange}
          />
          <MapViewport
            mapId="comparison"
            title="Comparison"
            bundle={compareBundle}
            scenario={compareScenario}
            scene={scene}
            terrainMode={terrainMode}
            stormIntensity={stormIntensity}
            selectedZoneId={selectedZoneId}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            cameraState={cameraState}
            cameraSource={cameraSource}
            onCameraChange={handleCameraChange}
          />
          <div className="pointer-events-none absolute inset-y-1 left-1/2 w-[2px] -translate-x-1/2 bg-cyan-400/45" />
        </div>
      ) : (
        <div className="h-full p-1">
          <MapViewport
            mapId="primary"
            title="Operational View"
            bundle={bundle}
            scenario={scenario}
            scene={scene}
            terrainMode={terrainMode}
            stormIntensity={stormIntensity}
            selectedZoneId={selectedZoneId}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            cameraState={cameraState}
            cameraSource={cameraSource}
            onCameraChange={handleCameraChange}
            waterMaskGeoJson={waterMaskGeoJson}
            vulnerabilityGeoJson={vulnerabilityGeoJson}
            layerToggles={layerToggles}
          />
        </div>
      )}
    </section>
  );
}
