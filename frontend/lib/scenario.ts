import type {
  FloodCollection,
  FloodFeature,
  HotspotCollection,
  HotspotFeature,
  LayerBundle,
  MangroveCollection,
  MangroveFeature,
  PriorityCollection,
  PriorityFeature,
  ScenarioConfig,
} from '@/types/geospatial';

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function scalePriorityFeature(
  feature: PriorityFeature,
  scenario: ScenarioConfig,
  stormIntensity: number,
  restorationEnabled: boolean
): PriorityFeature {
  const properties = { ...feature.properties };
  const restorationBonus = restorationEnabled ? 0.92 : 1;
  const stormFactor = 0.75 + stormIntensity * 0.5;

  const floodLikelihood = Number(properties.flood_likelihood || 0);
  const exposure = Number(properties.exposure || 0);
  const mangroveHealth = Number(properties.mangrove_health || 0);

  properties.flood_likelihood = clamp(floodLikelihood * scenario.floodFactor * stormFactor * restorationBonus);
  properties.exposure = clamp(exposure * scenario.exposureFactor);
  properties.mangrove_health = clamp(mangroveHealth * scenario.mangroveFactor * (restorationEnabled ? 1.06 : 1));

  const priorityScore = (0.45 * Number(properties.flood_likelihood)) + (0.35 * Number(properties.exposure)) + (0.2 * (1 - Number(properties.mangrove_health)));
  properties.priority_score = clamp(Number(priorityScore.toFixed(4)));

  return {
    ...feature,
    properties,
  };
}

function scaleFloodFeature(
  feature: FloodFeature,
  scenario: ScenarioConfig,
  stormIntensity: number,
  restorationEnabled: boolean
): FloodFeature {
  const properties = { ...feature.properties };
  const floodLikelihood = Number(properties.flood_likelihood || 0);
  const pressure = stormIntensity * scenario.floodFactor * (restorationEnabled ? 0.92 : 1);
  properties.flood_likelihood = clamp(floodLikelihood * (0.7 + pressure));
  properties.priority_score = clamp((Number(properties.priority_score || 0) + Number(properties.flood_likelihood)) / 2);

  return {
    ...feature,
    properties,
  };
}

function scaleMangroveFeature(feature: MangroveFeature, scenario: ScenarioConfig, restorationEnabled: boolean): MangroveFeature {
  const properties = { ...feature.properties };
  const health = Number(properties.mangrove_health || 0);
  properties.mangrove_health = clamp(health * scenario.mangroveFactor * (restorationEnabled ? 1.08 : 1));
  return {
    ...feature,
    properties,
  };
}

function scaleHotspotFeature(feature: HotspotFeature, scenario: ScenarioConfig, restorationEnabled: boolean): HotspotFeature {
  const properties = { ...feature.properties };
  const severity = Number(properties.severity || 0);
  const multiplier = scenario.floodFactor * (restorationEnabled ? 0.85 : 1);
  properties.severity = clamp(severity * multiplier);
  return {
    ...feature,
    properties,
  };
}

export function applyScenario(
  bundle: LayerBundle,
  scenario: ScenarioConfig,
  stormIntensity: number,
  restorationEnabled: boolean
): LayerBundle {
  const priorities: PriorityCollection = {
    ...bundle.priorities,
    features: bundle.priorities.features.map((feature) =>
      scalePriorityFeature(feature, scenario, stormIntensity, restorationEnabled)
    ),
  };

  const flood: FloodCollection = {
    ...bundle.flood,
    features: bundle.flood.features.map((feature) =>
      scaleFloodFeature(feature, scenario, stormIntensity, restorationEnabled)
    ),
  };

  const mangroveExtent: MangroveCollection = {
    ...bundle.mangroveExtent,
    features: bundle.mangroveExtent.features.map((feature) =>
      scaleMangroveFeature(feature, scenario, restorationEnabled)
    ),
  };

  const mangroveHotspots: HotspotCollection = {
    ...bundle.mangroveHotspots,
    features: bundle.mangroveHotspots.features.map((feature) =>
      scaleHotspotFeature(feature, scenario, restorationEnabled)
    ),
  };

  return {
    flood,
    priorities,
    mangroveExtent,
    mangroveHotspots,
  };
}
