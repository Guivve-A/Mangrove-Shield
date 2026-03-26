import centroid from '@turf/centroid';
import distance from '@turf/distance';

import type {
  LayerBundle,
  PriorityFeature,
  TopZoneRecord,
  ZoneInspection,
} from '@/types/geospatial';

function toNumber(value: unknown, fallback = 0): number {
  const cast = Number(value);
  return Number.isFinite(cast) ? cast : fallback;
}

function featureCentroid(feature: PriorityFeature): [number, number] {
  const center = centroid(feature as any);
  return [Number(center.geometry.coordinates[0]), Number(center.geometry.coordinates[1])];
}

function nearestMangroveDistanceKm(point: [number, number], bundle: LayerBundle): number {
  if (!bundle.mangroveExtent.features.length) {
    return 0;
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (const mangroveFeature of bundle.mangroveExtent.features) {
    const mangroveCenter = centroid(mangroveFeature as any);
    const km = distance(
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: {},
      } as any,
      mangroveCenter as any,
      { units: 'kilometers' }
    );
    if (km < minDistance) {
      minDistance = km;
    }
  }

  return Number(minDistance.toFixed(2));
}

export function extractTopZones(bundle: LayerBundle, count = 5): TopZoneRecord[] {
  const zones = bundle.priorities.features.map((feature) => {
    const properties = feature.properties || {};
    const floodProbability = toNumber(properties.flood_likelihood);
    const urbanExposure = toNumber(properties.exposure);
    const priorityScore = toNumber(properties.priority_score);
    const center = featureCentroid(feature);
    const distanceToMangrovesKm = nearestMangroveDistanceKm(center, bundle);

    const vulnerability = Number((0.55 * priorityScore + 0.3 * floodProbability + 0.15 * urbanExposure).toFixed(4));

    return {
      id: String(feature.id || `${properties.zone_name || 'zone'}-${properties.date || 'na'}`),
      zoneName: String(properties.zone_name || 'Unnamed zone'),
      floodProbability,
      urbanExposure,
      distanceToMangrovesKm,
      vulnerability,
      centroid: center,
    } satisfies TopZoneRecord;
  });

  return zones.sort((a, b) => b.vulnerability - a.vulnerability).slice(0, count);
}

export function inspectZone(bundle: LayerBundle, zoneId?: string | null): ZoneInspection | null {
  if (!zoneId) {
    return null;
  }

  const feature = bundle.priorities.features.find((item) => String(item.id) === zoneId);
  if (!feature) {
    return null;
  }

  const props = feature.properties || {};
  const center = featureCentroid(feature);

  return {
    id: String(feature.id),
    zoneName: String(props.zone_name || 'Unnamed zone'),
    floodProbability: toNumber(props.flood_likelihood),
    urbanExposure: toNumber(props.exposure),
    mangroveHealth: toNumber(props.mangrove_health),
    priorityScore: toNumber(props.priority_score),
    distanceToMangrovesKm: nearestMangroveDistanceKm(center, bundle),
    centroid: center,
  };
}

export function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}
