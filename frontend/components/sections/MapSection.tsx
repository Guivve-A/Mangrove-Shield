import React, { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { Waves, Satellite, Droplets, Activity, AlertTriangle, RadioReceiver, TreePine } from 'lucide-react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { getFloodStatus } from '@/lib/liveApi';

const POLL_INTERVAL = 60000;
const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface FloodStatusResponse {
    timestamp: string;
    weather: { weather_now: { rain_mm_h: number }; error?: string };
    tide: { level_m: number; error?: string };
    sar_data: { tile_url: string | null; date_acquired: string | null; error?: string };
    ecosystem_health: {
        health_index: number;
        sensor: string;
        date_acquired: string | null;
        error?: string;
    };
}

interface MapSectionProps {
    waterMaskGeoJson?: FeatureCollection | null;
    [key: string]: unknown;
}

export function MapSection({ waterMaskGeoJson }: MapSectionProps) {
    const [data, setData] = useState<FloodStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);

    const waterMaskData = waterMaskGeoJson ?? EMPTY_FC;

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const json = await getFloodStatus() as unknown as FloodStatusResponse;
                if (isMounted) { setData(json); setLastFetch(new Date()); setError(null); }
            } catch (err: unknown) {
                if (isMounted) setError(err instanceof Error ? err.message : 'Error');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        void fetchData();
        const id = setInterval(() => void fetchData(), POLL_INTERVAL);
        return () => { isMounted = false; clearInterval(id); };
    }, []);

    const threat = (() => {
        if (!data || data.tide.error || data.weather.error) {
            return { level: 'NORMAL', color: 'text-green-400 border-green-400/50 bg-green-400/10', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.2)]', pulse: false };
        }
        const rain = data.weather.weather_now.rain_mm_h;
        const tide = data.tide.level_m;
        if (tide > 3.0 && rain > 15) return { level: 'CRITICAL', color: 'text-red-500 border-red-500/50 bg-red-500/10', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]', pulse: true };
        if (tide > 2.5) return { level: 'WARNING', color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]', pulse: true };
        return { level: 'NORMAL', color: 'text-green-400 border-green-400/50 bg-green-400/10', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.2)]', pulse: false };
    })();

    return (
        <section id="map" className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white">
            <div className="absolute inset-0 z-0">
                <Map
                    initialViewState={{ longitude: -79.9, latitude: -2.2, zoom: 11.5 }}
                    mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                    interactive
                >
                    <NavigationControl position="bottom-right" />

                    {/* SAR water-detection raster tile from GEE */}
                    {data?.sar_data?.tile_url && !data.sar_data.error && (
                        <Source id="sar-source" type="raster" tiles={[data.sar_data.tile_url]} tileSize={256}>
                            <Layer id="sar-water" type="raster" paint={{ 'raster-opacity': 0.8 }} />
                        </Source>
                    )}

                    {/* Organic mangrove/water polygons from Firestore (data_sync pipeline) */}
                    <Source id="water-mask-source" type="geojson" data={waterMaskData as any}>
                        <Layer
                            id="water-mask"
                            type="fill"
                            paint={{ 'fill-color': '#06b6d4', 'fill-opacity': 0.5 }}
                        />
                    </Source>
                </Map>
            </div>

            <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />

            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    <Activity className="w-12 h-12 text-[#22d3ee] animate-pulse mb-4" />
                    <h2 className="text-xl font-mono tracking-widest text-white/90">INICIALIZANDO HUD...</h2>
                </div>
            )}

            {!loading && (
                <>
                    {/* Top-left: LIVE + SAR date */}
                    <div className="absolute top-6 left-6 z-20 flex flex-col gap-3 pointer-events-none">
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                            </span>
                            <span className="font-mono text-xs tracking-[0.15em] font-medium text-white/90">MANGROVESHIELD LIVE</span>
                        </div>

                        {data?.sar_data?.date_acquired && (
                            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                                <Satellite className="w-4 h-4 text-[#22d3ee]" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-white/50 uppercase tracking-widest">Ultimo escaneo SAR</span>
                                    <span className="font-mono text-xs text-[#22d3ee] tracking-widest">{data.sar_data.date_acquired}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Top-right: 3 sensor panels */}
                    <div className="absolute top-6 right-6 z-20 flex flex-col gap-3 pointer-events-none">
                        {/* Tide */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Nivel marea</span>
                                <span className="font-mono text-xl font-medium text-blue-300">
                                    {data?.tide?.error
                                        ? <AlertTriangle className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                        : <>{data?.tide?.level_m?.toFixed(2)} <span className="text-[10px] text-white/50">m</span></>}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Waves className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>

                        {/* Rain */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Lluvia (1h)</span>
                                <span className="font-mono text-xl font-medium text-[#22d3ee]">
                                    {data?.weather?.error
                                        ? <AlertTriangle className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                        : <>{data?.weather?.weather_now?.rain_mm_h?.toFixed(1)} <span className="text-[10px] text-white/50">mm</span></>}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-[#22d3ee]/10 rounded-lg border border-[#22d3ee]/20">
                                <Droplets className="w-5 h-5 text-[#22d3ee]" />
                            </div>
                        </div>

                        {/* NDVI */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-6 shadow-lg min-w-[195px]">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Salud manglar (NDVI)</span>
                                <span className="font-mono text-xl font-medium text-green-400">
                                    {data?.ecosystem_health?.error
                                        ? <AlertTriangle className="w-5 h-5 text-yellow-500 inline-block mt-1" />
                                        : <>{data?.ecosystem_health?.health_index?.toFixed(3)}</>}
                                </span>
                            </div>
                            <div className="ml-auto p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                <TreePine className="w-5 h-5 text-green-400" />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 pointer-events-auto">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                                <span className="text-[9px] text-red-300 font-mono tracking-widest uppercase">Backend offline</span>
                            </div>
                        )}
                    </div>

                    {/* Bottom-center: Threat level */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
                        <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border backdrop-blur-md transition-all duration-500 ${threat.color} ${threat.glow}`}>
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
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]/50" />
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
