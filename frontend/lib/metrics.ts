import type {
  AlertItem,
  IntelligenceMetrics,
  LayerBundle,
  ScenarioConfig,
  TimeSeriesPoint,
  TopZoneRecord,
} from '@/types/geospatial';
import { RAINFALL_BASELINE } from '@/lib/constants';
import { mean } from '@/lib/geo';
import { GUAYAQUIL_HOTSPOTS, GUAYAQUIL_KPI_TIMELINE } from '@/lib/mockData';

function getSnapshot(date: string) {
  return GUAYAQUIL_KPI_TIMELINE.find((entry) => entry.date === date) || GUAYAQUIL_KPI_TIMELINE[0];
}

function getRainfall72h(date: string, stormIntensity: number, scenario: ScenarioConfig): number {
  const snapshot = getSnapshot(date);
  const base = RAINFALL_BASELINE[date] ?? snapshot.rainfall72h ?? 165;
  const value = base * (0.76 + stormIntensity * scenario.floodFactor * 0.5);
  return Number(value.toFixed(1));
}

function classifyRisk(index: number): IntelligenceMetrics['floodRiskLevel'] {
  if (index >= 0.82) {
    return 'CRITICAL';
  }
  if (index >= 0.65) {
    return 'HIGH';
  }
  if (index >= 0.45) {
    return 'MODERATE';
  }
  return 'LOW';
}

export function computeMetrics(
  bundle: LayerBundle,
  date: string,
  scenario: ScenarioConfig,
  stormIntensity: number,
  topZones: TopZoneRecord[]
): IntelligenceMetrics {
  const floodProbabilities = bundle.priorities.features.map((feature) => Number(feature.properties?.flood_likelihood || 0));
  const mangroveHealth = bundle.mangroveExtent.features.map((feature) => Number(feature.properties?.mangrove_health || 0));
  const exposure = bundle.priorities.features.map((feature) => Number(feature.properties?.exposure || 0));

  const floodRiskIndex = Number(mean(floodProbabilities).toFixed(3));
  const mangroveHealthIndex = Number(mean(mangroveHealth).toFixed(3));
  const urbanExposure = Number(mean(exposure).toFixed(3));
  const snapshot = getSnapshot(date);

  const criticalZones = topZones.filter((zone) => zone.vulnerability >= 0.68).length;
  const mangroveCoverage = Number(
    (bundle.mangroveExtent.features.length * 0.26 + mangroveHealthIndex * 0.5 + (snapshot.mangroveCoveragePct / 100) * 0.24).toFixed(3)
  );
  const calibratedFloodRisk = Number((floodRiskIndex * 0.74 + snapshot.floodRiskIndex * 0.26).toFixed(3));
  const exposedPopulation = Math.round(snapshot.exposedPopulation * (0.78 + stormIntensity * scenario.exposureFactor * 0.35));
  const criticalInfrastructure = Math.round(
    snapshot.criticalInfrastructure * (0.82 + stormIntensity * scenario.floodFactor * 0.24)
  );

  return {
    regionName: 'Greater Guayaquil Estuary, Ecuador',
    floodRiskLevel: classifyRisk(calibratedFloodRisk),
    floodRiskIndex: calibratedFloodRisk,
    mangroveHealthIndex,
    rainfall72h: getRainfall72h(date, stormIntensity, scenario),
    criticalZones,
    urbanExposure,
    mangroveCoverage,
    exposedPopulation,
    criticalInfrastructure,
  };
}

export function computeTimeSeries(
  dates: string[],
  bundlesByDate: Record<string, LayerBundle>,
  scenario: ScenarioConfig,
  stormIntensity: number
): TimeSeriesPoint[] {
  return dates.map((date) => {
    const bundle = bundlesByDate[date];
    if (!bundle) {
      return {
        date,
        floodRisk: 0,
        mangroveHealth: 0,
        rainfall: 0,
        floodAreaProxy: 0,
      };
    }

    const flood = mean(bundle.priorities.features.map((feature) => Number(feature.properties?.flood_likelihood || 0)));
    const mangrove = mean(bundle.mangroveExtent.features.map((feature) => Number(feature.properties?.mangrove_health || 0)));
    const rainfall = getRainfall72h(date, stormIntensity, scenario);
    const floodAreaProxy = Number((bundle.flood.features.length * flood * scenario.floodFactor).toFixed(3));

    return {
      date,
      floodRisk: Number(flood.toFixed(3)),
      mangroveHealth: Number(mangrove.toFixed(3)),
      rainfall,
      floodAreaProxy,
    };
  });
}

export function buildAlerts(
  metrics: IntelligenceMetrics,
  topZones: TopZoneRecord[],
  scenario: ScenarioConfig,
  restorationEnabled: boolean,
  selectedDate: string
): AlertItem[] {
  const now = `${selectedDate || '2026-01-01'}T00:00:00.000Z`;
  const alerts: AlertItem[] = [];

  if (metrics.floodRiskLevel === 'HIGH' || metrics.floodRiskLevel === 'CRITICAL') {
    const dominantZone = topZones[0];
    alerts.push({
      id: 'alert-flood-1',
      severity: 'critical',
      title: 'Flood probability increase detected',
      detail: `Greater Guayaquil risk index at ${Math.round(metrics.floodRiskIndex * 100)}% under ${scenario.label}.`,
      timestamp: now,
      zoneId: dominantZone?.id,
    });
  }

  if (metrics.mangroveHealthIndex < 0.6 && !restorationEnabled) {
    alerts.push({
      id: 'alert-mangrove-1',
      severity: 'warning',
      title: 'Mangrove degradation detected',
      detail: 'Guayaquil estuary mangrove health index below 0.60. Restoration switch recommended.',
      timestamp: now,
    });
  }

  const nearMangroves = topZones.find((zone) => zone.distanceToMangrovesKm < 1.5);
  if (nearMangroves) {
    alerts.push({
      id: 'alert-urban-1',
      severity: 'warning',
      title: 'Urban expansion near mangrove buffer',
      detail: `${nearMangroves.zoneName} is within ${nearMangroves.distanceToMangrovesKm} km of mangrove edge.`,
      timestamp: now,
      zoneId: nearMangroves.id,
    });
  }

  const dominantHotspot = [...GUAYAQUIL_HOTSPOTS].sort((a, b) => b.severity - a.severity)[0];
  if (dominantHotspot && metrics.floodRiskLevel !== 'LOW') {
    alerts.push({
      id: `alert-hotspot-${dominantHotspot.id}`,
      severity: metrics.floodRiskLevel === 'CRITICAL' ? 'critical' : 'warning',
      title: 'Mangrove stress hotspot escalation',
      detail: `${dominantHotspot.name} (${dominantHotspot.area}) severity tracked at ${Math.round(dominantHotspot.severity * 100)}%.`,
      timestamp: now,
      zoneId: topZones[0]?.id,
    });
  }

  if (!alerts.length) {
    alerts.push({
      id: 'alert-info-1',
      severity: 'info',
      title: 'No high-risk shifts detected',
      detail: 'Indicators are stable for the selected Greater Guayaquil time window.',
      timestamp: now,
    });
  }

  return alerts;
}
