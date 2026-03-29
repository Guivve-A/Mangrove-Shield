import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Oswald } from 'next/font/google';
import { useT } from '@/lib/i18n/LanguageContext';
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { MangroveTilesResponse, MangroveTimelineResponse } from '@/types/geospatial';
import { loadMangroveTimeline, loadMangroveTiles } from '@/lib/api';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// ---------------------------------------------------------------------------
// Animated count-up hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}

// ---------------------------------------------------------------------------
// TimeSlider component
// ---------------------------------------------------------------------------

interface TimeSliderProps {
  years: number[];
  selectedIndex: number;
  onChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  labels: { playing: string; paused: string; pauseLabel: string; playLabel: string; selectYear: (y: number) => string };
}

function TimeSlider({ years, selectedIndex, onChange, isPlaying, onTogglePlay, labels }: TimeSliderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          aria-label={isPlaying ? labels.pauseLabel : labels.playLabel}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
          {isPlaying ? labels.playing : labels.paused}
        </span>
      </div>

      <div className="relative flex w-full max-w-xl items-center justify-between px-2">
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        <div
          className="absolute left-2 top-1/2 h-px -translate-y-1/2 bg-emerald-400/60 transition-all duration-300"
          style={{ width: `${(selectedIndex / Math.max(years.length - 1, 1)) * 100}%` }}
        />
        {years.map((year, i) => {
          const isActive = i === selectedIndex;
          return (
            <button
              key={year}
              onClick={() => onChange(i)}
              className="group relative z-10 flex flex-col items-center"
              aria-label={labels.selectYear(year)}
            >
              <div
                className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? 'scale-125 border-emerald-400 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                    : 'border-white/30 bg-white/10 group-hover:border-white/60'
                }`}
              />
              <span
                className={`mt-2 font-mono text-[11px] transition-colors ${
                  isActive ? 'font-bold text-emerald-400' : 'text-white/40 group-hover:text-white/70'
                }`}
              >
                {year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export function MangroveTimelineSection() {
  const { t } = useT();
  const [data, setData] = useState<MangroveTimelineResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mapMode, setMapMode] = useState<'change' | 'before' | 'after'>('change');
  const [tilesByYear, setTilesByYear] = useState<Record<number, MangroveTilesResponse | undefined>>({});
  const [tilesLoading, setTilesLoading] = useState(false);
  const [tilesError, setTilesError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMangroveTimeline().then((res) => {
      if (!cancelled) setData(res);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isPlaying || !data) return;
    const timer = setInterval(() => {
      setSelectedIndex((prev) => {
        const next = prev + 1;
        if (next >= data.records.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, data]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && data && selectedIndex >= data.records.length - 1) {
        setSelectedIndex(0);
      }
      return !prev;
    });
  }, [data, selectedIndex]);

  const records = data?.records ?? [];
  const years = data?.years ?? [];
  const selectedRecord = records[selectedIndex] ?? null;
  const selectedYear = selectedRecord?.year ?? null;
  const selectedTiles = selectedYear ? tilesByYear[selectedYear] : undefined;

  const totalLoss = data?.summary.total_loss_ha ?? 0;
  const totalGain = data?.summary.total_gain_ha ?? 0;
  const netChange = data?.summary.net_change_ha ?? 0;

  const maxTotal = useMemo(() => Math.max(1, ...records.map((r) => r.total_ha)), [records]);
  const maxLoss = useMemo(() => Math.max(1, ...records.map((r) => r.loss_ha)), [records]);
  const maxGain = useMemo(() => Math.max(1, ...records.map((r) => r.gain_ha)), [records]);

  const animLoss = useCountUp(totalLoss, 1800, isVisible);
  const animGain = useCountUp(totalGain, 1800, isVisible);
  const animNet = useCountUp(Math.abs(netChange), 1800, isVisible);

  const mapInitialViewState = useMemo(() => {
    const bbox = data?.bbox ?? [-80.1, -2.4, -79.4, -1.7];
    const longitude = (bbox[0] + bbox[2]) / 2;
    const latitude = (bbox[1] + bbox[3]) / 2;
    return { longitude, latitude, zoom: 10.2, pitch: 0, bearing: 0 };
  }, [data?.bbox]);

  useEffect(() => {
    if (!selectedYear) return;

    if (selectedTiles) {
      setTilesLoading(false);
      setTilesError(null);
      return;
    }

    let cancelled = false;
    setTilesLoading(true);
    setTilesError(null);

    loadMangroveTiles(selectedYear, 'prev')
      .then((res) => {
        if (cancelled) return;
        setTilesByYear((prev) => ({ ...prev, [selectedYear]: res }));
        if (!res.tiles?.change) setMapMode('after');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTilesError(err instanceof Error ? err.message : 'No se pudo cargar el mapa');
      })
      .finally(() => {
        if (!cancelled) setTilesLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedYear, selectedTiles]);

  if (!data) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-[#0a1628]">
        <div className="rounded-full border border-white/10 bg-ocean-dark/70 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 backdrop-blur-md">
          {t.timeline.loading}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="mangrove-timeline"
      className="relative w-full overflow-hidden bg-[#0a1628] py-20 font-sans"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-red-500/5 blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        {/* ─── Zone 1: Header + KPI Row ─── */}
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/70">
            Global Mangrove Watch v3.0
          </span>

          {/* Data provenance badge */}
          <div className="mb-8 flex justify-center">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] backdrop-blur-md ${
              data._source === 'firestore' || data._source === 'api'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${
                data._source === 'firestore' || data._source === 'api' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`} />
              {data._source === 'firestore'
                ? 'Datos en vivo · Pipeline → Firestore'
                : data._source === 'api'
                  ? 'Datos satelitales · Earth Engine (proxy)'
                  : 'Estimación calibrada · fallback'}
            </div>
          </div>

          <h2 className={`${oswald.className} text-4xl uppercase leading-none tracking-[0.05em] text-white md:text-6xl`}>
            {t.timeline.title}
          </h2>
          <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.15em] text-white/40">
            Gran Guayaquil &middot; 2014 &rarr; 2024
          </p>

          {/* KPI Row: net_change hero + loss/gain secondary */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">

            {/* Secondary: losses */}
            <div className="flex flex-col items-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-2xl font-bold text-red-400 md:text-3xl`}>
                -{animLoss.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {t.timeline.losses}
              </span>
            </div>

            {/* HERO: net_change */}
            <div className="flex flex-col items-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-8 py-5 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-4xl font-bold text-amber-400 md:text-5xl`}>
                {netChange >= 0 ? '+' : '-'}{animNet.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {t.timeline.netBalance}
              </span>
            </div>

            {/* Secondary: gains */}
            <div className="flex flex-col items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-2xl font-bold text-emerald-400 md:text-3xl`}>
                +{animGain.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {t.timeline.gains}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Zone 2: Coverage Circle + Year Stats + Timeline ─── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#0d1a2e]">
          <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

          {/* Circle left + Stats right */}
          <div className="relative flex flex-col items-center gap-8 py-10 md:flex-row md:items-center md:justify-center md:gap-16">

            {/* Circle */}
            <div className="relative flex-shrink-0">
              <svg viewBox="0 0 200 200" width="220" height="220" className="drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="100" cy="100" r="85"
                  fill="none" stroke="url(#coverageGrad)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(selectedRecord?.total_ha ?? 0, maxTotal) / maxTotal) * 534} 534`}
                  transform="rotate(-90 100 100)"
                  className="transition-all duration-700"
                />
                <circle
                  cx="100" cy="100" r="72"
                  fill="none" stroke="#ef4444" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(selectedRecord?.loss_ha ?? 0, maxLoss) / maxLoss) * 452} 452`}
                  transform="rotate(-90 100 100)"
                  opacity="0.7"
                  className="transition-all duration-700"
                />
                <circle
                  cx="100" cy="100" r="72"
                  fill="none" stroke="#06b6d4" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(selectedRecord?.gain_ha ?? 0, maxGain) / maxGain) * 452} 452`}
                  transform="rotate(90 100 100)"
                  opacity="0.7"
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="coverageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center: selected year */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`${oswald.className} tabular-nums text-4xl font-bold text-emerald-400 md:text-5xl`}>
                  {selectedRecord?.year ?? '—'}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                  {t.timeline.year}
                </span>
              </div>
            </div>

            {/* Stats: Cobertura / Pérdida / Ganancia for selected year */}
            <div className="flex flex-col gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{t.timeline.coverage}</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-white md:text-4xl`}>
                  {(selectedRecord?.total_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{t.timeline.loss}</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-red-400 md:text-4xl`}>
                  -{(selectedRecord?.loss_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{t.timeline.gain}</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-cyan-400 md:text-4xl`}>
                  +{(selectedRecord?.gain_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 px-6 pb-5 pt-4">
            <TimeSlider
              years={years}
              selectedIndex={selectedIndex}
              onChange={(i) => { setSelectedIndex(i); setIsPlaying(false); }}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              labels={t.timeline}
            />
          </div>

          {/* Map: before/after + change overlay */}
          <div className="border-t border-white/8 px-6 pb-7 pt-6">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Mapa de cambio{selectedRecord?.year ? ` · ${selectedRecord.year}` : ''}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
                  {selectedTiles?.compare_to_year
                    ? `Antes: ${selectedTiles.compare_to_year} · Después: ${selectedTiles.year}`
                    : 'Cobertura (sin año previo)'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapMode('change')}
                  disabled={!selectedTiles?.tiles?.change}
                  className={`rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-all ${
                    mapMode === 'change'
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                      : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                  } ${!selectedTiles?.tiles?.change ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  Cambio
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('before')}
                  disabled={!selectedTiles?.tiles?.before}
                  className={`rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-all ${
                    mapMode === 'before'
                      ? 'border-white/30 bg-white/10 text-white/80'
                      : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                  } ${!selectedTiles?.tiles?.before ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  Antes
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('after')}
                  disabled={!selectedTiles?.tiles?.after}
                  className={`rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-all ${
                    mapMode === 'after'
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                  } ${!selectedTiles?.tiles?.after ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  Después
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 lg:col-span-9">
                <div className="h-[420px] w-full">
                  <Map
                    initialViewState={mapInitialViewState}
                    mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                    interactive
                  >
                    <NavigationControl position="bottom-right" />

                    {mapMode === 'before' && selectedTiles?.tiles.before && (
                      <Source id="mangrove-before" type="raster" tiles={[selectedTiles.tiles.before]} tileSize={256}>
                        <Layer id="mangrove-before-layer" type="raster" paint={{ 'raster-opacity': 0.75 }} />
                      </Source>
                    )}

                    {mapMode !== 'before' && selectedTiles?.tiles.after && (
                      <Source id="mangrove-after" type="raster" tiles={[selectedTiles.tiles.after]} tileSize={256}>
                        <Layer id="mangrove-after-layer" type="raster" paint={{ 'raster-opacity': mapMode === 'change' ? 0.35 : 0.75 }} />
                      </Source>
                    )}

                    {mapMode === 'change' && selectedTiles?.tiles.change && (
                      <Source id="mangrove-change" type="raster" tiles={[selectedTiles.tiles.change]} tileSize={256}>
                        <Layer id="mangrove-change-layer" type="raster" paint={{ 'raster-opacity': 0.9 }} />
                      </Source>
                    )}
                  </Map>
                </div>

                {(tilesLoading || tilesError) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#07101f]/80 backdrop-blur-sm">
                    <div className="flex max-w-[520px] flex-col items-center gap-2 px-6 text-center">
                      {tilesLoading && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                          Cargando mosaico satelital...
                        </span>
                      )}
                      {tilesError && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-300">
                          {tilesError}
                        </span>
                      )}
                      {tilesError && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                          Configura GEE_SERVICE_ACCOUNT_B64 y EE_PROJECT en el backend.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Leyenda</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Cobertura</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Pérdida</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-sm bg-cyan-300" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Ganancia</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Proveniencia</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                    {selectedTiles?.source_detail ?? data.source_detail ?? '—'}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-white/45">
                    Las teselas se calculan en Google Earth Engine y se actualizan por año del timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
