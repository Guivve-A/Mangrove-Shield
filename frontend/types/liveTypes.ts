import type { FeatureCollection, Polygon } from 'geojson';

/* ═══ SAR Water Mask ═══ */

export interface SarWaterMaskCellProps {
    row: number;
    col: number;
    zone_id: string;
    zone_name: string;
    zone_type: string;
    backscatter_db: number;
    threshold_db: number;
    water_probability: number;
    is_water: boolean;
}

export interface SarWaterMaskResponse {
    data_mode: string;
    bbox: number[];
    date: string;
    scene: {
        scene_id: string;
        acquired_at: string;
        orbit_pass: string;
        polarization: string;
    };
    stats: {
        mangrove_cells: number;
        water_cells: number;
        water_extent_ratio: number;
    };
    geometry: FeatureCollection<Polygon, SarWaterMaskCellProps>;
    analysis_grid: FeatureCollection<Polygon, SarWaterMaskCellProps>;
}

/* ═══ Weather ═══ */

export interface WeatherNow {
    rain_mm_h: number;
    wind_kph: number;
    humidity_pct: number;
    temperature_c: number;
}

export interface WeatherProxies {
    rain_intensity: number;
    soil_saturation_proxy: number;
    tidal_stage_proxy: number;
}

export interface WeatherNowResponse {
    data_mode: string;
    source: string;
    timestamp: string;
    coordinates: { lat: number; lon: number };
    region: { id: string; name: string };
    weather_now: WeatherNow;
    proxies: WeatherProxies;
}

/* ═══ Vulnerability ═══ */

export interface VulnerabilityCellProps {
    row: number;
    col: number;
    zone_id: string;
    zone_name: string;
    zone_type: string;
    backscatter_db: number;
    threshold_db: number;
    water_probability: number;
    is_water: boolean;
    vulnerability_score: number;
    vulnerability_level: 'low' | 'moderate' | 'high' | 'critical';
}

export interface VulnerabilityDrivers {
    rain_intensity: number;
    soil_saturation_proxy: number;
    tidal_stage_proxy: number;
    sar_water_extent: number;
    wind_exposure: number;
}

export interface VulnerabilityNowResponse {
    bbox: number[];
    date: string;
    vulnerability_index: number;
    vulnerability_index_100: number;
    level: 'low' | 'moderate' | 'high' | 'critical';
    drivers: VulnerabilityDrivers;
    sar_context: {
        scene_id: string;
        acquired_at: string;
        water_cells: number;
        mangrove_cells: number;
    };
    weather_context: WeatherNowResponse;
    geometry: FeatureCollection<Polygon, VulnerabilityCellProps>;
}

/* ═══ Ecosystem Health ═══ */

export interface EcosystemAlert {
    zone_id: string;
    zone_name: string;
    alert_type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

export interface EcosystemZoneSummary {
    zone_id: string;
    zone_name: string;
    health_index: number;
    classification: string;
    ndvi: number;
    canopy_cover: number;
    fragmentation: number;
}

export interface EcosystemHealthResponse {
    bbox: number[];
    date: string;
    health_index: number;
    classification: string;
    trend: 'improving' | 'stable' | 'declining';
    components: {
        ndvi_mean: number;
        canopy_cover: number | null;
        fragmentation_index: number | null;
        species_diversity: number | string;
        water_quality: number | string;
    };
    zone_summaries: EcosystemZoneSummary[];
    alerts: EcosystemAlert[];
    model: {
        model_id: string;
        version: string;
    };
}

/* ═══ Ecosystem Timeseries ═══ */

export interface EcosystemTimeseriesPoint {
    date: string;
    health_index: number;
    ndvi_mean: number;
    canopy_cover: number;
    fragmentation_index: number;
}

export interface EcosystemZoneTimeseries {
    zone_id: string;
    zone_name: string;
    series: EcosystemTimeseriesPoint[];
}

export interface EcosystemTimeseriesResponse {
    bbox: number[];
    from: string;
    to: string;
    timeseries: EcosystemTimeseriesPoint[];
    zone_series: EcosystemZoneTimeseries[];
}

/* ═══ Ecosystem Anomalies ═══ */

export interface EcosystemAnomaly {
    id: string;
    date: string;
    zone_id: string;
    zone_name: string;
    anomaly_type: string;
    severity: 'warning' | 'critical';
    metric: string;
    observed_value: number;
    expected_range: [number, number];
    deviation_sigma: number;
    description: string;
    location: { lat: number; lon: number };
}

export interface EcosystemAnomaliesResponse {
    bbox: number[];
    from: string;
    to: string;
    anomalies: EcosystemAnomaly[];
}

/* ═══ Polling State ═══ */

export interface PollingState<T> {
    data: T | null;
    error: string | null;
    isLoading: boolean;
    isFallback: boolean;
}

export interface LiveDataState {
    weather: PollingState<WeatherNowResponse>;
    vulnerability: PollingState<VulnerabilityNowResponse>;
    waterMask: PollingState<SarWaterMaskResponse>;
    ecosystemHealth: PollingState<EcosystemHealthResponse>;
    ecosystemTimeseries: PollingState<EcosystemTimeseriesResponse>;
    anomalies: PollingState<EcosystemAnomaliesResponse>;
}

/* ═══ Unified Flood Status (Local) ═══ */

export interface FloodStatusResponse {
    timestamp: string;
    weather: {
        weather_now: WeatherNow;
        source: string;
        timestamp: string;
        error: string | null;
    };
    tide: {
        level_m: number | null;
        error: string | null;
    };
    sar_data: {
        tile_url: string | null;
        date_acquired: string | null;
        flood_anomaly_fraction: number;
        error: string | null;
    };
    ecosystem_health: EcosystemHealthResponse;
    risk_assessment: {
        level: string;
        score: number | null;
        drivers: any[];
    };
}
