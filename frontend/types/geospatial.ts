import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type GeometryType = Polygon | MultiPolygon;

export interface BaseProperties {
  date?: string;
  [key: string]: unknown;
}

export type GenericFeature = Feature<GeometryType, BaseProperties>;
export type GenericCollection = FeatureCollection<GeometryType, BaseProperties>;

export interface FloodProperties extends BaseProperties {
  flood_likelihood?: number;
  exposure?: number;
  mangrove_health?: number;
  priority_score?: number;
}

export interface PriorityProperties extends BaseProperties {
  zone_name?: string;
  flood_likelihood?: number;
  exposure?: number;
  mangrove_health?: number;
  priority_score?: number;
}

export interface MangroveProperties extends BaseProperties {
  mangrove_health?: number;
  status?: string;
}

export interface HotspotProperties extends BaseProperties {
  severity?: number;
  mangrove_health?: number;
}

export type FloodFeature = Feature<GeometryType, FloodProperties>;
export type PriorityFeature = Feature<GeometryType, PriorityProperties>;
export type MangroveFeature = Feature<GeometryType, MangroveProperties>;
export type HotspotFeature = Feature<GeometryType, HotspotProperties>;

export type FloodCollection = FeatureCollection<GeometryType, FloodProperties>;
export type PriorityCollection = FeatureCollection<GeometryType, PriorityProperties>;
export type MangroveCollection = FeatureCollection<GeometryType, MangroveProperties>;
export type HotspotCollection = FeatureCollection<GeometryType, HotspotProperties>;

export interface LayerBundle {
  flood: FloodCollection;
  priorities: PriorityCollection;
  mangroveExtent: MangroveCollection;
  mangroveHotspots: HotspotCollection;
}

export type ScenarioKey = 'healthy' | 'current' | 'degraded' | 'restoration';

export interface ScenarioConfig {
  key: ScenarioKey;
  label: string;
  floodFactor: number;
  mangroveFactor: number;
  exposureFactor: number;
}

export interface TopZoneRecord {
  id: string;
  zoneName: string;
  floodProbability: number;
  urbanExposure: number;
  distanceToMangrovesKm: number;
  vulnerability: number;
  centroid: [number, number];
}

export interface IntelligenceMetrics {
  regionName: string;
  floodRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  floodRiskIndex: number;
  mangroveHealthIndex: number;
  rainfall72h: number;
  criticalZones: number;
  urbanExposure: number;
  mangroveCoverage: number;
  exposedPopulation: number;
  criticalInfrastructure: number;
}

export interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  timestamp: string;
  zoneId?: string;
}

export type UIScene = 'hero' | 'operational' | 'inspector' | 'simulation' | 'comparison';

export interface TimeSeriesPoint {
  date: string;
  floodRisk: number;
  mangroveHealth: number;
  rainfall: number;
  floodAreaProxy: number;
}

export interface ZoneInspection {
  id: string;
  zoneName: string;
  floodProbability: number;
  urbanExposure: number;
  mangroveHealth: number;
  priorityScore: number;
  distanceToMangrovesKm: number;
  centroid: [number, number];
}

export interface CameraState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}
