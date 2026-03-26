import React, { useEffect, useState } from 'react';
import type {
    Feature,
    FeatureCollection,
    GeoJsonProperties,
    Geometry,
    Point,
    Position,
} from 'geojson';
import { Waves, Satellite, Droplets, Activity, CloudOff, AlertTriangle, RadioReceiver, TreePine, Wind, Thermometer, ArrowUpRight } from 'lucide-react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface WeatherData {
    weather_now: {
        rain_mm_h: number;
    };
    error?: string;
}

interface TideData {
    level_m: number;
    wave_height_m?: number | null;
    wave_direction_deg?: number | null;
    wave_period_s?: number | null;
    water_temp_c?: number | null;
    wind_speed_ms?: number | null;
    wind_direction_deg?: number | null;
    current_speed_ms?: number | null;
    error?: string;
}

interface SarData {
    tile_url: string | null;
    date_acquired: string | null;
    error?: string;
}

interface EcosystemHealthData {
    health_index: number;
    sensor: string;
    date_acquired: string | null;
    classification?: string | null;
    trend?: string | null;
    components?: {
        ndvi_mean?: number | null;
        canopy_cover?: number | null;
        fragmentation_index?: number | null;
    };
    error?: string;
}

interface FloodStatusResponse {
    timestamp: string;
    weather: WeatherData;
    tide: TideData;
    sar_data: SarData;
    ecosystem_health: EcosystemHealthData;
}

interface MapSectionProps {
    waterMaskGeoJson?: FeatureCollection | null;
    onSelectZone?: (id: string) => void;
    [key: string]: unknown;
}

import { API_BASE_URL } from '@/lib/constants';
const API_URL = `${API_BASE_URL}/api/v1/flood-status`;
const POLL_INTERVAL = 60000;
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

function collectPositions(geometry: Geometry | null | undefined): Position[] {
    if (!geometry) {
        return [];
    }

    if (geometry.type === 'Point') {
        return [geometry.coordinates];
    }

    if (geometry.type === 'Polygon') {
        return geometry.coordinates.flat();
    }

    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.flat(2);
    }

    return [];
}

function geometryCenter(geometry: Geometry | null | undefined): Position | null {
    const positions = collectPositions(geometry);
    if (!positions.length) {
        return null;
    }

    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const [lon, lat] of positions) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }

    return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function toVulnerabilityPoints(
    collection?: FeatureCollection | null,
): FeatureCollection<Point, GeoJsonProperties> {
    if (!collection?.features?.length) {
        return EMPTY_FEATURE_COLLECTION as FeatureCollection<Point, GeoJsonProperties>;
    }

    const features: Array<Feature<Point, GeoJsonProperties>> = [];

    for (const feature of collection.features) {
        const center = geometryCenter(feature.geometry);
        if (!center) {
            continue;
        }

        features.push({
            type: 'Feature',
            id: feature.id,
            geometry: {
                type: 'Point',
                coordinates: center,
            },
            properties: feature.properties ?? {},
        });
    }

    return {
        type: 'FeatureCollection',
        features,
    };
}

export function MapSection({ waterMaskGeoJson, vulnerabilityGeoJson }: MapSectionProps) {
    const [data, setData] = useState<FloodStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const waterMaskData = waterMaskGeoJson ?? EMPTY_FEATURE_COLLECTION;

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const res = await fetch(API_URL);
                if (!res.ok) {
                    throw new Error('Fallo en la comunicacion con el backend local.');
                }

                const json: FloodStatusResponse = await res.json();

                if (isMounted) {
                    setData(json);
                    setLastFetch(new Date());
                    setError(null);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void fetchData();
        const intervalId = setInterval(() => {
            void fetchData();
        }, POLL_INTERVAL);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    const TRIGGER_ECOSYSTEM_URL = `${API_BASE_URL}/api/v1/trigger/ecosystem-health`;
    const TRIGGER_WEATHER_URL = `${API_BASE_URL}/api/v1/trigger/weather`;
    const TRIGGER_TIDE_URL = `${API_BASE_URL}/api/v1/trigger/tide`;

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await Promise.allSettled([
                fetch(TRIGGER_WEATHER_URL, { method: 'POST' }),
                fetch(TRIGGER_TIDE_URL, { method: 'POST' }),
                fetch(TRIGGER_ECOSYSTEM_URL, { method: 'POST' }),
            ]);
            const res = await fetch(API_URL);
            if (res.ok) {
                const json: FloodStatusResponse = await res.json();
                setData(json);
                setLastFetch(new Date());
                setError(null);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sync failed');
        } finally {
            setIsSyncing(false);
        }
    };

    const getThreatLevel = (): { level: 'NORMAL' | 'WARNING' | 'CRITICAL'; color: string; glow: string; pulse: boolean } => {
        if (!data || data.tide.error || data.weather.error) {
            return {
                level: 'NORMAL',
                color: 'text-green-400 border-green-400/50 bg-green-400/10',
                glow: 'shadow-[0_0_15px_rgba(74,222,128,0.2)]',
                pulse: false,
            };
        }

        const rain = data.weather.weather_now.rain_mm_h;
        const tide = data.tide.level_m;
        const waves = data.tide.wave_height_m ?? 0;

        if ((tide > 3.0 && rain > 15) || waves > 3.5) {
            return {
                level: 'CRITICAL',
                color: 'text-red-500 border-red-500/50 bg-red-500/10',
                glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
                pulse: true,
            };
        }

        if (tide > 2.5 || waves > 2.0) {
            return {
                level: 'WARNING',
                color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10',
                glow: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]',
                pulse: true,
            };
        }

        return {
            level: 'NORMAL',
            color: 'text-green-400 border-green-400/50 bg-green-400/10',
            glow: 'shadow-[0_0_15px_rgba(74,222,128,0.2)]',
            pulse: false,
        };
    };

    const threat = getThreatLevel();

    return (
        <section id="map" className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white">
            <div className="absolute inset-0 z-0">
                <Map
                    initialViewState={{
                        longitude: -79.9,
                        latitude: -2.2,
                        zoom: 11.5,
                    }}
                    mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                    interactive
                >
                    <NavigationControl position="bottom-right" />

                    {data?.sar_data?.tile_url && !data.sar_data.error && (
                        <Source id="sar-source" type="raster" tiles={[data.sar_data.tile_url]} tileSize={256}>
                            <Layer
                                id="sar-water"
                                type="raster"
                                paint={{ 'raster-opacity': 0.8 }}
                            />
                        </Source>
                    )}

                    {/* Mangrove extent — organic polygons from SAR water mask (Firestore cache) */}
                    <Source id="water-mask-source" type="geojson" data={waterMaskData as any}>
                        <Layer
                            id="water-mask"
                            type="fill"
                            paint={{
                                'fill-color': '#00ffcc',
                                'fill-opacity': 0.6,
                            }}
                        />
                    </Source>

                </Map>
            </div>

            <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"></div>

            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-500">
                    <Activity className="w-12 h-12 text-[#22d3ee] animate-pulse mb-4" />
                    <h2 className="text-xl font-mono tracking-widest text-white/90">INICIALIZANDO HUD...</h2>
                    <p className="text-sm text-white/50 tracking-widest mt-2 uppercase">Conectando sensores y capas geoespaciales</p>
                </div>
            )}

            {!loading && (
                <>
                    {/* Top-left: Status badges */}
                    <div className="absolute top-6 left-6 z-20 flex flex-col gap-3 pointer-events-none">
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="font-mono text-xs tracking-[0.15em] font-medium text-white/90">MANGROVESHIELD LIVE</span>
                        </div>

                        {data?.sar_data?.date_acquired && (
                            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg hover:border-white/20 transition-all pointer-events-auto">
                                <Satellite className="w-4 h-4 text-[#22d3ee]" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-white/50 uppercase tracking-widest">Ultimo escaneo SAR</span>
                                    <span className="font-mono text-xs text-[#22d3ee] tracking-widest">{data.sar_data.date_acquired}</span>
                                </div>
                            </div>
                        )}

                        {/* Sync button */}
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Activity className={`w-4 h-4 text-[#22d3ee] ${isSyncing ? 'animate-pulse' : ''}`} />
                            <span className="font-mono text-xs tracking-[0.15em] text-white/70">
                                {isSyncing ? 'SYNCING...' : 'SYNC AHORA'}
                            </span>
                        </button>
                    </div>

                    {/* Top-right: Weather + Ecosystem panels */}
                    <div className="absolute top-6 right-6 z-20 flex flex-col gap-3 pointer-events-none">
                        {/* Tide / Sea Level */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Nivel del mar</span>
                                <span className="font-mono text-xl font-medium text-blue-300">
                                    {data?.tide?.error === 'AWAITING_TRIGGER' ? '--' : data?.tide?.error ? (
                                        <AlertTriangle className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                    ) : (
                                        <>{data?.tide?.level_m?.toFixed(2)} <span className="text-[10px] text-white/50">m</span></>
                                    )}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Waves className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>

                        {/* Wave Height */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Altura Olas</span>
                                <span className="font-mono text-xl font-medium text-cyan-300">
                                    {data?.tide?.error === 'AWAITING_TRIGGER' ? '--' : data?.tide?.wave_height_m != null ? (
                                        <>{data.tide.wave_height_m.toFixed(1)} <span className="text-[10px] text-white/50">m</span></>
                                    ) : <span className="text-white/30 text-sm">—</span>}
                                </span>
                                {data?.tide?.wave_period_s != null && (
                                    <span className="text-[9px] text-white/40 mt-0.5">{data.tide.wave_period_s.toFixed(0)}s período</span>
                                )}
                            </div>
                            <div className="ml-auto p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                <ArrowUpRight className="w-5 h-5 text-cyan-400" />
                            </div>
                        </div>

                        {/* Water Temperature */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Temp. Agua</span>
                                <span className="font-mono text-xl font-medium text-orange-300">
                                    {data?.tide?.error === 'AWAITING_TRIGGER' ? '--' : data?.tide?.water_temp_c != null ? (
                                        <>{data.tide.water_temp_c.toFixed(1)} <span className="text-[10px] text-white/50">°C</span></>
                                    ) : <span className="text-white/30 text-sm">—</span>}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <Thermometer className="w-5 h-5 text-orange-400" />
                            </div>
                        </div>

                        {/* Wind Speed */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Viento marino</span>
                                <span className="font-mono text-xl font-medium text-purple-300">
                                    {data?.tide?.error === 'AWAITING_TRIGGER' ? '--' : data?.tide?.wind_speed_ms != null ? (
                                        <>{data.tide.wind_speed_ms.toFixed(1)} <span className="text-[10px] text-white/50">m/s</span></>
                                    ) : <span className="text-white/30 text-sm">—</span>}
                                </span>
                                {data?.tide?.wind_direction_deg != null && (
                                    <span className="text-[9px] text-white/40 mt-0.5">{data.tide.wind_direction_deg.toFixed(0)}° dirección</span>
                                )}
                            </div>
                            <div className="ml-auto p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <Wind className="w-5 h-5 text-purple-400" />
                            </div>
                        </div>

                        {/* Rain + NDVI */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Lluvia (1h)</span>
                                <span className="font-mono text-xl font-medium text-[#22d3ee]">
                                    {data?.weather?.error === 'AWAITING_TRIGGER' ? '--' : data?.weather?.error ? (
                                        <CloudOff className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                    ) : (
                                        <>{data?.weather?.weather_now?.rain_mm_h?.toFixed(1)} <span className="text-[10px] text-white/50">mm</span></>
                                    )}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-[#22d3ee]/10 rounded-lg border border-[#22d3ee]/20">
                                <Droplets className="w-5 h-5 text-[#22d3ee]" />
                            </div>
                        </div>

                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start gap-1 w-full">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Salud Manglar (NDVI)</span>
                                <span className="font-mono text-xl font-medium text-green-400">
                                    {data?.ecosystem_health?.error ? (
                                        <AlertTriangle className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                    ) : (
                                        <>{data?.ecosystem_health?.health_index?.toFixed(3)}</>
                                    )}
                                </span>
                                {/* Real computed metrics from Earth Engine */}
                                {data?.ecosystem_health?.components && (
                                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 w-full border-t border-white/5 pt-1.5">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-white/35 uppercase tracking-widest">Dosel</span>
                                            <span className="font-mono text-sm text-green-300 font-medium">
                                                {data.ecosystem_health.components.canopy_cover != null
                                                    ? `${(data.ecosystem_health.components.canopy_cover * 100).toFixed(1)}%`
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-white/35 uppercase tracking-widest">Fragm.</span>
                                            <span className="font-mono text-sm text-green-300 font-medium">
                                                {data.ecosystem_health.components.fragmentation_index != null
                                                    ? data.ecosystem_health.components.fragmentation_index.toFixed(3)
                                                    : '—'}
                                            </span>
                                        </div>
                                        {data.ecosystem_health.classification && (
                                            <div className="col-span-2 mt-0.5">
                                                <span className="text-[8px] uppercase tracking-widest font-mono" style={{ color: data.ecosystem_health.classification === 'optimo' ? '#4ade80' : data.ecosystem_health.classification === 'moderado' ? '#facc15' : '#f87171' }}>
                                                    {data.ecosystem_health.classification.toUpperCase()} · {data.ecosystem_health.trend ?? 'stable'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="ml-auto p-2 bg-green-500/10 rounded-lg border border-green-500/20 shrink-0">
                                <TreePine className="w-5 h-5 text-green-400" />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 max-w-[200px] mt-2 self-end pointer-events-auto">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                                <span className="text-[9px] text-red-300 font-mono tracking-widest uppercase">Backend offline</span>
                            </div>
                        )}

                        {data?.weather?.error === 'AWAITING_TRIGGER' && data?.tide?.error === 'AWAITING_TRIGGER' && (
                            <div className="bg-[#22d3ee]/5 backdrop-blur-md border border-[#22d3ee]/20 px-4 py-2 rounded-xl flex items-center gap-2 mt-2 self-end pointer-events-auto">
                                <span className="text-[9px] text-[#22d3ee]/70 font-mono tracking-widest uppercase">Esperando trigger</span>
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
                        <div className={`
                            flex items-center gap-4 px-6 py-3 rounded-2xl border backdrop-blur-md transition-all duration-500
                            ${threat.color} ${threat.glow}
                        `}>
                            <div className={`p-1.5 rounded-full ${threat.level === 'CRITICAL' ? 'bg-red-500/20' : threat.level === 'WARNING' ? 'bg-yellow-400/20' : 'bg-green-400/20'}`}>
                                <RadioReceiver className={`w-5 h-5 ${threat.pulse ? 'animate-pulse' : ''}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-[0.2em] opacity-70">Nivel de amenaza</span>
                                <span className="font-mono font-bold tracking-widest text-base">{threat.level}</span>
                            </div>
                        </div>
                        {lastFetch && (
                            <div className="mt-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                                <span className="text-[9px] text-white/50 font-mono tracking-widest uppercase flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]/50"></span>
                                    Sync: {lastFetch.toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
