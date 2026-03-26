import { useCallback } from 'react';

import { usePolling } from '@/hooks/usePolling';
import {
    fetchEcosystemAnomalies,
    fetchEcosystemHealth,
    fetchEcosystemTimeseries,
    fetchSarWaterMask,
    fetchVulnerabilityNow,
    fetchWeatherNow,
} from '@/lib/liveApi';
import type {
    EcosystemAnomaliesResponse,
    EcosystemHealthResponse,
    EcosystemTimeseriesResponse,
    PollingState,
    SarWaterMaskResponse,
    VulnerabilityNowResponse,
    WeatherNowResponse,
} from '@/types/liveTypes';

/* Polling intervals (ms) - optimized for battery/bandwidth */
const INTERVAL_WEATHER = 5 * 60 * 1000;       // 5 min (was 2min, weather changes slowly)
const INTERVAL_VULNERABILITY = 10 * 60 * 1000;  // 10 min (was 3min, composite metric)
const INTERVAL_SAR = 30 * 60 * 1000;           // 30 min (was 15min, SAR scenes infrequent)
const INTERVAL_ECOSYSTEM = 60 * 60 * 1000;     // 60 min (was 30min, health metric changes slowly)

/* Cache TTL (ms) - shorter than intervals to allow fresh data pickup */
const CACHE_WEATHER = 4 * 60 * 1000;       // 4 min (just under 5min interval)
const CACHE_VULNERABILITY = 9 * 60 * 1000; // 9 min (just under 10min interval)
const CACHE_SAR = 25 * 60 * 1000;         // 25 min (just under 30min interval)
const CACHE_ECOSYSTEM = 55 * 60 * 1000;   // 55 min (just under 60min interval)

export interface LiveData {
    weather: PollingState<WeatherNowResponse>;
    vulnerability: PollingState<VulnerabilityNowResponse>;
    waterMask: PollingState<SarWaterMaskResponse>;
    ecosystemHealth: PollingState<EcosystemHealthResponse>;
    ecosystemTimeseries: PollingState<EcosystemTimeseriesResponse>;
    anomalies: PollingState<EcosystemAnomaliesResponse>;
}

export function useLiveData(enabled = true): LiveData {
    const weatherFetcher = useCallback(() => fetchWeatherNow(), []);
    const vulnerabilityFetcher = useCallback(() => fetchVulnerabilityNow(), []);
    const sarFetcher = useCallback(() => fetchSarWaterMask(), []);
    const healthFetcher = useCallback(() => fetchEcosystemHealth(), []);
    const timeseriesFetcher = useCallback(() => fetchEcosystemTimeseries(), []);
    const anomaliesFetcher = useCallback(() => fetchEcosystemAnomalies(), []);

    const weather = usePolling<WeatherNowResponse>(
        'weather-now', weatherFetcher,
        { intervalMs: INTERVAL_WEATHER, cacheTtlMs: CACHE_WEATHER, enabled },
    );

    const vulnerability = usePolling<VulnerabilityNowResponse>(
        'vulnerability-now', vulnerabilityFetcher,
        { intervalMs: INTERVAL_VULNERABILITY, cacheTtlMs: CACHE_VULNERABILITY, enabled },
    );

    const waterMask = usePolling<SarWaterMaskResponse>(
        'sar-water-mask', sarFetcher,
        { intervalMs: INTERVAL_SAR, cacheTtlMs: CACHE_SAR, enabled },
    );

    const ecosystemHealth = usePolling<EcosystemHealthResponse>(
        'ecosystem-health', healthFetcher,
        { intervalMs: INTERVAL_ECOSYSTEM, cacheTtlMs: CACHE_ECOSYSTEM, enabled },
    );

    const ecosystemTimeseries = usePolling<EcosystemTimeseriesResponse>(
        'ecosystem-timeseries', timeseriesFetcher,
        { intervalMs: INTERVAL_ECOSYSTEM, cacheTtlMs: CACHE_ECOSYSTEM, enabled },
    );

    const anomalies = usePolling<EcosystemAnomaliesResponse>(
        'ecosystem-anomalies', anomaliesFetcher,
        { intervalMs: INTERVAL_ECOSYSTEM, cacheTtlMs: CACHE_ECOSYSTEM, enabled },
    );

    return {
        weather: { data: weather.data, error: weather.error, isLoading: weather.isLoading, isFallback: weather.isFallback },
        vulnerability: { data: vulnerability.data, error: vulnerability.error, isLoading: vulnerability.isLoading, isFallback: vulnerability.isFallback },
        waterMask: { data: waterMask.data, error: waterMask.error, isLoading: waterMask.isLoading, isFallback: waterMask.isFallback },
        ecosystemHealth: { data: ecosystemHealth.data, error: ecosystemHealth.error, isLoading: ecosystemHealth.isLoading, isFallback: ecosystemHealth.isFallback },
        ecosystemTimeseries: { data: ecosystemTimeseries.data, error: ecosystemTimeseries.error, isLoading: ecosystemTimeseries.isLoading, isFallback: ecosystemTimeseries.isFallback },
        anomalies: { data: anomalies.data, error: anomalies.error, isLoading: anomalies.isLoading, isFallback: anomalies.isFallback },
    };
}
