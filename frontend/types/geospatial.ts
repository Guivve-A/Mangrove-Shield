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

// Mangrove historical change (GMW v3.0 timeline)

export interface MangroveYearRecord {
  year: number;
  total_ha: number;
  loss_ha: number;
  gain_ha: number;
  delta_ha: number;
  loss_rate_pct: number;
}

// Mangrove health indices (Sentinel-2 NDVI / NASA AGB)

export interface MunicipalityHealth {
  name: string;
  ndvi: number;
  ndwi: number;
  agb_mg_ha: number;
  canopy_height_m: number;
  annual_delta: number;
  status: string;
  level: 'healthy' | 'moderate' | 'degraded' | 'critical';
  color: string;
}

export interface HealthSummaryResponse {
  period: string;
  global_health_pct: number;
  ndvi_mean: number;
  ndwi_mean: number;
  classification: { status: string; level: string; color: string };
  distribution: { healthy: number; moderate: number; degraded: number; critical: number };
  municipalities: MunicipalityHealth[];
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
}

export interface HealthTimeseriesResponse {
  municipalities: string[];
  months: string[];
  series: Record<string, number[]>;
  regional_mean: number[];
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
}

// Flood events and mangrove-flood spatial correlation (Copernicus EMS + INAMHI + SAR)

export interface FloodEvent {
  id: string;
  date: string;
  year: number;
  month: number;
  label: string;
  rain_mm_day: number;
  tide_level_m: number;
  affected_people: number;
  damage_usd_m: number;
  flood_area_ha: number;
  severity: 'moderate' | 'severe' | 'extreme';
  description: string;
  correlation_pct: number;
  source: string;
}

export interface FloodEventsResponse {
  bbox: [number, number, number, number];
  year_from: number;
  year_to: number;
  severity_filter: string;
  total_events: number;
  total_affected_people: number;
  total_flood_area_ha: number;
  events: FloodEvent[];
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
}

export interface CorrelationCellProperties {
  cell_id: string;
  loss_ha: number;
  flood_frequency: number;
  mangrove_cover: number;
  correlation_index: number;
  risk_category: 'critical' | 'high' | 'moderate' | 'low';
}

export interface FloodCorrelationResponse {
  type: 'FeatureCollection';
  metadata: {
    bbox: [number, number, number, number];
    cells_total: number;
    cells_critical: number;
    cells_high: number;
    methodology: string;
    sources: string[];
  };
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: number[][][] };
    properties: CorrelationCellProperties;
  }>;
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
}

export interface MangroveTimelineResponse {
  bbox: [number, number, number, number];
  years: number[];
  summary: {
    total_loss_ha: number;
    total_gain_ha: number;
    net_change_ha: number;
  };
  records: MangroveYearRecord[];
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
  source_detail?: string;
}

export interface MangroveTilesResponse {
  bbox: [number, number, number, number];
  year: number;
  compare_to_year: number | null;
  compare_mode: 'prev' | 'baseline' | 'none';
  tiles: {
    before: string | null;
    after: string | null;
    change: string | null;
  };
  cache_ttl_s?: number;
  _source?: 'firestore' | 'api' | 'calibrated_estimate';
  source_detail?: string;
}
